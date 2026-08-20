/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/scan-hardcoded-zh.mjs");
const fixturesRoot = path.resolve("scripts/fixtures/i18n-scan");

function scanFixture(name: string) {
  const output = execFileSync(process.execPath, [scriptPath, "--json"], {
    cwd: path.join(fixturesRoot, name),
    encoding: "utf8",
  });
  return JSON.parse(output) as {
    findings: Array<{ language: string; relativePath: string; text: string }>;
    summary: { active: number };
  };
}

describe("hardcoded i18n scanner", () => {
  it("finds Chinese HTML, TSX strings with comment markers, and user-facing English text", () => {
    const result = scanFixture("bad");

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: "en", text: "back" }),
        expect.objectContaining({ language: "en", text: "Copy failed" }),
        expect.objectContaining({ language: "zh", relativePath: "public/review.html" }),
        expect.objectContaining({
          language: "zh",
          text: expect.stringContaining("https://example.com/中文文档"),
        }),
        expect.objectContaining({
          language: "zh",
          text: expect.stringContaining("块注释符号之后的硬编码"),
        }),
      ]),
    );
  });

  it("allows URLs, protocols, code, and stable technical terms", () => {
    expect(scanFixture("allowed").summary.active).toBe(0);
  });
});
