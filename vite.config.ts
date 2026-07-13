/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

import { DEFAULT_APP_BASENAME } from "./src/app/router/app-basename";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const appBase = `${DEFAULT_APP_BASENAME}/`;

function redirectRootToAppBase(): Plugin {
  return {
    name: "redirect-root-to-app-base",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";

        if (url === "/" || url === DEFAULT_APP_BASENAME) {
          res.writeHead(302, { Location: appBase });
          res.end();
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const devProxyOrigin = env.VITE_DEV_AUTH_ORIGIN || "http://127.0.0.1:9000";
  const safeProxyTarget =
    env.VITE_SAFE_PROXY_TARGET?.trim() ||
    process.env.VITE_SAFE_PROXY_TARGET?.trim() ||
    "";
  const useMock = env.VITE_USE_MOCK !== "false";
  const agentOperatorProxyTarget =
    process.env.VITE_PROXY_TARGET ?? (useMock ? "http://127.0.0.1:9000" : devProxyOrigin);
  const agentRetrievalTarget = process.env.VITE_AGENT_RETRIEVAL_TARGET ?? devProxyOrigin;

  return {
    base: appBase,
    plugins: [react(), redirectRootToAppBase()],
    test: {
      environment: "jsdom",
      env: {
        VITE_USE_MOCK: "true",
      },
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        // Playwright e2e specs run via `pnpm test:execution-factory:e2e`, not
        // vitest. They import @playwright/test, so collecting them here fails.
        "tests/e2e/**",
        "tests/execution-factory/agent-at/**",
        "tests/execution-factory/operator-web-ui/**",
      ],
    },
    server: {
      host: true,
      // OAuth redirect_uri is registered as http://localhost:8000/studio/callback.
      // Fail fast instead of silently drifting to another port when taken.
      port: 8000,
      strictPort: true,
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
        // Specific API prefixes must be listed before the generic /api proxy.
        "/api/agent-operator-integration": {
          changeOrigin: true,
          secure: false,
          timeout: 120_000,
          proxyTimeout: 120_000,
          target: agentOperatorProxyTarget,
        },
        "/api/capabilities-lab": {
          changeOrigin: true,
          secure: false,
          timeout: 120_000,
          proxyTimeout: 120_000,
          target: process.env.VITE_LAB_PROXY_TARGET ?? "http://127.0.0.1:9010",
        },
        "/api/agent-retrieval": {
          changeOrigin: true,
          secure: false,
          timeout: 120_000,
          proxyTimeout: 120_000,
          target: agentRetrievalTarget,
        },
        ...(useMock
          ? {}
          : {
              // 本地 bkn-safe：/api/safe/* → VITE_SAFE_PROXY_TARGET（须在 /api 之前）。
              ...(safeProxyTarget
                ? {
                    "/api/safe": {
                      changeOrigin: true,
                      secure: false,
                      target: safeProxyTarget,
                    },
                  }
                : {}),
              "/api": {
                changeOrigin: true,
                // Allow self-signed HTTPS targets used by local gateways.
                secure: false,
                target: devProxyOrigin,
              },
              // hydra public OAuth2/OIDC endpoints (login flow + token exchange)
              // exposed same-origin at the gateway; mirror them in dev.
              "/oauth2": {
                changeOrigin: true,
                secure: false,
                target: devProxyOrigin,
              },
              "/.well-known": {
                changeOrigin: true,
                secure: false,
                target: devProxyOrigin,
              },
              "/userinfo": {
                changeOrigin: true,
                secure: false,
                target: devProxyOrigin,
              },
            }),
        "/oss-workspace": {
          changeOrigin: true,
          secure: false,
          target: process.env.VITE_OSS_PROXY_TARGET ?? "http://127.0.0.1:9080",
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
