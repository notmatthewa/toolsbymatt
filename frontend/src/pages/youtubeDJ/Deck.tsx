import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Button,
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
import type { PlayerControls, PlayerState } from "./useYouTubePlayer";

interface DeckProps {
  label: string;
  color: string;
  divId: string;
  state: PlayerState;
  controls: PlayerControls;
  effectiveVolume: number;
}

function fmt(s: number) {
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

// Timeline component with waveform-style visualization and loop handles
function Timeline({
  currentTime,
  duration,
  loopA,
  loopB,
  looping,
  color,
  onSeek,
  onLoopChange,
}: {
  currentTime: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  looping: boolean;
  color: string;
  onSeek: (t: number) => void;
  onLoopChange: (a: number | null, b: number | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"seek" | "loopA" | "loopB" | null>(null);

  const getTimeFromX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !duration) return 0;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!duration) return;
      const el = trackRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);

      const rect = el.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const time = pct * duration;

      // Check if near a loop handle (within 8px)
      const pxPerSec = rect.width / duration;
      if (loopA !== null && Math.abs(e.clientX - rect.left - (loopA / duration) * rect.width) < 8) {
        setDragging("loopA");
        return;
      }
      if (loopB !== null && Math.abs(e.clientX - rect.left - (loopB / duration) * rect.width) < 8) {
        setDragging("loopB");
        return;
      }

      setDragging("seek");
      onSeek(time);
    },
    [duration, loopA, loopB, onSeek]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const time = getTimeFromX(e.clientX);
      if (dragging === "seek") onSeek(time);
      else if (dragging === "loopA") onLoopChange(Math.min(time, (loopB ?? duration) - 0.5), loopB);
      else if (dragging === "loopB") onLoopChange(loopA, Math.max(time, (loopA ?? 0) + 0.5));
    },
    [dragging, getTimeFromX, onSeek, onLoopChange, loopA, loopB, duration]
  );

  const handlePointerUp = useCallback(() => setDragging(null), []);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const loopAPct = loopA !== null && duration ? (loopA / duration) * 100 : null;
  const loopBPct = loopB !== null && duration ? (loopB / duration) * 100 : null;

  // Generate a pseudo-waveform pattern (deterministic visual based on position)
  const bars = 80;

  return (
    <Box sx={{ px: 0.5, py: 1, userSelect: "none" }}>
      <Box
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        sx={{
          position: "relative",
          height: 40,
          bgcolor: "rgba(255,255,255,0.03)",
          borderRadius: 1,
          overflow: "hidden",
          cursor: "pointer",
          border: "1px solid",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        {/* Waveform-style bars */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            gap: "1px",
            px: "2px",
          }}
        >
          {Array.from({ length: bars }, (_, i) => {
            const pct = (i / bars) * 100;
            const played = pct < progressPct;
            // Pseudo-random height based on position
            const h = 30 + Math.abs(Math.sin(i * 0.7) * 50 + Math.cos(i * 1.3) * 30);
            return (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  height: `${Math.min(h, 90)}%`,
                  bgcolor: played ? color : "rgba(255,255,255,0.1)",
                  borderRadius: "1px",
                  transition: "background-color 0.1s",
                  opacity: played ? 0.8 : 0.4,
                }}
              />
            );
          })}
        </Box>

        {/* Loop region */}
        {loopAPct !== null && loopBPct !== null && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${loopAPct}%`,
              width: `${loopBPct - loopAPct}%`,
              bgcolor: looping ? `${color}22` : "rgba(255,255,255,0.05)",
              borderLeft: `2px solid ${looping ? color : "rgba(255,255,255,0.3)"}`,
              borderRight: `2px solid ${looping ? color : "rgba(255,255,255,0.3)"}`,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Loop handle A */}
        {loopAPct !== null && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${loopAPct}%`,
              width: 12,
              ml: "-6px",
              cursor: "ew-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3,
            }}
          >
            <Box
              sx={{
                width: 4,
                height: 16,
                bgcolor: looping ? color : "rgba(255,255,255,0.5)",
                borderRadius: 1,
              }}
            />
          </Box>
        )}

        {/* Loop handle B */}
        {loopBPct !== null && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${loopBPct}%`,
              width: 12,
              ml: "-6px",
              cursor: "ew-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3,
            }}
          >
            <Box
              sx={{
                width: 4,
                height: 16,
                bgcolor: looping ? color : "rgba(255,255,255,0.5)",
                borderRadius: 1,
              }}
            />
          </Box>
        )}

        {/* Playhead */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${progressPct}%`,
            width: 2,
            bgcolor: "#fff",
            zIndex: 4,
            pointerEvents: "none",
          }}
        />
      </Box>

      {/* Time display */}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          {fmt(currentTime)}
        </Typography>
        {loopA !== null && loopB !== null && (
          <Typography variant="caption" sx={{ fontSize: 10, color: looping ? color : "text.secondary" }}>
            Loop: {fmt(loopA)} → {fmt(loopB)}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          {fmt(duration)}
        </Typography>
      </Stack>
    </Box>
  );
}

