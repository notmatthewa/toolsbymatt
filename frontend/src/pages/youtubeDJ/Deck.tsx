import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ReplayIcon from "@mui/icons-material/Replay";
import SpeedIcon from "@mui/icons-material/Speed";
import RepeatIcon from "@mui/icons-material/Repeat";
import type { PlayerControls, PlayerState } from "./useLocalPlayer";

interface DeckProps {
  label: string;
  color: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  state: PlayerState;
  controls: PlayerControls;
  effectiveVolume: number;
  registerCallbacks?: (
    toggleCue: (i: number) => void,
    loop: () => void,
  ) => void;
}

function fmt(s: number) {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function extractVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.trim().match(p);
    if (m) return m[1];
  }
  return null;
}

const ORANGE = "#fb923c";
const ORANGE_ACTIVE = "#f97316";

function Timeline({
  currentTime,
  duration,
  loopStart,
  loopEnd,
  looping,
  color,
  waveform,
  audioLevel,
  onSeek,
  onLoopChange,
}: {
  currentTime: number;
  duration: number;
  loopStart: number;
  loopEnd: number;
  looping: boolean;
  color: string;
  waveform: number[] | null;
  audioLevel: number;
  onSeek: (t: number) => void;
  onLoopChange: (start: number, end: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"seek" | "loopA" | "loopB" | null>(null);

  // Zoom: visible time window
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(0);

  // Reset view when duration changes
  useEffect(() => {
    if (duration > 0) { setViewStart(0); setViewEnd(duration); }
  }, [duration]);

  const viewDur = (viewEnd || duration) - viewStart;
  const isZoomed = duration > 0 && viewDur < duration - 0.1;

  // Map time to percentage within the visible window
  const timeToPct = useCallback(
    (t: number) => viewDur > 0 ? ((t - viewStart) / viewDur) * 100 : 0,
    [viewStart, viewDur]
  );

  // Map clientX to time within visible window
  const getTimeFromX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !viewDur) return 0;
      const rect = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.max(0, Math.min(duration, viewStart + frac * viewDur));
    },
    [viewStart, viewDur, duration]
  );

  // Scroll to zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!duration || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const mouseFrac = (e.clientX - rect.left) / rect.width;
      const mouseTime = viewStart + mouseFrac * viewDur;

      const zoomFactor = e.deltaY > 0 ? 1.3 : 0.7; // scroll down = zoom out
      const newDur = Math.max(2, Math.min(duration, viewDur * zoomFactor));

      // Keep mouseTime at the same screen fraction
      let newStart = mouseTime - mouseFrac * newDur;
      let newEnd = mouseTime + (1 - mouseFrac) * newDur;

      // Clamp
      if (newStart < 0) { newEnd -= newStart; newStart = 0; }
      if (newEnd > duration) { newStart -= newEnd - duration; newEnd = duration; }
      newStart = Math.max(0, newStart);

      setViewStart(newStart);
      setViewEnd(newEnd);
    },
    [duration, viewStart, viewDur]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!duration) return;
      const el = trackRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();

      // Check loop handles in pixel space (within 12px)
      const loopAPx = timeToPct(loopStart) / 100 * rect.width + rect.left;
      const loopBPx = timeToPct(loopEnd) / 100 * rect.width + rect.left;
      if (Math.abs(e.clientX - loopAPx) < 12) { setDragging("loopA"); return; }
      if (Math.abs(e.clientX - loopBPx) < 12) { setDragging("loopB"); return; }

      setDragging("seek");
      onSeek(getTimeFromX(e.clientX));
    },
    [duration, loopStart, loopEnd, onSeek, getTimeFromX, timeToPct]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const t = getTimeFromX(e.clientX);
      if (dragging === "seek") onSeek(t);
      else if (dragging === "loopA") onLoopChange(Math.min(t, loopEnd - 0.5), loopEnd);
      else if (dragging === "loopB") onLoopChange(loopStart, Math.max(t, loopStart + 0.5));
    },
    [dragging, getTimeFromX, onSeek, onLoopChange, loopStart, loopEnd]
  );

  const handlePointerUp = useCallback(() => setDragging(null), []);

  const progressPct = timeToPct(currentTime);
  const startPct = timeToPct(loopStart);
  const endPct = timeToPct(loopEnd || duration);

  // Waveform bars — sample from the visible window
  const BARS = 100;
  const bars = waveform
    ? Array.from({ length: BARS }, (_, i) => {
        const tStart = viewStart + (i / BARS) * viewDur;
        const tEnd = viewStart + ((i + 1) / BARS) * viewDur;
        const srcStart = Math.floor((tStart / duration) * waveform.length);
        const srcEnd = Math.ceil((tEnd / duration) * waveform.length);
        let max = 0;
        for (let j = Math.max(0, srcStart); j < Math.min(srcEnd, waveform.length); j++) {
          if (waveform[j] > max) max = waveform[j];
        }
        return max;
      })
    : null;

  const handleColor = looping ? ORANGE_ACTIVE : ORANGE;
  const regionBg = looping ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.08)";

  return (
    <Box sx={{ px: 0.5, py: 0.5, userSelect: "none" }}>
      <Box
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        sx={{
          position: "relative",
          height: 56,
          bgcolor: "rgba(255,255,255,0.02)",
          borderRadius: 1,
          overflow: "hidden",
          cursor: "pointer",
          border: "1px solid",
          borderColor: isZoomed ? `${color}44` : "rgba(255,255,255,0.1)",
        }}
      >
        {/* Waveform bars */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            gap: "1.5px",
            px: "3px",
          }}
        >
          {Array.from({ length: BARS }, (_, i) => {
            const pct = (i / BARS) * 100;
            const played = pct < progressPct;
            const h = bars
              ? Math.max(6, bars[i] * 98)
              : 20 + Math.abs(Math.sin(i * 0.7) * 40 + Math.cos(i * 1.3) * 25);
            return (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  height: `${Math.min(h, 98)}%`,
                  bgcolor: played ? color : "rgba(255,255,255,0.15)",
                  borderRadius: "2px",
                  opacity: played ? 1 : 0.5,
                }}
              />
            );
          })}
        </Box>

        {/* Loop region overlay — always visible */}
        {startPct < 100 && endPct > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: 0, bottom: 0,
              left: `${Math.max(0, startPct)}%`,
              width: `${Math.min(100, endPct) - Math.max(0, startPct)}%`,
              bgcolor: regionBg,
              borderLeft: startPct >= 0 ? `2px solid ${handleColor}` : "none",
              borderRight: endPct <= 100 ? `2px solid ${handleColor}` : "none",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Loop handle A */}
        {startPct >= -5 && startPct <= 105 && (
          <Box
            sx={{
              position: "absolute", top: 0, bottom: 0,
              left: `${startPct}%`, width: 20, ml: "-10px",
              cursor: "ew-resize", display: "flex", alignItems: "center",
              justifyContent: "center", zIndex: 3,
            }}
          >
            <Box sx={{
              width: 6, height: "60%", borderRadius: 1,
              bgcolor: handleColor,
              boxShadow: looping ? `0 0 8px ${ORANGE}` : `0 0 4px rgba(251,146,60,0.3)`,
            }} />
          </Box>
        )}

        {/* Loop handle B */}
        {endPct >= -5 && endPct <= 105 && (
          <Box
            sx={{
              position: "absolute", top: 0, bottom: 0,
              left: `${endPct}%`, width: 20, ml: "-10px",
              cursor: "ew-resize", display: "flex", alignItems: "center",
              justifyContent: "center", zIndex: 3,
            }}
          >
            <Box sx={{
              width: 6, height: "60%", borderRadius: 1,
              bgcolor: handleColor,
              boxShadow: looping ? `0 0 8px ${ORANGE}` : `0 0 4px rgba(251,146,60,0.3)`,
            }} />
          </Box>
        )}

        {/* Playhead */}
        {progressPct >= 0 && progressPct <= 100 && (
          <Box sx={{
            position: "absolute", top: 0, bottom: 0,
            left: `${progressPct}%`, width: 2,
            bgcolor: "#fff", zIndex: 4, pointerEvents: "none",
            boxShadow: "0 0 4px rgba(255,255,255,0.5)",
          }} />
        )}
      </Box>

      {/* Time display */}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          {fmt(currentTime)}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: 10, color: ORANGE }}>
          {fmt(loopStart)}→{fmt(loopEnd || duration)}
        </Typography>
        {isZoomed && (
          <Typography
            variant="caption"
            sx={{ fontSize: 10, color: color, cursor: "pointer" }}
            onClick={() => { setViewStart(0); setViewEnd(duration); }}
          >
            Reset zoom
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          {fmt(duration)}
        </Typography>
      </Stack>
    </Box>
  );
}

