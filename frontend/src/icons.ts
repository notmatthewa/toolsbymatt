import type { SvgIconComponent } from "@mui/icons-material";
import Straighten from "@mui/icons-material/Straighten";
import Build from "@mui/icons-material/Build";
import Code from "@mui/icons-material/Code";
import Science from "@mui/icons-material/Science";
import Brush from "@mui/icons-material/Brush";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import Settings from "@mui/icons-material/Settings";
import Calculate from "@mui/icons-material/Calculate";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import Download from "@mui/icons-material/Download";
import QueueMusic from "@mui/icons-material/QueueMusic";

// Add new icons here as you add apps to apps.json
export const iconMap: Record<string, SvgIconComponent> = {
  Straighten,
  Build,
  Code,
  Science,
  Brush,
  PhotoCamera,
  Settings,
  Calculate,
  Restaurant: RestaurantIcon,
  Download,
  QueueMusic,
};
