import { useMemo, useState } from "react";
import {
  Box,
  Container,
  Paper,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import Deck from "./Deck";
import { useYouTubePlayer } from "./useYouTubePlayer";

const COLOR_A = "#818cf8";
const COLOR_B = "#34d399";

export default function YouTubeDJPage() {
  const deckA = useYouTubePlayer("yt-deck-a");
  const deckB = useYouTubePlayer("yt-deck-b");
  const [crossfader, setCrossfader] = useState(0);
  const [volumeA, setVolumeA] = useState(100);
  const [volumeB, setVolumeB] = useState(100);

  // Crossfader multiplier: at 0 both full, at -100 only A, at 100 only B
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
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        YouTube DJ
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Load two YouTube videos and mix them live
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
        {/* Deck A */}
        <Deck
          label="DECK A"
          color={COLOR_A}
          divId="yt-deck-a"
          state={deckA.state}
          controls={deckA.controls}
          effectiveVolume={effectiveA}
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
          {/* Volume A */}
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

          {/* Crossfader */}
          <Stack alignItems="center" spacing={0.5} sx={{ width: "100%" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              CROSSFADER
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
              <Typography variant="caption" sx={{ color: COLOR_A, fontWeight: 700 }}>
                A
              </Typography>
              <Slider
                value={crossfader}
                min={-100}
                max={100}
                onChange={(_, v) => setCrossfader(v as number)}
                size="small"
                sx={{ color: "grey.500" }}
              />
              <Typography variant="caption" sx={{ color: COLOR_B, fontWeight: 700 }}>
                B
              </Typography>
            </Stack>
          </Stack>

          {/* Volume B */}
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

        {/* Deck B */}
        <Deck
          label="DECK B"
          color={COLOR_B}
          divId="yt-deck-b"
          state={deckB.state}
          controls={deckB.controls}
          effectiveVolume={effectiveB}
        />
      </Box>
    </Container>
  );
}