export default function Deck({ label, color, videoRef, state, controls, effectiveVolume, registerCallbacks }: DeckProps) {
  const [urlInput, setUrlInput] = useState("");
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [looping, setLooping] = useState(false);
  const [cues, setCues] = useState<(number | null)[]>([null, null, null, null]);
  const loopRef = useRef({ looping, loopStart, loopEnd });
  const effectiveVolumeRef = useRef(effectiveVolume);

  useEffect(() => {
    loopRef.current = { looping, loopStart, loopEnd };
  }, [looping, loopStart, loopEnd]);

  // Initialize loop end to full duration when video loads
  useEffect(() => {
    if (state.duration > 0 && loopEnd === 0) {
      setLoopEnd(state.duration);
    }
  }, [state.duration, loopEnd]);

  useEffect(() => {
    effectiveVolumeRef.current = effectiveVolume;
    controls.setVolume(effectiveVolume);
  }, [effectiveVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loop enforcement
  useEffect(() => {
    const { looping, loopStart, loopEnd } = loopRef.current;
    if (looping && loopEnd > loopStart && state.currentTime >= loopEnd) {
      controls.seekTo(loopStart);
    }
  }, [state.currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    const id = extractVideoId(urlInput);
    if (!id) return;
    setLoopStart(0);
    setLoopEnd(0);
    setLooping(false);
    setCues([null, null, null, null]);
    controls.loadVideo(urlInput);
  };

  const handleLoopChange = useCallback((start: number, end: number) => {
    setLoopStart(start);
    setLoopEnd(end);
  }, []);

  const toggleLooping = () => setLooping(!looping);

  const toggleCue = (i: number) => {
    const c = [...cues];
    if (c[i] !== null) {
      controls.seekTo(c[i]!);
    } else {
      c[i] = state.currentTime;
      setCues(c);
    }
  };

  const clearCue = (i: number) => {
    const c = [...cues];
    c[i] = null;
    setCues(c);
  };

  // Expose callbacks for keyboard shortcuts
  useEffect(() => {
    registerCallbacks?.(toggleCue, toggleLooping);
  }); // intentionally no deps

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        flex: 1,
        minWidth: 0,
        borderColor: color,
        borderWidth: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ color, fontWeight: 700 }}>
        {label}
      </Typography>

      {/* URL Input */}
      <Stack direction="row" spacing={0.5}>
        <TextField
          size="small"
          placeholder="YouTube URL..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          sx={{ flex: 1 }}
          slotProps={{ input: { sx: { fontSize: 13 } } }}
          disabled={state.loading}
        />
        <Button size="small" variant="outlined" onClick={load} sx={{ minWidth: 50 }} disabled={state.loading}>
          Load
        </Button>
      </Stack>

      {/* Video Player */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          paddingTop: "56.25%",
          bgcolor: "#000",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          style={{
            position: "absolute",
            top: 0, left: 0, width: "100%", height: "100%",
            objectFit: "contain",
          }}
          playsInline
        />
        {state.loading && (
          <Box
            sx={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              bgcolor: "rgba(0,0,0,0.7)", gap: 1,
            }}
          >
            <CircularProgress size={32} sx={{ color }} />
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 12 }}>
              {state.loadingProgress}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Title */}
      {state.title && (
        <Typography variant="body2" noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
          {state.title}
        </Typography>
      )}

      {/* Timeline with always-visible loop handles */}
      <Timeline
        currentTime={state.currentTime}
        duration={state.duration}
        loopStart={loopStart}
        loopEnd={loopEnd || state.duration}
        looping={looping}
        color={color}
        waveform={state.waveform}
        audioLevel={state.audioLevel}
        onSeek={controls.seekTo}
        onLoopChange={handleLoopChange}
      />

      {/* Transport + Loop toggle */}
      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
        <IconButton
          size="small"
          onClick={() => (state.playing ? controls.pause() : controls.play())}
          sx={{ color }}
          disabled={!state.videoId || state.loading}
        >
          {state.playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <IconButton size="small" onClick={() => controls.seekTo(0)} sx={{ color: "text.secondary" }}>
          <ReplayIcon fontSize="small" />
        </IconButton>
        <Box sx={{ width: 8 }} />
        <Button
          size="small"
          variant={looping ? "contained" : "outlined"}
          startIcon={<RepeatIcon sx={{ fontSize: 14 }} />}
          onClick={toggleLooping}
          sx={{
            fontSize: 11, px: 1.5,
            bgcolor: looping ? ORANGE_ACTIVE : undefined,
            borderColor: ORANGE,
            color: looping ? "#000" : ORANGE,
            "&:hover": { bgcolor: looping ? ORANGE : `${ORANGE}22` },
          }}
        >
          {looping ? "LOOP ON" : "LOOP"}
        </Button>
      </Stack>

      {/* Speed */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
        <SpeedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Slider
          value={state.speed}
          min={0.25}
          max={2}
          step={0.05}
          onChange={(_, v) => controls.setSpeed(v as number)}
          size="small"
          sx={{ flex: 1, color }}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v.toFixed(2)}x`}
        />
        <Typography variant="caption" sx={{ minWidth: 38, textAlign: "right" }}>
          {state.speed.toFixed(2)}x
        </Typography>
      </Stack>

      {/* Cue Points */}
      <Stack direction="row" spacing={0.5}>
        {cues.map((c, i) => (
          <Button
            key={i}
            size="small"
            variant={c !== null ? "contained" : "outlined"}
            onClick={() => toggleCue(i)}
            onContextMenu={(e) => { e.preventDefault(); clearCue(i); }}
            sx={{
              flex: 1, minWidth: 0, fontSize: 10, px: 0.5,
              bgcolor: c !== null ? color : undefined,
              borderColor: color,
              "&:hover": { bgcolor: c !== null ? color : undefined, opacity: 0.8 },
            }}
          >
            CUE {i + 1}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
}
