/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatLogicPropertyTrialValue } from "@/modules/knowledge-network/lib/format-logic-property-trial-value";

describe("formatLogicPropertyTrialValue", () => {
  it("formats nullish values as placeholder", () => {
    expect(formatLogicPropertyTrialValue(null)).toBe("--");
    expect(formatLogicPropertyTrialValue(undefined)).toBe("--");
    expect(formatLogicPropertyTrialValue("")).toBe("--");
  });

  it("preserves scalar primitives", () => {
    expect(formatLogicPropertyTrialValue(42)).toBe("42");
    expect(formatLogicPropertyTrialValue(9.8917)).toBe("9.8917");
    expect(formatLogicPropertyTrialValue("ok")).toBe("ok");
  });

  it("formats metric logic property payloads as readable values", () => {
    expect(
      formatLogicPropertyTrialValue({
        datas: [
          {
            labels: {},
            times: [1785907737652],
            values: [0],
          },
        ],
        is_calendar: false,
        is_variable: false,
        model: {
          unit: "CNY",
          unit_type: "currencyUnit",
        },
        step: "",
      }),
    ).toBe("0 CNY");
  });

  it("summarizes multi-point metric payloads", () => {
    expect(
      formatLogicPropertyTrialValue({
        datas: [{ values: [1, 2, 3] }],
        model: { unit: "CNY" },
      }),
    ).toBe("1 ~ 3 CNY (3)");
  });

  it("stringifies unknown object shapes", () => {
    expect(formatLogicPropertyTrialValue({ total: 1 })).toBe('{"total":1}');
  });
});
