/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("business provenance replacement boundary", () => {
  const moduleRoot = dirname(fileURLToPath(import.meta.url));

  it("keeps only the current business provenance production scene", () => {
    expect(existsSync(join(moduleRoot, "scenes/BknTraceRunsScene.tsx"))).toBe(false);
    expect(existsSync(join(moduleRoot, "scenes/BknTraceRunsScene.module.css"))).toBe(false);
    expect(existsSync(join(moduleRoot, "utils/trace-explainability.ts"))).toBe(false);
  });

  it("does not retain legacy business projection clients in the shared access-profile service", () => {
    const source = readFileSync(join(moduleRoot, "services/trace.service.ts"), "utf8");

    expect(source).not.toMatch(/business-provenance|business-graph|evidence-chain|snapshot-preview/);
    expect(source).not.toMatch(/getRequestSummaries|getConversationSummaries|getInteractionSummaries/);
  });
});
