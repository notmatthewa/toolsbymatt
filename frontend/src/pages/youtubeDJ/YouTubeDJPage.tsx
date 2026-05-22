import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Container,
  Paper,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import Deck from "./Deck";
import KeybindsPanel from "./KeybindsPanel";
import { useLocalPlayer } from "./useLocalPlayer";
import { loadKeybinds, type KeyBinds } from "./keybinds";

const COLOR_A = "#818cf8";
const COLOR_B = "#34d399";

export default function YouTubeDJPage() {
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const deckA = useLocalPlayer(videoRefA);
  const deckB = useLocalPlayer(videoRefB);
  const [crossfader, setCrossfader] = useState(0);
  const [volumeA, setVolumeA] = useState(100);
  const [volumeB, setVolumeB] = useState(100);
  const [keybinds, setKeybinds] = useState<KeyBinds>(loadKeybinds);

  // Refs for deck callbacks so keyboard handler doesn't need to re-bind
  const deckARef = useRef(deckA);
  const deckBRef = useRef(deckB);
  const cueCallbacksRef = useRef<{
    toggleCueA: (i: number) => void;
    toggleCueB: (i: number) => void;
    loopA: () => void;
    loopB: () => void;
  }>({
    toggleCueA: () => {},
    toggleCueB: () => {},
    loopA: () => {},
    loopB: () => {},
  });

  useEffect(() => { deckARef.current = deckA; }, [deckA]);
  useEffect(() => { deckBRef.current = deckB; }, [deckB]);

  // Expose cue/loop callbacks from Deck components
  const registerCallbacks = useCallback((
    toggleCueA: (i: number) => void,
    toggleCueB: (i: number) => void,
    loopA: () => void,
    loopB: () => void,
  ) => {
    cueCallbacksRef.current = { toggleCueA, toggleCueB, loopA, loopB };
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const kb = keybinds;
      const a = deckARef.current;
      const b = deckBRef.current;
      const cbs = cueCallbacksRef.current;

      if (key === kb.playA) { a.state.playing ? a.controls.pause() : a.controls.play(); e.preventDefault(); }
      else if (key === kb.playB) { b.state.playing ? b.controls.pause() : b.controls.play(); e.preventDefault(); }
      else if (key === kb.cueA1) { cbs.toggleCueA(0); e.preventDefault(); }
      else if (key === kb.cueA2) { cbs.toggleCueA(1); e.preventDefault(); }
      else if (key === kb.cueA3) { cbs.toggleCueA(2); e.preventDefault(); }
      else if (key === kb.cueA4) { cbs.toggleCueA(3); e.preventDefault(); }
      else if (key === kb.cueB1) { cbs.toggleCueB(0); e.preventDefault(); }
      else if (key === kb.cueB2) { cbs.toggleCueB(1); e.preventDefault(); }
      else if (key === kb.cueB3) { cbs.toggleCueB(2); e.preventDefault(); }
      else if (key === kb.cueB4) { cbs.toggleCueB(3); e.preventDefault(); }
      else if (key === kb.loopA) { cbs.loopA(); e.preventDefault(); }
      else if (key === kb.loopB) { cbs.loopB(); e.preventDefault(); }
      else if (key === kb.crossLeft) { setCrossfader(-100); e.preventDefault(); }
      else if (key === kb.crossCenter) { setCrossfader(0); e.preventDefault(); }
      else if (key === kb.crossRight) { setCrossfader(100); e.preventDefault(); }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keybinds]);

  const effectiveA = useMemo(
    () => Math.round(volumeA * Math.min(1, (100 - crossfader) / 100)),
    [volumeA, crossfader]
  );
  const effectiveB = useMemo(
    () => Math.round(volumeB * Math.min(1, (100 + crossfader) / 100)),
    [volumeB, crossfader]
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3, flex: 1, display: "flex", flexDirection: "column" }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="h4" sx={{ flex: 1 }}>
          YouTube DJ
        </Typography>
        <KeybindsPanel binds={keybinds} onChange={setKeybinds} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Load two YouTube videos and mix them live. Videos are downloaded for instant seek and zero buffering.
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          flex: 1,
          minHeight: 0,
        }}
      >
        <Deck
          label="DECK A"
          color={COLOR_A}
          videoRef={videoRefA}
          state={deckA.state}
          controls={deckA.controls}
          effectiveVolume={effectiveA}
          registerCallbacks={(toggleCue, loop) => {
            cueCallbacksRef.current.toggleCueA = toggleCue;
            cueCallbacksRef.current.loopA = loop;
          }}
        />

        {/* Center controls */}
        <Paper
          variant="outlined"
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            p: 2,
            minWidth: { md: 160 },
          }}
        >
          <Stack alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ color: COLOR_A, fontWeight: 700 }}>
              VOL A
            </Typography>
            <Slider
              value={volumeA}
              onChange={(_, v) => setVolumeA(v as number)}
              orientation="vertical"
              size="small"
              sx={{ height: 80, color: COLOR_A }}
            />
          </Stack>

          <Stack alignItems="center" spacing={0.5} sx={{ width: "100%" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              CROSSFADER
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
              <Typography variant="caption" sx={{ color: COLOR_A, fontWeight: 700 }}>A</Typography>
              <Slider
                value={crossfader}
                min={-100}
                max={100}
                onChange={(_, v) => setCrossfader(v as number)}
                size="small"
                sx={{ color: "grey.500" }}
              />
              <Typography variant="caption" sx={{ color: COLOR_B, fontWeight: 700 }}>B</Typography>
            </Stack>
          </Stack>

          <Stack alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ color: COLOR_B, fontWeight: 700 }}>
              VOL B
            </Typography>
            <Slider
              value={volumeB}
              onChange={(_, v) => setVolumeB(v as number)}
              orientation="vertical"
              size="small"
              sx={{ height: 80, color: COLOR_B }}
            />
          </Stack>
        </Paper>

        <Deck
          label="DECK B"
          color={COLOR_B}
          videoRef={videoRefB}
          state={deckB.state}
          controls={deckB.controls}
          effectiveVolume={effectiveB}
          registerCallbacks={(toggleCue, loop) => {
            cueCallbacksRef.current.toggleCueB = toggleCue;
            cueCallbacksRef.current.loopB = loop;
          }}
        />
      </Box>
    </Container>
  );
}
