/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  formatExecutionUnitTime,
  normalizeTimestamp,
} from "@/modules/execution-factory/utils/format-timestamp";

describe("format-timestamp", () => {
  it("normalizes backend nanosecond timestamps to milliseconds", () => {
    expect(normalizeTimestamp(1780804434033323501)).toBe(1780804434033);
  });

  it("formats normalized timestamps without Invalid Date", () => {
    const formatted = formatExecutionUnitTime(1780804434033323501);

    expect(formatted).not.toBe("-");
    expect(formatted).not.toContain("Invalid");
    expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2} /);
  });
});
