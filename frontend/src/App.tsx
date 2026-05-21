import { useEffect, useState } from "react";
import { Box, Container, Typography, Grid } from "@mui/material";
import NavBar from "./components/NavBar";
import SearchDialog from "./components/SearchDialog";
import AppCard from "./components/AppCard";
import type { AppEntry } from "./types";

export default function App() {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.json())
      .then((data) => setApps(data.apps));
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <NavBar onSearchOpen={() => setSearchOpen(true)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Apps
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Tools, experiments, and other things I've built.
        </Typography>
        <Grid container spacing={3}>
          {apps.map((app) => (
            <Grid key={app.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <AppCard app={app} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
