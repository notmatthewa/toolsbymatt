import { useState } from "react";
import {
  Box,
  Button,
  Chip,
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

  const groups: { label: string; keys: (keyof KeyBinds)[] }[] = [
    { label: "Deck A", keys: ["playA", "cueA1", "cueA2", "cueA3", "cueA4", "loopA"] },
    { label: "Deck B", keys: ["playB", "cueB1", "cueB2", "cueB3", "cueB4", "loopB"] },
    { label: "Crossfader", keys: ["crossLeft", "crossCenter", "crossRight"] },
  ];

  return (
    <>
      <IconButton size="small" onClick={handleOpen} title="Keyboard shortcuts" sx={{ color: "text.secondary" }}>
        <KeyboardIcon fontSize="small" />
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth onKeyDown={handleKeyCapture}>
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click a key to rebind it, then press the new key.
          </Typography>
          <Stack spacing={2}>
            {groups.map((group) => (
              <Box key={group.label}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, color: "text.secondary" }}>
                  {group.label}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {group.keys.map((k) => (
                    <Chip
                      key={k}
                      label={
                        <span>
                          {BIND_LABELS[k]}:{" "}
                          <strong>{editing === k ? "..." : draft[k].toUpperCase()}</strong>
                        </span>
                      }
                      variant={editing === k ? "filled" : "outlined"}
                      color={editing === k ? "primary" : "default"}
                      onClick={() => setEditing(k)}
                      sx={{ fontSize: 11 }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReset} color="inherit" size="small">
            Reset to defaults
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
