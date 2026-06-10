import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const devProxyOrigin = env.VITE_DEV_AUTH_ORIGIN || "http://118.196.7.174";
  const useMock = env.VITE_USE_MOCK !== "false";

  return {
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
      host: true,
      allowedHosts: ["host.docker.internal", "localhost", "127.0.0.1"],
      ...(process.env.VITE_DEV_USE_POLLING === "true"
        ? {
            watch: {
              // Docker Desktop on Windows bind mounts do not propagate inotify.
              usePolling: true,
              interval: 3000,
              ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
            },
          }
        : {}),
      proxy: {
        ...(useMock
          ? {}
          : {
              "/api": {
                changeOrigin: true,
                target: devProxyOrigin,
              },
            }),
        "/api/agent-operator-integration": {
          changeOrigin: true,
          secure: false,
          timeout: 120_000,
          proxyTimeout: 120_000,
          target: process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1:9000",
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "./src"),
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
  };
});
