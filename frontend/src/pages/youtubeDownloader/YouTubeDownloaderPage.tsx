import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  id: string;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function YouTubeDownloaderPage() {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [format, setFormat] = useState<"mp3" | "mp4">("mp3");
  const [quality, setQuality] = useState("1080");

  const fetchInfo = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setInfo(null);
    try {
      const resp = await fetch(`/api/yt/info?url=${encodeURIComponent(url)}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.detail || `Error ${resp.status}`);
      }
      setInfo(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch video info");
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!info) return;
    setDownloading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        url,
        format,
        ...(format === "mp4" ? { quality } : {}),
      });
      const resp = await fetch(`/api/yt/download?${params}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.detail || `Error ${resp.status}`);
      }
      const blob = await resp.blob();
      const ext = format === "mp3" ? "mp3" : "mp4";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${info.title}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        YouTube Downloader
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Download YouTube videos as MP3 audio or MP4 video
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Paste YouTube URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") fetchInfo();
          }}
        />
        <Button variant="contained" onClick={fetchInfo} disabled={loading || !url.trim()}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Go"}
        </Button>
      </Stack>

      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {info && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box
              component="img"
              src={info.thumbnail}
              alt={info.title}
              sx={{
                width: { xs: "100%", sm: 200 },
                borderRadius: 1,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
            <Stack spacing={2} sx={{ flex: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {info.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDuration(info.duration)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                  Format
                </Typography>
                <ToggleButtonGroup
                  value={format}
                  exclusive
                  onChange={(_, v) => v && setFormat(v)}
                  size="small"
                >
                  <ToggleButton value="mp3">MP3</ToggleButton>
                  <ToggleButton value="mp4">MP4</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {format === "mp4" && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                    Quality
                  </Typography>
                  <ToggleButtonGroup
                    value={quality}
                    exclusive
                    onChange={(_, v) => v && setQuality(v)}
                    size="small"
                  >
                    <ToggleButton value="2160">4K</ToggleButton>
                    <ToggleButton value="1080">1080p</ToggleButton>
                    <ToggleButton value="720">720p</ToggleButton>
                    <ToggleButton value="480">480p</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              )}

              <Button
                variant="contained"
                startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                onClick={download}
                disabled={downloading}
                sx={{ alignSelf: "flex-start" }}
              >
                {downloading ? "Preparing..." : `Download ${format.toUpperCase()}`}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Container>
  );
}
