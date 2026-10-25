/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
      diagnostics_channel: path.resolve(
        projectRoot,
        "./src/framework/compat/diagnostics-channel.browser.ts",
      ),
      "node:diagnostics_channel": path.resolve(
        projectRoot,
        "./src/framework/compat/diagnostics-channel.browser.ts",
      ),
    },
  },
  build: {
    cssCodeSplit: false,
    emptyOutDir: false,
    rollupOptions: { input: path.resolve(projectRoot, "metric-analysis-mcp.html") },
  },
});
