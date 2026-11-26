/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import path from "node:path";
import { defineConfig } from "@playwright/test";

import config, { baseURL } from "./playwright.config";

const workbench = /function-workbench-layout\.spec\.ts$/;
const professionalHost = "127.0.0.2";
const professionalPort = new URL(baseURL).port || "8000";
const professionalBaseURL = `http://${professionalHost}:${professionalPort}`;

export default defineConfig({
  ...config,
  projects: [
    { name: "community", testIgnore: workbench },
    { name: "professional", testMatch: workbench, use: { baseURL: professionalBaseURL } },
  ],
  webServer: {
    command: `pnpm exec vite --host ${professionalHost} --port ${professionalPort} --strictPort`,
    cwd: path.resolve(__dirname, "../.."),
    env: { VITE_USE_MOCK: "true", VITE_MOCK_EDITION: "professional" },
    wait: { stdout: /ready in/ },
  },
});
