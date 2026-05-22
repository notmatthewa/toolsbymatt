import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EffectType = "none" | "reverb" | "echo" | "lowpass" | "highpass";

export interface PlayerControls {
  loadVideo: (youtubeUrl: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  setSpeed: (rate: number) => void;
  setEffect: (effect: EffectType) => void;
}

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
  effect: EffectType;
  loading: boolean;
  loadingProgress: string;
  videoId: string | null;
  title: string;
  waveform: number[] | null;
  audioLevel: number;
}

function extractVideoId(input: string): string | null {
  const m = input
    .trim()
    .match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
    );
  return m ? m[1] : null;
}

export function useLocalPlayer(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const blobUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const effectNodeRef = useRef<AudioNode | null>(null);
  const connectedRef = useRef(false);
  const volumeRef = useRef(100);
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<PlayerState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    speed: 1,
    effect: "none",
    loading: false,
    loadingProgress: "",
    videoId: null,
    title: "",
    waveform: null,
    audioLevel: 0,
  });

  // Build an effect node for the given type
  const buildEffectNode = useCallback((ctx: AudioContext, type: EffectType): AudioNode | null => {
    if (type === "reverb") {
      const convolver = ctx.createConvolver();
      // Generate a simple impulse response (synthetic reverb)
      const rate = ctx.sampleRate;
      const len = rate * 2;
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
        }
      }
      convolver.buffer = buf;
      // Mix dry/wet
      const dry = ctx.createGain(); dry.gain.value = 0.6;
      const wet = ctx.createGain(); wet.gain.value = 0.4;
      const merger = ctx.createGain();
      // We need a custom routing node. Use a trick: return an object that connects input→output.
      // Actually, simplest: just return the convolver with some gain.
      const output = ctx.createGain();
      convolver.connect(wet);
      wet.connect(output);
      dry.connect(output);
      // We return { input: [dry, convolver], output }. But AudioNode API is single-node.
      // Simplest approach: just use the convolver directly (100% wet for a clear effect)
      return convolver;
    }
    if (type === "echo") {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.3;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.4;
      delay.connect(feedback);
      feedback.connect(delay);
      return delay;
    }
    if (type === "lowpass") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;
      filter.Q.value = 1;
      return filter;
    }
    if (type === "highpass") {
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 2000;
      filter.Q.value = 1;
      return filter;
    }
    return null;
  }, []);

  const connectAudio = useCallback(() => {
    const video = videoRef.current;
    if (!video || connectedRef.current) return;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaElementSource(video);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      connectedRef.current = true;
    } catch {}
  }, [videoRef]);

  // Poll playback state + audio level
  useEffect(() => {
    const timeBuf = new Uint8Array(128);
    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      let audioLevel = 0;
      if (analyserRef.current && connectedRef.current) {
        analyserRef.current.getByteTimeDomainData(timeBuf);
        let sum = 0;
        for (let i = 0; i < timeBuf.length; i++) {
          const v = (timeBuf[i] - 128) / 128;
          sum += v * v;
        }
        audioLevel = Math.sqrt(sum / timeBuf.length);
      }
      setState((s) => ({
        ...s,
        currentTime: video.currentTime || 0,
        duration: isFinite(video.duration) ? video.duration : 0,
        playing: !video.paused && !video.ended,
        audioLevel,
      }));
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [videoRef]);

  const loadVideo = useCallback(
    async (url: string) => {
      const videoId = extractVideoId(url);
      if (!videoId) return;

      // Abort any previous in-flight download
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      setState((s) => ({
        ...s,
        loading: true,
        loadingProgress: "Downloading video...",
        videoId,
        title: "",
        waveform: null,
        duration: 0,
        currentTime: 0,
      }));

      // Always use a clean URL with just the video ID (strips playlist params)
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Fetch title
      fetch(`https://noembed.com/embed?url=${cleanUrl}`)
        .then((r) => r.json())
        .then((d) => {
          if (!abort.signal.aborted)
            setState((s) => ({ ...s, title: d.title || videoId }));
        })
        .catch(() => {
          if (!abort.signal.aborted)
            setState((s) => ({ ...s, title: videoId }));
        });

      try {
        const resp = await fetch(
          `/api/yt/download?url=${encodeURIComponent(cleanUrl)}&format=mp4&quality=480&waveform=200`,
          { signal: abort.signal }
        );
        if (!resp.ok) {
          const errData = await resp.json().catch(() => null);
          throw new Error(errData?.detail || `Download failed (${resp.status})`);
        }

        const contentLength = resp.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength) : 0;
        const reader = resp.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total) {
            const pct = Math.round((received / total) * 100);
            setState((s) => ({ ...s, loadingProgress: `Downloading... ${pct}%` }));
          } else {
            const mb = (received / 1024 / 1024).toFixed(1);
            setState((s) => ({ ...s, loadingProgress: `Downloading... ${mb} MB` }));
          }
        }

        // Read waveform from response header
        const waveformHeader = resp.headers.get("x-waveform");
        if (waveformHeader) {
          try {
            const peaks = JSON.parse(waveformHeader) as number[];
            if (peaks.length) setState((s) => ({ ...s, waveform: peaks }));
          } catch {}
        }

        const blob = new Blob(chunks as BlobPart[], { type: "video/mp4" });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const video = videoRef.current;
        if (video) {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => { video.removeEventListener("loadedmetadata", onLoaded); video.removeEventListener("error", onError); resolve(); };
            const onError = () => { video.removeEventListener("loadedmetadata", onLoaded); video.removeEventListener("error", onError); reject(new Error("Video failed to load")); };
            video.addEventListener("loadedmetadata", onLoaded);
            video.addEventListener("error", onError);
            video.src = blobUrl;
            video.load();
          });
          video.volume = volumeRef.current / 100;
        }

        setState((s) => ({ ...s, loading: false, loadingProgress: "" }));
      } catch (e) {
        if (abort.signal.aborted) return; // intentional abort, don't update state
        setState((s) => ({
          ...s,
          loading: false,
          loadingProgress: e instanceof Error ? e.message : "Download failed",
        }));
      }
    },
    [videoRef]
  );

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.src) return;
    connectAudio();
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
    video.play().catch(() => {});
  }, [videoRef, connectAudio]);

  const pause = useCallback(() => videoRef.current?.pause(), [videoRef]);

  const seekTo = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (video && isFinite(seconds)) video.currentTime = seconds;
    },
    [videoRef]
  );

  const setVolume = useCallback(
    (vol: number) => {
      volumeRef.current = vol;
      const video = videoRef.current;
      if (video) video.volume = vol / 100;
    },
    [videoRef]
  );

  const setSpeed = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (video) video.playbackRate = rate;
      setState((s) => ({ ...s, speed: rate }));
    },
    [videoRef]
  );

  const setEffect = useCallback(
    (effect: EffectType) => {
      const ctx = audioCtxRef.current;
      const source = sourceRef.current;
      const analyser = analyserRef.current;
      if (!ctx || !source || !analyser) {
        setState((s) => ({ ...s, effect }));
        return;
      }

      // Disconnect old effect
      source.disconnect();
      if (effectNodeRef.current) {
        effectNodeRef.current.disconnect();
        effectNodeRef.current = null;
      }

      // Build new effect
      const node = buildEffectNode(ctx, effect);
      if (node) {
        source.connect(node);
        node.connect(analyser);
        effectNodeRef.current = node;
      } else {
        source.connect(analyser);
      }

      setState((s) => ({ ...s, effect }));
    },
    [buildEffectNode]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  const controls = useMemo<PlayerControls>(
    () => ({ loadVideo, play, pause, seekTo, setVolume, setSpeed, setEffect }),
    [loadVideo, play, pause, seekTo, setVolume, setSpeed, setEffect]
  );
  return { state, controls };
}
