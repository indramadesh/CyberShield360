import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache across app deploys.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          radix: [
            "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip", "@radix-ui/react-progress", "@radix-ui/react-slot",
          ],
        },
      },
    },
  },
  server: {
    // host:true binds 0.0.0.0 so teammates on the same network can reach it.
    host: true,
    port: 5173,
    // Allow any Host header (LAN IPs, hostnames) for local team testing.
    allowedHosts: true,
    proxy: {
      // The proxy runs on THIS machine, so API calls work for remote devices
      // too (they hit the frontend origin; it forwards /api to the backend).
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/health": { target: "http://localhost:8000", changeOrigin: true },
      "/ready": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
