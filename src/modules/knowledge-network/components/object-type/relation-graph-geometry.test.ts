/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { parallelRelationOffsets } from "./relation-graph-geometry";

describe("parallelRelationOffsets", () => {
  it("leaves a single relation straight", () => {
    expect(parallelRelationOffsets([100], 0, 1)).toEqual([0]);
  });

  it("spreads labels across a vertical edge by their widths, so they do not overlap", () => {
    const [left, right] = parallelRelationOffsets([100, 120], 0, 1);
    // Labels sit halfway to the bend: their centres are half the offsets apart.
    expect((right - left) / 2).toBeGreaterThanOrEqual((100 + 120) / 2);
    expect(left).toBe(-right);
  });

  it("spaces labels by their height across a horizontal edge", () => {
    expect(parallelRelationOffsets([100, 100, 100], 1, 0)).toEqual([-80, 0, 80]);
  });
});
