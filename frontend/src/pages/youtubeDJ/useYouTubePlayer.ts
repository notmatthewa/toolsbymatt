import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeAPI } from "./loadYouTubeAPI";

export interface PlayerControls {
  loadVideo: (videoId: string) => void;
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
  availableSpeeds: number[];
  videoId: string | null;
  title: string;
}

export function useYouTubePlayer(divId: string) {
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [state, setState] = useState<PlayerState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    speed: 1,
    availableSpeeds: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
    videoId: null,
    title: "",
  });

  useEffect(() => {
    loadYouTubeAPI().then(() => {
      const el = document.getElementById(divId);
      if (!el) return;
      playerRef.current = new YT.Player(divId, {
        height: "100%",
        width: "100%",
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            const p = playerRef.current!;
            setState((s) => ({
              ...s,
              availableSpeeds: p.getAvailablePlaybackRates?.() || s.availableSpeeds,
            }));
          },
          onStateChange: (e: YT.OnStateChangeEvent) => {
            setState((s) => ({ ...s, playing: e.data === YT.PlayerState.PLAYING }));
          },
        },
      });

      // Poll for current time
      intervalRef.current = setInterval(() => {
        const p = playerRef.current;
        if (!p?.getCurrentTime) return;
        setState((s) => ({
          ...s,
          currentTime: p.getCurrentTime?.() ?? 0,
          duration: p.getDuration?.() ?? 0,
        }));
      }, 200);
    });

    return () => {
      clearInterval(intervalRef.current);
      playerRef.current?.destroy?.();
    };
    // divId is stable for the lifetime of the component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadVideo = useCallback((videoId: string) => {
    const p = playerRef.current;
    if (!p?.loadVideoById) return;
    p.loadVideoById(videoId);
    // Fetch title via noembed
    fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      .then((r) => r.json())
      .then((d) => setState((s) => ({ ...s, videoId, title: d.title || videoId })))
      .catch(() => setState((s) => ({ ...s, videoId, title: videoId })));
  }, []);

  const play = useCallback(() => playerRef.current?.playVideo?.(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), []);
  const seekTo = useCallback(
    (seconds: number) => playerRef.current?.seekTo?.(seconds, true),
    []
  );
  const setVolume = useCallback((vol: number) => {
    playerRef.current?.setVolume?.(vol);
    setState((s) => ({ ...s, volume: vol }));
  }, []);
  const setSpeed = useCallback((rate: number) => {
    playerRef.current?.setPlaybackRate?.(rate);
    setState((s) => ({ ...s, speed: rate }));
  }, []);

  const controls: PlayerControls = { loadVideo, play, pause, seekTo, setVolume, setSpeed };

  return { state, controls };
}
