import { useCallback, useEffect, useRef, useState } from "react";

export interface PlayerControls {
  loadVideo: (youtubeUrl: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  setSpeed: (rate: number) => void;
}

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
  loading: boolean;
  loadingProgress: string;
  videoId: string | null;
  title: string;
  waveform: Float32Array | null;
  audioLevel: number; // 0-1 real-time RMS level
}

const WAVEFORM_BARS = 200;

function extractVideoId(input: string): string | null {
  const m = input
    .trim()
    .match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
    );
  return m ? m[1] : null;
}

function computeWaveform(buffer: AudioBuffer, bars: number): Float32Array {
  const data = buffer.getChannelData(0);
  const samplesPerBar = Math.floor(data.length / bars);
  const peaks = new Float32Array(bars);
  for (let i = 0; i < bars; i++) {
    let max = 0;
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, data.length);
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}

export function useLocalPlayer(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const blobUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const connectedRef = useRef(false);

  const [state, setState] = useState<PlayerState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    speed: 1,
    loading: false,
    loadingProgress: "",
    videoId: null,
    title: "",
    waveform: null,
    audioLevel: 0,
  });

  // Set up Web Audio API when video element is ready
  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const gain = ctx.createGain();
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    gainRef.current = gain;
  }, []);

  const connectSource = useCallback(() => {
    const video = videoRef.current;
    if (!video || connectedRef.current || !audioCtxRef.current || !gainRef.current) return;
    try {
      const source = audioCtxRef.current.createMediaElementSource(video);
      source.connect(gainRef.current);
      sourceRef.current = source;
      connectedRef.current = true;
    } catch {
      // Already connected or cross-origin — ignore
    }
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
        duration: video.duration || 0,
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

      // Clean up previous blob
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      setState((s) => ({
        ...s,
        loading: true,
        loadingProgress: "Downloading...",
        videoId,
        title: "",
        waveform: null,
      }));

      // Fetch title
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
        .then((r) => r.json())
        .then((d) => setState((s) => ({ ...s, title: d.title || videoId })))
        .catch(() => setState((s) => ({ ...s, title: videoId })));

      try {
        // Download video via backend
        const resp = await fetch(
          `/api/yt/download?url=${encodeURIComponent(url)}&format=mp4&quality=720`
        );
        if (!resp.ok) throw new Error("Download failed");

        // Track progress
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

        const blob = new Blob(chunks as BlobPart[], { type: "video/mp4" });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const video = videoRef.current;
        if (video) {
          video.src = blobUrl;
          video.load();

          // Set up audio context + connect
          ensureAudioContext();
          connectSource();
          if (audioCtxRef.current?.state === "suspended") {
            audioCtxRef.current.resume();
          }
        }

        // Generate waveform from audio data
        setState((s) => ({ ...s, loadingProgress: "Generating waveform..." }));
        try {
          const audioCtx = new AudioContext();
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const waveform = computeWaveform(audioBuffer, WAVEFORM_BARS);
          setState((s) => ({ ...s, waveform }));
          audioCtx.close();
        } catch {
          // Waveform generation failed — not critical
        }

        setState((s) => ({ ...s, loading: false, loadingProgress: "" }));
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          loadingProgress: e instanceof Error ? e.message : "Download failed",
        }));
      }
    },
    [videoRef, ensureAudioContext, connectSource]
  );

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    ensureAudioContext();
    connectSource();
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }
    video.play();
  }, [videoRef, ensureAudioContext, connectSource]);

  const pause = useCallback(() => videoRef.current?.pause(), [videoRef]);

  const seekTo = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (video) video.currentTime = seconds;
    },
    [videoRef]
  );

  const setVolume = useCallback(
    (vol: number) => {
      if (gainRef.current) {
        gainRef.current.gain.value = vol / 100;
      }
      const video = videoRef.current;
      if (video) video.volume = vol / 100;
      setState((s) => ({ ...s, volume: vol }));
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  const controls: PlayerControls = { loadVideo, play, pause, seekTo, setVolume, setSpeed };

  return { state, controls };
}
