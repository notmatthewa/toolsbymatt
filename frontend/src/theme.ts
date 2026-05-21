import { createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#818cf8", light: "#a5b4fc", dark: "#6366f1" },
    secondary: { main: "#34d399", light: "#6ee7b7", dark: "#10b981" },
    background: { default: "#0a0e1a", paper: "#111827" },
    text: { primary: "#e2e8f0", secondary: "#94a3b8" },
    divider: "rgba(148, 163, 184, 0.12)",
  },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(148, 163, 184, 0.08)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
        sizeSmall: {
          height: 22,
          "& .MuiChip-label": { padding: "0 8px" },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: "#1e293b",
          border: "1px solid rgba(148, 163, 184, 0.12)",
        },
      },
    },
  },
});

export default theme;
