import { useState } from "react";
import { Box, Container, Typography, Grid } from "@mui/material";
import NavBar from "./components/NavBar";
import SearchDialog from "./components/SearchDialog";
import AppCard from "./components/AppCard";
import { useApps } from "./useApps";

export default function App() {
  const { apps, search } = useApps();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <NavBar onSearchOpen={() => setSearchOpen(true)} />
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={search}
      />
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
