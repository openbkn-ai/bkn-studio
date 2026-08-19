/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { isHourlyCron } from "@/modules/data-connect/utils/health-check-cron";

describe("isHourlyCron", () => {
  it.each(["0 * * * *", "30 0,12 * JAN,MAR MON-FRI", "59 23 ? * SUN"])(
    "accepts an hourly-or-slower five-field cron: %s",
    (cronExpr) => {
      expect(isHourlyCron(cronExpr)).toBe(true);
    },
  );

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
    "0 * * *",
  ])("rejects an invalid or sub-hour cron: %s", (cronExpr) => {
    expect(isHourlyCron(cronExpr)).toBe(false);
  });
});
