/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { distanceToSegment } from "./link-hover";

describe("distanceToSegment", () => {
  it("measures to the nearest point of the line, its ends included", () => {
    // Beside the middle of a line: straight across.
    expect(distanceToSegment([50, 5], [0, 0], [100, 0])).toBe(5);
    // Past an end: to that end, not to the line's extension.
    expect(distanceToSegment([103, 4], [0, 0], [100, 0])).toBe(5);
    // A line of no length is its point.
    expect(distanceToSegment([3, 4], [0, 0], [0, 0])).toBe(5);
  });
});
