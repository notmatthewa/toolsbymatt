import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    react(),
    // Serve sub-app index.html files from public/ (Vite's SPA fallback swallows them otherwise)
    {
      name: "sub-app-html",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith("/apps/") && (req.url.endsWith("/") || !req.url.includes("."))) {
            const subPath = req.url.replace(/\/$/, "") + "/index.html";
            const filePath = path.join(server.config.publicDir, subPath);
            if (fs.existsSync(filePath)) {
              res.setHeader("Content-Type", "text/html");
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
  server: {
    headers: {
      "Cache-Control": "no-store",
    },
    proxy: {
      "/api": "http://localhost:8002",
    },
  },
});
