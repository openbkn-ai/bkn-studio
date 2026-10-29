/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { boundsOf, isolatedBand } from "./isolated-band";

describe("boundsOf", () => {
  it("spans the given points and skips missing positions", () => {
    const positions = [0, 0, 10, 5, Number.NaN, Number.NaN, -2, 8];
    expect(boundsOf(positions, [0, 1, 2, 3])).toEqual({ minX: -2, minY: 0, maxX: 10, maxY: 8 });
    expect(boundsOf(positions, [2])).toBeNull();
  });
});

describe("isolatedBand", () => {
  const above = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
  const type = (i: number) => (i < 30 ? "a" : "b");

  it("lays rows as wide as the connected part, a gap under it, y pointing down", () => {
    const { order, positions } = isolatedBand([0, 1, 2], type, above, 10, { yDown: true });
    expect(order).toEqual([0, 1, 2]);
    expect([...positions]).toEqual([0, 70, 10, 70, 20, 70]);
  });

  it("goes the other way when y points up", () => {
    const { positions } = isolatedBand([0], type, above, 10, { yDown: false });
    expect(positions[1]).toBe(-20);
  });

  it("wraps rows and starts each object type on a row of its own", () => {
    const indices = Array.from({ length: 32 }, (_, i) => i);
    const { order, positions } = isolatedBand(indices, type, above, 5, { yDown: true });
    const y = (k: number) => positions[k * 2 + 1];
    // 100 wide at a spacing of 5: 20 per row, so type a takes two rows.
    expect(y(0)).toBe(60);
    expect(y(19)).toBe(60);
    expect(y(20)).toBe(65);
    // Type b starts after a blank row.
    expect(order[30]).toBe(30);
    expect(y(30)).toBe(75);
    expect(positions[30 * 2]).toBe(0);
  });
});
