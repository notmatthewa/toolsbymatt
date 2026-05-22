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
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <NavBar onSearchOpen={() => setSearchOpen(true)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/apps/scalesnap" element={<ScaleSnapPage />} />
      </Routes>
    </Box>
  );
}
