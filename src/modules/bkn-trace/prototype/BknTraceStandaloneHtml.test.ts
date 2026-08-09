/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const standalonePath = resolve(process.cwd(), "public/bkn-trace-prototype.html");

describe("BKN Trace standalone HTML", () => {
  it("is a self-contained real-conversation prototype with no API dependency", () => {
    expect(existsSync(standalonePath)).toBe(true);

    const html = readFileSync(standalonePath, "utf8");

    expect(html).toContain("conv_73fc12a00ac46933c3d8015616a1b1b3");
    expect(html).toContain('data-view="timeline"');
    expect(html).toContain('data-view="network"');
    expect(html.match(/key: "op-/g)).toHaveLength(9);
    expect(html).not.toMatch(/\bfetch\s*\(/);
    expect(html).not.toContain("XMLHttpRequest");
    expect(html).not.toContain("WebSocket");
    expect(html).not.toContain("/api/");
    expect(html).not.toMatch(/<(?:link|script)[^>]+(?:href|src)=/);
  });
});
