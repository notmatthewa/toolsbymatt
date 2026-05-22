import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";

const LABELS: Record<string, string> = {
  images: "Extract Images",
  png: "PNG",
  jpg: "JPG",
  webp: "WebP",
  pdf: "PDF",
};

export default function FileConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState("");

  // Query available formats when file changes
  useEffect(() => {
    if (!file) {
      setOptions([]);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    fetch(`/api/convert/formats?ext=${encodeURIComponent(ext)}`)
      .then((r) => r.json())
      .then((data) => {
        setOptions(data.options || []);
        setTarget(data.options?.[0] || "");
      })
      .catch(() => {
        setOptions([]);
        setError("Could not determine conversion options");
      });
  }, [file]);

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
    setError("");
    setResultUrl(null);
  }, []);

  const convert = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResultUrl(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`/api/convert?target=${target}`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.detail || `Error ${resp.status}`);
      }
      const blob = await resp.blob();
      const disposition = resp.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const name = match?.[1] || "converted";
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultName(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultName;
    a.click();
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        File Converter
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Convert documents and images between formats. Extract images from
        PowerPoint, Word, and PDF files.
      </Typography>

      {/* Drop zone */}
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: "center",
          cursor: "pointer",
          border: "2px dashed",
          borderColor: file ? "primary.main" : "divider",
          transition: "border-color 0.2s",
          "&:hover": { borderColor: "primary.main" },
          mb: 3,
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.onchange = () => {
            if (input.files?.[0]) handleFile(input.files[0]);
          };
          input.click();
        }}
      >
        <UploadFileIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
        {file ? (
          <Stack alignItems="center" spacing={1}>
            <Typography variant="body1" fontWeight={600}>
              {file.name}
            </Typography>
            <Chip
              label={`${(file.size / 1024 / 1024).toFixed(1)} MB`}
              size="small"
              variant="outlined"
            />
          </Stack>
        ) : (
          <Typography color="text.secondary">
            Drop any file here or click to browse
          </Typography>
        )}
      </Paper>

      {/* Options */}
      {file && options.length > 0 && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 0.5, display: "block" }}
            >
              Convert to
            </Typography>
            <ToggleButtonGroup
              value={target}
              exclusive
              onChange={(_, v) => v && setTarget(v)}
              size="small"
            >
              {options.map((opt) => (
                <ToggleButton key={opt} value={opt}>
                  {LABELS[opt] || opt.toUpperCase()}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Button
            variant="contained"
            onClick={convert}
            disabled={loading || !target}
            startIcon={
              loading ? <CircularProgress size={18} color="inherit" /> : undefined
            }
          >
            {loading ? "Converting..." : "Convert"}
          </Button>
        </Stack>
      )}

      {file && options.length === 0 && !error && (
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
          No conversions available for this file type.
        </Typography>
      )}

      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {resultUrl && (
        <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
            Ready!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {resultName}
          </Typography>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={download}>
            Download
          </Button>
        </Paper>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 4, lineHeight: 1.8 }}>
        <strong>Supported:</strong> PowerPoint (.pptx), Word (.docx), PDF,
        images (PNG, JPG, WebP, GIF, HEIC), and with LibreOffice installed:
        .doc, .odt, .rtf, .xls, .xlsx, .ods, .csv, .odp, Pages, Keynote,
        Numbers, and more.
      </Typography>
    </Container>
  );
}
