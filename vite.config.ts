import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    env: {
      VITE_USE_MOCK: "true",
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "tests/execution-factory/agent-at/**",
      "tests/execution-factory/operator-web-ui/**",
    ],
  },
  server: {
    proxy: {
      "/api/agent-operator-integration": {
        changeOrigin: true,
        secure: false,
        target: process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }

          if (id.includes("/react-router/") || id.includes("/react-router-dom/")) {
            return "vendor-router";
          }

          if (id.includes("/i18next/") || id.includes("/react-i18next/")) {
            return "vendor-i18n";
          }

          return undefined;
        },
      },
    },
  },
});
