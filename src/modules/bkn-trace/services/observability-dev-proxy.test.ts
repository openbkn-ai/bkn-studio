/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("routes Trace and archive APIs to the selected local backend while keeping auth on the gateway", () => {
  // Vite's config loader uses esbuild and must run in Node's native realm,
  // separately from this application's jsdom test setup.
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { resolveConfig } from "vite";
    const config = await resolveConfig({ configFile: "vite.config.ts", logLevel: "silent" }, "serve");
    const paths = ["/api/agent-observability/v1/access-profile", "/api/observability/v1/log-archive-jobs", "/api/observability/v1/trace-archive-jobs", "/api/safe/v1/me"];
    const targets = paths.map(path => {
      const match = Object.entries(config.server.proxy ?? {}).find(([prefix]) =>
        prefix.startsWith("^") ? new RegExp(prefix).test(path) : path.startsWith(prefix));
      const proxy = match?.[1];
      return typeof proxy === "string" ? proxy : proxy?.target;
    });
    process.stdout.write(JSON.stringify(targets));
  `,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        VITE_USE_MOCK: "false",
        VITE_AGENT_OBSERVABILITY_TARGET: "http://127.0.0.1:19880",
        VITE_DEV_AUTH_ORIGIN: "http://127.0.0.1:8081",
        VITE_SAFE_PROXY_TARGET: "",
      },
    },
  );
  expect(JSON.parse(result)).toEqual([
    "http://127.0.0.1:19880",
    "http://127.0.0.1:19880",
    "http://127.0.0.1:19880",
    "http://127.0.0.1:8081",
  ]);
});
