import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Chip,
  Dialog,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { AppEntry } from "../types";
import { iconMap } from "../icons";

function getIcon(name: string) {
  const Icon = iconMap[name];
  return Icon ? <Icon sx={{ fontSize: 24, color: "primary.main" }} /> : null;
}

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<AppEntry[]>;
}

export default function SearchDialog({ open, onClose, onSearch }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AppEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      onSearch("").then(setResults);
    }
  }, [open, onSearch]);

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(query).then((r) => {
        setResults(r);
        setSelected(0);
      });
    }, 80);
    return () => clearTimeout(timerRef.current);
  }, [query, onSearch]);

  // Scroll selected item into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const navigate = useCallback(
    (app: AppEntry) => {
      onClose();
      window.location.href = app.url;
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selected]) {
        navigate(results[selected]);
      }
    },
    [results, selected, navigate]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: 560,
            maxHeight: "70vh",
            borderRadius: 3,
            overflow: "hidden",
          },
        },
      }}
    >
      {/* Search input */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <SearchIcon sx={{ color: "text.secondary" }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Search apps, tags..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ fontSize: 16 }}
        />
        <Box
          component="kbd"
          sx={{
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: "rgba(148, 163, 184, 0.08)",
            border: "1px solid rgba(148, 163, 184, 0.15)",
            fontSize: 11,
            color: "text.secondary",
            whiteSpace: "nowrap",
          }}
        >
          ESC
        </Box>
      </Box>

      {/* Results */}
      <Box ref={listRef} sx={{ overflow: "auto", maxHeight: "calc(70vh - 64px)" }}>
        {results.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ py: 4, textAlign: "center" }}
          >
            No results found
          </Typography>
        ) : (
          results.map((app, index) => (
            <Box
              key={app.id}
              onClick={() => navigate(app)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 2.5,
                py: 1.5,
                cursor: "pointer",
                bgcolor:
                  index === selected
                    ? "rgba(129, 140, 248, 0.1)"
                    : "transparent",
                "&:hover": { bgcolor: "rgba(129, 140, 248, 0.06)" },
                borderBottom:
                  index < results.length - 1
                    ? "1px solid rgba(148, 163, 184, 0.06)"
                    : "none",
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: "rgba(129, 140, 248, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {getIcon(app.icon)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 600, fontSize: 14 }}
                >
                  {app.name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: 13 }}
                  noWrap
                >
                  {app.description}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                {app.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      bgcolor: "rgba(129, 140, 248, 0.1)",
                      color: "primary.light",
                    }}
                  />
                ))}
              </Stack>
            </Box>
          ))
        )}
      </Box>
    </Dialog>
  );
}
