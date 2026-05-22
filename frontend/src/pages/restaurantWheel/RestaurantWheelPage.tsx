import { useState, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SpinningWheel from "./SpinningWheel";
import { queryRestaurants } from "./overpass";
import type { Restaurant } from "./types";

const TIME_MARKS = [5, 10, 15, 20, 25, 30].map((v) => ({
  value: v,
  label: `${v}m`,
}));

const MAX_WHEEL_ITEMS = 20;

export default function RestaurantWheelPage() {
  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [winner, setWinner] = useState<Restaurant | null>(null);

  // Filters
  const [selectedCuisines, setSelectedCuisines] = useState<Set<string>>(new Set());
  const [showFastFood, setShowFastFood] = useState(true);

  // Derive available cuisines from results
  const cuisines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of restaurants) {
      const c = r.cuisine?.toLowerCase();
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [restaurants]);

  // Apply filters
  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      if (!showFastFood && r.amenity === "fast_food") return false;
      if (selectedCuisines.size > 0) {
        const c = r.cuisine?.toLowerCase();
        if (!c || !selectedCuisines.has(c)) return false;
      }
      return true;
    });
  }, [restaurants, selectedCuisines, showFastFood]);

  // Wheel items from filtered list
  const wheelItems = useMemo(() => {
    if (filtered.length <= MAX_WHEEL_ITEMS) return filtered;
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, MAX_WHEEL_ITEMS);
  }, [filtered]);

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) => {
      const next = new Set(prev);
      if (next.has(cuisine)) next.delete(cuisine);
      else next.add(cuisine);
      return next;
    });
  };

  const geolocate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationText(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setError("");
      },
      () => setError("Location access denied. Please enter an address.")
    );
  }, []);

  const geocodeText = useCallback(async () => {
    if (!locationText.trim()) return;
    const coordMatch = locationText.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      setCoords({ lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) });
      return;
    }
    try {
      const resp = await fetch(`/api/geocode?q=${encodeURIComponent(locationText)}`);
      if (!resp.ok) throw new Error("Geocode failed");
      const data = await resp.json();
      if (data.features?.length > 0) {
        const [lon, lat] = data.features[0].geometry.coordinates;
        setCoords({ lat, lon });
        setLocationText(data.features[0].properties.label || locationText);
      } else {
        setError("Location not found");
      }
    } catch {
      setError("Failed to geocode address");
    }
  }, [locationText]);

  const search = useCallback(async () => {
    if (!coords) {
      setError("Set a location first");
      return;
    }
    setLoading(true);
    setError("");
    setRestaurants([]);
    setSelectedCuisines(new Set());
    setShowFastFood(true);
    try {
      const isoResp = await fetch(
        `/api/isochrone?lat=${coords.lat}&lon=${coords.lon}&minutes=${minutes}`
      );
      if (!isoResp.ok) throw new Error("Isochrone request failed");
      const isoData = await isoResp.json();
      const polygon: [number, number][] =
        isoData.features[0].geometry.coordinates[0];

      const results = await queryRestaurants(polygon);
      setRestaurants(results);

      if (results.length === 0) {
        setError("No restaurants found in this area");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [coords, minutes]);

  const reshuffle = () => {
    // Force a new random sample by creating a new filtered→wheel derivation
    // We achieve this by toggling a dummy state, but since wheelItems is derived
    // from filtered via useMemo, we need to force it. Simplest: just set restaurants
    // to a new array reference.
    setRestaurants((prev) => [...prev]);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4, flex: 1, display: "flex", flexDirection: "column" }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Restaurant Wheel
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Find all restaurants within your drive-time radius and spin to pick one
      </Typography>

      {/* Inputs */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }} alignItems="center">
        <TextField
          size="small"
          placeholder="Enter address or use location"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") geocodeText(); }}
          onBlur={geocodeText}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={geolocate} title="Use my location">
                    <MyLocationIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1, minWidth: 250 }}
        />
        <Box sx={{ minWidth: 180, px: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Drive time: {minutes} min
          </Typography>
          <Slider
            value={minutes}
            onChange={(_, v) => setMinutes(v as number)}
            min={5}
            max={30}
            step={5}
            marks={TIME_MARKS}
            size="small"
          />
        </Box>
        <Button variant="contained" onClick={search} disabled={loading || !coords}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Find Restaurants"}
        </Button>
      </Stack>

      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {/* Filters */}
      {restaurants.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1, flexWrap: "wrap", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              Filters:
            </Typography>
            <Chip
              label={showFastFood ? "Fast food ON" : "Fast food OFF"}
              size="small"
              variant={showFastFood ? "filled" : "outlined"}
              onClick={() => setShowFastFood(!showFastFood)}
              sx={{ fontSize: 11 }}
            />
            {selectedCuisines.size > 0 && (
              <Chip
                label="Clear cuisines"
                size="small"
                variant="outlined"
                onDelete={() => setSelectedCuisines(new Set())}
                sx={{ fontSize: 11 }}
              />
            )}
          </Stack>
          {cuisines.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {cuisines.map(({ name, count }) => (
                <Chip
                  key={name}
                  label={`${name} (${count})`}
                  size="small"
                  variant={selectedCuisines.has(name) ? "filled" : "outlined"}
                  color={selectedCuisines.has(name) ? "primary" : "default"}
                  onClick={() => toggleCuisine(name)}
                  sx={{ fontSize: 11, textTransform: "capitalize" }}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Main content: list + wheel */}
      {filtered.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 3,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Restaurant list */}
          <Paper
            variant="outlined"
            sx={{
              width: { xs: "100%", md: 300 },
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              maxHeight: { xs: 200, md: 500 },
            }}
          >
            <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="subtitle2">
                {filtered.length} restaurants
                {filtered.length !== restaurants.length && ` (of ${restaurants.length})`}
                {filtered.length > MAX_WHEEL_ITEMS && ` · ${MAX_WHEEL_ITEMS} on wheel`}
              </Typography>
              {filtered.length > MAX_WHEEL_ITEMS && (
                <Button size="small" onClick={reshuffle} sx={{ fontSize: 11, p: 0 }}>
                  Reshuffle wheel
                </Button>
              )}
            </Box>
            <List dense sx={{ overflow: "auto", flex: 1 }}>
              {filtered.map((r) => (
                <ListItemButton
                  key={r.id}
                  component="a"
                  href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`}
                  target="_blank"
                  rel="noopener"
                >
                  <ListItemText
                    primary={r.name}
                    secondary={[
                      r.cuisine,
                      r.amenity === "fast_food" ? "fast food" : null,
                      r.address,
                    ].filter(Boolean).join(" · ")}
                    slotProps={{ secondary: { noWrap: true } }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>

          {/* Wheel */}
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SpinningWheel restaurants={wheelItems} onResult={setWinner} />
          </Box>
        </Box>
      )}

      {/* Winner dialog */}
      <Dialog open={!!winner} onClose={() => setWinner(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: "center", pt: 3 }}>You're going to...</DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {winner?.name}
          </Typography>
          {winner?.cuisine && (
            <Typography color="text.secondary" sx={{ mb: 0.5, textTransform: "capitalize" }}>
              {winner.cuisine}
            </Typography>
          )}
          {winner?.address && (
            <Typography variant="body2" color="text.secondary">
              {winner.address}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3, gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            href={
              winner
                ? `https://www.google.com/maps/search/?api=1&query=${winner.lat},${winner.lon}`
                : "#"
            }
            target="_blank"
          >
            Open in Maps
          </Button>
          <Button variant="contained" onClick={() => setWinner(null)}>
            Spin Again
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
