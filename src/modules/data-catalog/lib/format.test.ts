/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { formatCount, formatRowCount, formatTaskDateTime, timeAgo } from "@/modules/data-catalog/lib/format";

describe("data-catalog format", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats row counts for the active Chinese locale", async () => {
    await i18n.changeLanguage("zh-CN");

    expect(formatRowCount(999)).toBe("999 行");
    expect(formatRowCount(12_345)).toBe("1.2 万行");
    expect(formatRowCount(250_000_000)).toBe("2.5 亿行");
  });

  it("formats row counts and relative time in English", async () => {
    await i18n.changeLanguage("en-US");

    expect(formatCount(12_345)).toBe("12,345");
    expect(formatRowCount(12_345)).toBe("12,345 rows");
    expect(timeAgo(Date.now() - 20_000, "en-US")).toBe("just now");
    expect(timeAgo(Date.now() - 5 * 60_000, "en-US")).toBe("5m ago");
    expect(timeAgo(Date.now() - 3 * 60 * 60_000, "en-US")).toBe("3h ago");
    expect(timeAgo(Date.now() - 2 * 24 * 60 * 60_000, "en-US")).toBe("2d ago");
  });

  it("renders missing task timestamps as a placeholder", () => {
    expect(formatTaskDateTime(0)).toBe("-");
  });
});
