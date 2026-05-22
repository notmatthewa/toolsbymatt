import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Box } from "@mui/material";
import NavBar from "./components/NavBar";
import SearchDialog from "./components/SearchDialog";
import HomePage from "./pages/HomePage";
import ScaleSnapPage from "./pages/ScaleSnapPage";

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <NavBar onSearchOpen={() => setSearchOpen(true)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/apps/scalesnap" element={<ScaleSnapPage />} />
        </Routes>
      </Box>
    </Box>
  );
}
