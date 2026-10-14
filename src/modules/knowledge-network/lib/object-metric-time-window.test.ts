/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildObjectMetricTimeWindow,
  objectMetricTimeWindowBackendMode,
  objectMetricTimeWindowBusinessLabel,
  objectMetricTimeWindowPeriod,
  objectMetricTimeWindowSelection,
} from "./object-metric-time-window";

describe("object metric time-window presentation", () => {
  it("omits an unbounded selection instead of submitting an empty time-window contract", () => {
    expect(buildObjectMetricTimeWindow({ selection: "unbounded" })).toBeUndefined();
  });

  it("normalizes hidden calendar defaults before validation", () => {
    expect(buildObjectMetricTimeWindow({ selection: "current_week" })).toEqual({
      mode: "period_to_date",
      period: "week",
      timezone: "UTC",
      week_start: "monday",
    });
    expect(buildObjectMetricTimeWindow({ selection: "current_month" })).toEqual({
      mode: "period_to_date",
      period: "month",
      timezone: "UTC",
      week_start: undefined,
    });
  });

  it("normalizes rolling defaults and preserves fixed ranges", () => {
    expect(buildObjectMetricTimeWindow({ selection: "rolling" })).toEqual({
      length: 30,
      mode: "rolling",
      timezone: "UTC",
      unit: "day",
    });
    expect(
      buildObjectMetricTimeWindow({
        endAt: 2000,
        selection: "fixed_range",
        startAt: 1000,
      }),
    ).toEqual({
      end_at: 2000,
      mode: "fixed_range",
      start_at: 1000,
      timezone: "UTC",
    });
  });

  it("maps period-to-date definitions to business period selections", () => {
    expect(
      objectMetricTimeWindowSelection({
        mode: "period_to_date",
        period: "month",
        timezone: "Asia/Shanghai",
      }),
    ).toBe("current_month");
    expect(objectMetricTimeWindowBusinessLabel("current_month")).toBe("本月");
    expect(objectMetricTimeWindowBackendMode("current_month")).toBe("period_to_date");
    expect(objectMetricTimeWindowPeriod("current_month")).toBe("month");
  });

  it("preserves legacy full-calendar definitions without exposing them as a new default", () => {
    expect(
      objectMetricTimeWindowSelection({
        mode: "calendar_period",
        period: "quarter",
        timezone: "Asia/Shanghai",
      }),
    ).toBe("full_quarter");
    expect(objectMetricTimeWindowBusinessLabel("full_quarter")).toBe("整个本季度（含未来日期）");
    expect(objectMetricTimeWindowBackendMode("full_quarter")).toBe("calendar_period");
  });

  it("keeps fixed ranges as an explicit selection", () => {
    expect(
      objectMetricTimeWindowSelection({
        end_at: 2000,
        mode: "fixed_range",
        start_at: 1000,
        timezone: "Asia/Shanghai",
      }),
    ).toBe("fixed_range");
  });

  it.each(["day", "week", "month", "quarter", "year"] as const)(
    "maps the current %s period to a period-to-date contract",
    (period) => {
      expect(buildObjectMetricTimeWindow({ selection: `current_${period}` })).toEqual({
        mode: "period_to_date",
        period,
        timezone: "UTC",
        week_start: period === "week" ? "monday" : undefined,
      });
    },
  );

  it.each(["day", "week", "month", "quarter", "year"] as const)(
    "round-trips a legacy full %s calendar period without changing it",
    (period) => {
      const window = buildObjectMetricTimeWindow({
        selection: `full_${period}`,
        weekStart: "sunday",
      });
      expect(window).toEqual({
        mode: "calendar_period",
        period,
        timezone: "UTC",
        week_start: period === "week" ? "sunday" : undefined,
      });
      expect(objectMetricTimeWindowSelection(window)).toBe(`full_${period}`);
    },
  );

  it.each(["minute", "hour", "day", "week", "month", "quarter", "year"] as const)(
    "preserves a rolling %s unit and forces a positive integer length",
    (unit) => {
      expect(buildObjectMetricTimeWindow({ length: 2.9, selection: "rolling", unit })).toEqual({
        length: 2,
        mode: "rolling",
        timezone: "UTC",
        unit,
      });
      expect(buildObjectMetricTimeWindow({ length: 0, selection: "rolling", unit })).toEqual({
        length: 1,
        mode: "rolling",
        timezone: "UTC",
        unit,
      });
    },
  );

  it("preserves the exact inclusive millisecond boundaries of a fixed range", () => {
    const startAt = Date.parse("2026-01-01T00:00:00.000Z");
    const endAt = Date.parse("2026-03-31T23:59:59.999Z");
    expect(buildObjectMetricTimeWindow({ endAt, selection: "fixed_range", startAt })).toEqual({
      end_at: endAt,
      mode: "fixed_range",
      start_at: startAt,
      timezone: "UTC",
    });
  });

  it("does not emit an incomplete fixed-range contract", () => {
    expect(buildObjectMetricTimeWindow({ selection: "fixed_range", startAt: 1 })).toBeUndefined();
    expect(buildObjectMetricTimeWindow({ endAt: 2, selection: "fixed_range" })).toBeUndefined();
  });

  it("uses UTC by default but preserves a legacy valid timezone", () => {
    expect(buildObjectMetricTimeWindow({ selection: "current_month" })).toMatchObject({
      timezone: "UTC",
    });
    expect(
      buildObjectMetricTimeWindow({
        selection: "current_month",
        timezone: "Asia/Shanghai",
      }),
    ).toMatchObject({ timezone: "Asia/Shanghai" });
  });
});
