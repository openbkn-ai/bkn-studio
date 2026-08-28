/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatDateTime, formatDateTimeYmdHms, formatFileSize, formatNumber, formatPercent } from "@/framework/i18n/format";

describe("locale format helpers", () => {
  it("formats numbers with the requested locale", () => {
    expect(formatNumber(1234567.89, { locale: "en-US" })).toBe("1,234,567.89");
    expect(formatNumber(1234567.89, { locale: "zh-CN" })).toBe("1,234,567.89");
  });

  it("formats percentages", () => {
    expect(formatPercent(0.125, { locale: "en-US" })).toBe("12.5%");
  });

  it("formats file sizes", () => {
    expect(formatFileSize(1536, { locale: "en-US" })).toBe("1.5 kB");
  });

  it("formats date time and falls back for invalid values", () => {
    expect(formatDateTime("2026-08-07T06:00:00Z", { locale: "en-US", timeZone: "UTC" })).toBe(
      "Aug 7, 2026, 06:00:00",
    );
    expect(formatDateTime("")).toBe("-");
  });

  it("supports explicit date-time component options", () => {
    expect(() =>
      formatDateTime("2026-08-07T06:00:00Z", {
        day: "2-digit",
        hour: "2-digit",
        locale: "en-US",
        minute: "2-digit",
        month: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        year: "numeric",
      }),
    ).not.toThrow();
  });

  it("formats date time in the fixed task display format", () => {
    expect(formatDateTimeYmdHms(new Date(2026, 5, 3, 11, 42, 20))).toBe("2026-06-03 11:42:20");
    expect(formatDateTimeYmdHms(null)).toBe("-");
  });
});
