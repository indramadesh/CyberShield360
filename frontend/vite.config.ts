import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
