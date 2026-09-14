/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { defineConfig } from "@playwright/test";

/** Manual live-verification config: system Chrome, one worker, generous timeouts. */
export default defineConfig({
  testDir: "./specs/knowledge-network",
  testMatch: /graph-explorer\.verify\.spec\.ts/,
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8010",
    channel: "chrome",
    headless: true,
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
});
