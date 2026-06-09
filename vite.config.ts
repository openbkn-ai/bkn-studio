import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const devProxyOrigin = env.VITE_DEV_AUTH_ORIGIN || "http://118.196.7.174";
  const useMock = env.VITE_USE_MOCK !== "false";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "./src"),
      },
    },
    server: {
      proxy: useMock
        ? undefined
        : {
            "/api": {
              changeOrigin: true,
              target: devProxyOrigin,
            },
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
