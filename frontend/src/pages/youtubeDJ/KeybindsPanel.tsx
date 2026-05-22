import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import type { KeyBinds } from "./keybinds";
import { BIND_LABELS, DEFAULT_KEYBINDS, saveKeybinds } from "./keybinds";

interface Props {
  binds: KeyBinds;
  onChange: (binds: KeyBinds) => void;
}

const GROUPS: { label: string; color: string; keys: (keyof KeyBinds)[] }[] = [
  { label: "Deck A", color: "#818cf8", keys: ["playA", "cueA1", "cueA2", "cueA3", "cueA4", "loopA"] },
  { label: "Deck B", color: "#34d399", keys: ["playB", "cueB1", "cueB2", "cueB3", "cueB4", "loopB"] },
  { label: "Mixer", color: "#94a3b8", keys: ["crossLeft", "crossCenter", "crossRight"] },
];

export default function KeybindsPanel({ binds, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<keyof KeyBinds | null>(null);
  const [draft, setDraft] = useState<KeyBinds>(binds);

  const handleOpen = () => {
    setDraft({ ...binds });
    setOpen(true);
  };

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!editing) return;
    e.preventDefault();
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    setDraft((d) => ({ ...d, [editing]: key }));
    setEditing(null);
  };

  const handleSave = () => {
    saveKeybinds(draft);
    onChange(draft);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_KEYBINDS });
  };

  return (
    <>
      <IconButton size="small" onClick={handleOpen} title="Keyboard shortcuts" sx={{ color: "text.secondary" }}>
        <KeyboardIcon fontSize="small" />
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth onKeyDown={handleKeyCapture}>
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click a key to rebind, then press the new key.
          </Typography>
          <Stack spacing={2.5}>
            {GROUPS.map((group) => (
              <Box key={group.label}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: group.color, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {group.label}
                </Typography>
                <Stack spacing={0}>
                  {group.keys.map((k) => (
                    <Stack
                      key={k}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        py: 0.75, px: 1,
                        borderRadius: 1,
                        "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontSize: 13, color: "text.secondary" }}>
                        {BIND_LABELS[k]}
                      </Typography>
                      <Box
                        onClick={() => setEditing(k)}
                        sx={{
                          minWidth: 36, px: 1, py: 0.25,
                          textAlign: "center",
                          fontSize: 13, fontWeight: 700, fontFamily: "monospace",
                          borderRadius: 1, cursor: "pointer",
                          color: editing === k ? "primary.main" : "text.primary",
                          bgcolor: editing === k ? "rgba(129,140,248,0.15)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${editing === k ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.1)"}`,
                          transition: "all 0.15s",
                          "&:hover": { borderColor: "rgba(129,140,248,0.3)" },
                        }}
                      >
                        {editing === k ? "..." : draft[k].toUpperCase()}
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReset} color="inherit" size="small">
            Reset defaults
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
