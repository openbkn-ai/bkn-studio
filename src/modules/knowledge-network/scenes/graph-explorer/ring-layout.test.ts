/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { RING_NODE_SPACING, ringPositions, ringsDiameter } from "./ring-layout";

const distances = (points: { x: number; y: number }[]) => {
  let min = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      min = Math.min(min, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return min;
};

describe("ringPositions", () => {
  it("returns nothing for an empty set and the centre for one node", () => {
    expect(ringPositions(0)).toEqual([]);
    expect(ringPositions(1)).toEqual([{ x: 0, y: 0 }]);
  });

  it("keeps every pair at least a node apart", () => {
    for (const count of [7, 40, 326, 500]) {
      expect(distances(ringPositions(count))).toBeGreaterThanOrEqual(RING_NODE_SPACING * 0.9);
    }
  });

  it("packs many nodes into a disc far smaller than a single ring would need", () => {
    const singleRing = (326 * RING_NODE_SPACING) / Math.PI;
    expect(ringsDiameter(326)).toBeLessThan(singleRing / 2);
  });

  it("grows with the node count", () => {
    expect(ringsDiameter(500)).toBeGreaterThan(ringsDiameter(100));
  });
});
