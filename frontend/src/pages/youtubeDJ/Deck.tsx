import { useState, useEffect, useRef } from "react";
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

// Extract YouTube video ID from various URL formats
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
        gap: 1,
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
          paddingTop: "56.25%", // 16:9
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

      {/* Progress */}
      <Box sx={{ px: 0.5 }}>
        <Slider
          value={state.duration ? state.currentTime : 0}
          max={state.duration || 1}
          onChange={(_, v) => controls.seekTo(v as number)}
          size="small"
          sx={{
            color,
            "& .MuiSlider-thumb": { width: 10, height: 10 },
            py: 0.5,
          }}
        />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {fmt(state.currentTime)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {fmt(state.duration)}
          </Typography>
        </Stack>
      </Box>

      {/* Transport */}
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

      {/* Loop */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Button
          size="small"
          variant={loopA !== null ? "contained" : "outlined"}
          onClick={() => setLoopA(loopA !== null ? null : state.currentTime)}
          sx={{ minWidth: 32, fontSize: 11, px: 1 }}
        >
          A
        </Button>
        <Button
          size="small"
          variant={loopB !== null ? "contained" : "outlined"}
          onClick={() => setLoopB(loopB !== null ? null : state.currentTime)}
          sx={{ minWidth: 32, fontSize: 11, px: 1 }}
        >
          B
        </Button>
        <Button
          size="small"
          variant={looping ? "contained" : "outlined"}
          color={looping ? "success" : "inherit"}
          disabled={loopA === null || loopB === null}
          onClick={() => setLooping(!looping)}
          sx={{ fontSize: 11, px: 1 }}
        >
          Loop {looping ? "ON" : "OFF"}
        </Button>
        {loopA !== null && loopB !== null && (
          <Typography variant="caption" color="text.secondary">
            {fmt(loopA)} → {fmt(loopB)}
          </Typography>
        )}
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