export default function Deck({ label, color, divId, state, controls, effectiveVolume }: DeckProps) {
  const [urlInput, setUrlInput] = useState("");
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [looping, setLooping] = useState(false);
  const [cues, setCues] = useState<(number | null)[]>([null, null, null, null]);
  const loopRef = useRef({ looping, loopA, loopB });

  useEffect(() => {
    loopRef.current = { looping, loopA, loopB };
  }, [looping, loopA, loopB]);

  // Loop enforcement
  useEffect(() => {
    const { looping, loopA, loopB } = loopRef.current;
    if (looping && loopA !== null && loopB !== null && state.currentTime >= loopB) {
      controls.seekTo(loopA);
    }
  }, [state.currentTime, controls]);

  // Apply effective volume
  useEffect(() => {
    controls.setVolume(effectiveVolume);
  }, [effectiveVolume, controls]);

  const load = () => {
    const id = extractVideoId(urlInput);
    if (id) controls.loadVideo(id);
  };

  const handleLoopChange = useCallback((a: number | null, b: number | null) => {
    setLoopA(a);
    setLoopB(b);
  }, []);

  const setLoopFromCurrent = () => {
    if (loopA === null) {
      setLoopA(state.currentTime);
    } else if (loopB === null) {
      const b = state.currentTime;
      if (b > loopA) {
        setLoopB(b);
        setLooping(true);
      }
    } else {
      // Reset
      setLoopA(null);
      setLoopB(null);
      setLooping(false);
    }
  };

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
      {/* Header */}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
          sx={{ flex: 1 }}
          slotProps={{ input: { sx: { fontSize: 13 } } }}
        />
        <Button size="small" variant="outlined" onClick={load} sx={{ minWidth: 50 }}>
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
        <Box
          id={divId}
          sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
      </Box>

      {/* Title */}
      {state.title && (
        <Typography variant="body2" noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
          {state.title}
        </Typography>
      )}

      {/* Timeline with waveform + loop handles */}
      <Timeline
        currentTime={state.currentTime}
        duration={state.duration}
        loopA={loopA}
        loopB={loopB}
        looping={looping}
        color={color}
        onSeek={controls.seekTo}
        onLoopChange={handleLoopChange}
      />

      {/* Transport + Loop */}
      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
        <IconButton
          size="small"
          onClick={() => (state.playing ? controls.pause() : controls.play())}
          sx={{ color }}
        >
          {state.playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <IconButton size="small" onClick={() => controls.seekTo(0)} sx={{ color: "text.secondary" }}>
          <ReplayIcon fontSize="small" />
        </IconButton>
        <Box sx={{ width: 8 }} />
        <IconButton
          size="small"
          onClick={setLoopFromCurrent}
          sx={{
            color: looping ? color : loopA !== null ? "warning.main" : "text.secondary",
            bgcolor: looping ? `${color}22` : undefined,
          }}
          title={
            loopA === null
              ? "Set loop start"
              : loopB === null
                ? "Set loop end"
                : "Clear loop"
          }
        >
          <RepeatIcon fontSize="small" />
        </IconButton>
        {loopA !== null && loopB !== null && (
          <Button
            size="small"
            variant={looping ? "contained" : "outlined"}
            color={looping ? "success" : "inherit"}
            onClick={() => setLooping(!looping)}
            sx={{ fontSize: 10, px: 1, minWidth: 0 }}
          >
            {looping ? "ON" : "OFF"}
          </Button>
        )}
      </Stack>

      {/* Speed */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
        <SpeedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Slider
          value={state.speed}
          min={0.25}
          max={2}
          step={null}
          marks={state.availableSpeeds.map((v) => ({ value: v }))}
          onChange={(_, v) => controls.setSpeed(v as number)}
          size="small"
          sx={{ flex: 1, color }}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}x`}
        />
        <Typography variant="caption" sx={{ minWidth: 32, textAlign: "right" }}>
          {state.speed}x
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
            onContextMenu={(e) => {
              e.preventDefault();
              clearCue(i);
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 10,
              px: 0.5,
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
