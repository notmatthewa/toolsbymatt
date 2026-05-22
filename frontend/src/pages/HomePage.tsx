import { useEffect, useState } from "react";
import { Container, Typography, Grid } from "@mui/material";
import AppCard from "../components/AppCard";
import type { AppEntry } from "../types";

export default function HomePage() {
  const [apps, setApps] = useState<AppEntry[]>([]);

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.json())
      .then((data) => setApps(data.apps));
  }, []);

  return (
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
  );
}
