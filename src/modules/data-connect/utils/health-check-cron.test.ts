/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  calculateNextHourlyCronRun,
  isHourlyCron,
} from "@/modules/data-connect/utils/health-check-cron";

describe("isHourlyCron", () => {
  it.each(["0 * * * *", "30 0,12 * JAN,MAR MON-FRI", "59 23 ? * SUN"])(
    "accepts an hourly-or-slower five-field cron: %s",
    (cronExpr) => {
      expect(isHourlyCron(cronExpr)).toBe(true);
    },
  );

  it.each(["@hourly", "@daily", "@every 1h30m", "@every +2h"])(
    "accepts an hourly-or-slower descriptor: %s",
    (cronExpr) => {
      expect(isHourlyCron(cronExpr)).toBe(true);
    },
  );

  it.each([
    "CRON_TZ=UTC 0 0 * * *",
    "TZ=Asia/Tokyo @daily",
    "TZ=Local @every 2h",
  ])("accepts a Vega timezone prefix: %s", (cronExpr) => {
    expect(isHourlyCron(cronExpr)).toBe(true);
  });

  it.each([
    "*/5 * * * *",
    "* * * * *",
    "0,30 * * * *",
    "60 * * * *",
    "0 24 * * *",
    "0 * 32 * *",
    "0 * * 13 *",
    "0 * * * 7",
    "0 invalid * * *",
    "0x0 * * * *",
    "0.0 * * * *",
    "1e1 * * * *",
    "0 * * *",
    "@every 30m",
    "@every 2562047h47m17s",
    "@every 999999999999999999999h",
    "@unknown",
    "TZ=Not/A_Real_Zone 0 * * * *",
  ])("rejects an invalid or sub-hour cron: %s", (cronExpr) => {
    expect(isHourlyCron(cronExpr)).toBe(false);
  });

  it("finds the next leap-day execution within Vega's five-year window", () => {
    const now = new Date(2025, 2, 1, 0, 0, 0).getTime();
    const nextRun = calculateNextHourlyCronRun("0 0 29 2 *", now);
    const nextDate = new Date(nextRun ?? 0);

    expect(nextDate.getFullYear()).toBe(2028);
    expect(nextDate.getMonth()).toBe(1);
    expect(nextDate.getDate()).toBe(29);
  });

  it("calculates constant-delay descriptors from the current second", () => {
    const now = Date.parse("2026-08-19T10:00:00.500Z");
    expect(calculateNextHourlyCronRun("@every 1h30m", now)).toBe(
      Date.parse("2026-08-19T11:30:00.000Z"),
    );
  });

  it("accepts the largest whole-second duration supported by Vega", () => {
    expect(isHourlyCron("@every 2562047h47m16s")).toBe(true);
  });

  it("calculates calendar schedules in their declared timezone", () => {
    const now = Date.parse("2026-08-19T15:30:00Z");
    expect(calculateNextHourlyCronRun("TZ=Asia/Tokyo 0 2 * * *", now)).toBe(
      Date.parse("2026-08-19T17:00:00Z"),
    );
  });

  it("skips a local time that does not exist during a DST transition", () => {
    const now = Date.parse("2026-03-07T08:00:00Z");
    expect(
      calculateNextHourlyCronRun("TZ=America/New_York 0 2 * * *", now),
    ).toBe(Date.parse("2026-03-09T06:00:00Z"));
  });

  it("selects the first repeated local time during a DST transition", () => {
    const now = Date.parse("2026-11-01T04:30:00Z");
    expect(
      calculateNextHourlyCronRun("TZ=America/New_York 0 1 * * *", now),
    ).toBe(Date.parse("2026-11-01T05:00:00Z"));
  });

  it("uses OR semantics when Vega clears a stepped wildcard flag", () => {
    const now = Date.parse("2026-06-02T00:00:00Z");
    expect(calculateNextHourlyCronRun("CRON_TZ=UTC 0 0 */2 * MON", now)).toBe(
      Date.parse("2026-06-03T00:00:00Z"),
    );
  });
});
