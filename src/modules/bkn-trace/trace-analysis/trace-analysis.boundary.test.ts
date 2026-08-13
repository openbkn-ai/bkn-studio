/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Community Trace analysis boundary", () => {
  it("does not depend on enterprise business provenance projections", () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const sources = readdirSync(directory)
      .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes(".test."))
      .map((name) => readFileSync(join(directory, name), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/business-provenance|business-graph|evidence-chain|snapshot-preview/);
    expect(sources).not.toContain("@/modules/bkn-trace/services/trace.service");
  });
});
