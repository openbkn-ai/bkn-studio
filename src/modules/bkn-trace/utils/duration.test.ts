/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatDuration } from "@/modules/bkn-trace/utils/duration";

const labels = { hour: "小时", millisecond: "毫秒", minute: "分钟", second: "秒" };

describe("formatDuration", () => {
  it("uses the largest readable unit without losing short durations", () => {
    expect(formatDuration(999, labels)).toBe("999 毫秒");
    expect(formatDuration(1_500, labels)).toBe("1.5 秒");
    expect(formatDuration(90_000, labels)).toBe("1.5 分钟");
    expect(formatDuration(5_400_000, labels)).toBe("1.5 小时");
  });

  it("keeps zero and missing values distinguishable", () => {
    expect(formatDuration(0, labels)).toBe("0 毫秒");
    expect(formatDuration(undefined, labels)).toBe("-");
  });
});
