import { Link } from "react-router-dom";
import {
  Card,
  CardActionArea,
  CardContent,
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import type { AppEntry } from "../types";
import { iconMap } from "../icons";

function getIcon(name: string) {
  const Icon = iconMap[name];
  return Icon ? <Icon sx={{ fontSize: 32, color: "primary.main" }} /> : null;
}

export default function AppCard({ app }: { app: AppEntry }) {
  return (
    <Card
      sx={{
        bgcolor: "background.paper",
        height: "100%",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        "&:hover": {
          borderColor: "rgba(129, 140, 248, 0.3)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <CardActionArea
        component={Link}
        to={app.url}
        sx={{ height: "100%", alignItems: "flex-start" }}
      >
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2.5,
              bgcolor: "rgba(129, 140, 248, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 2,
            }}
          >
            {getIcon(app.icon)}
          </Box>
          <Typography variant="h6" sx={{ fontSize: 16, mb: 0.5 }}>
            {app.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, fontSize: 13 }}
          >
            {app.description}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
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
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
