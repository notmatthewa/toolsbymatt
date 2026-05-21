import { useEffect } from "react";
import { AppBar, Toolbar, Typography, Box, ButtonBase } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

interface NavBarProps {
  onSearchOpen: () => void;
}

export default function NavBar({ onSearchOpen }: NavBarProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onSearchOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSearchOpen]);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              background: "linear-gradient(135deg, #818cf8, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
              color: "white",
            }}
          >
            M
          </Box>
          <Typography
            variant="h6"
            sx={{ fontSize: 18, letterSpacing: "-0.02em" }}
          >
            toolsbymatt.com
          </Typography>
        </Box>

        <ButtonBase
          onClick={onSearchOpen}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 0.75,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            color: "text.secondary",
            fontSize: 14,
            transition: "border-color 0.2s",
            "&:hover": { borderColor: "rgba(129, 140, 248, 0.3)" },
          }}
        >
          <SearchIcon sx={{ fontSize: 18 }} />
          <span>Search...</span>
          <Box
            component="kbd"
            sx={{
              ml: 1,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: "rgba(148, 163, 184, 0.08)",
              border: "1px solid rgba(148, 163, 184, 0.15)",
              fontSize: 11,
              fontFamily: "inherit",
              color: "text.secondary",
            }}
          >
            {"\u2318"}K
          </Box>
        </ButtonBase>
      </Toolbar>
    </AppBar>
  );
}
