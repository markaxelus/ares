import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/town/",
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8765" } },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll("\\", "/");
          if (/node_modules\/(three|three-stdlib|@react-three)\//.test(path))
            return "planet-vendor";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(path))
            return "react-vendor";
        },
      },
    },
  },
});
