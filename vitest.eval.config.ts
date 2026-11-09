/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { defineConfig, mergeConfig } from "vitest/config";
import appConfig from "./vite.config";

export default defineConfig((env) =>
  mergeConfig(appConfig(env), {
    test: {
      include: ["src/modules/knowledge-network/eval/**/*.test.{ts,tsx}"],
      maxWorkers: "50%",
      testTimeout: 30_000,
      coverage: {
        provider: "istanbul",
        reportOnFailure: true,
        include: ["src/modules/knowledge-network/eval/**/*.{ts,tsx}"],
        exclude: ["**/*.test.{ts,tsx}", "**/types.ts"],
        reporter: ["text", "json", "json-summary", "html"],
        reportsDirectory: "coverage/eval",
      },
    },
  }),
);
