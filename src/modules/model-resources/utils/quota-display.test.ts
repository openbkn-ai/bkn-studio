/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createInstance } from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import { modelResourcesEnUS } from "../locales/en-US";
import { modelResourcesZhCN } from "../locales/zh-CN";
import {
  formatForecastAmount,
  formatQuotaTokenAmount,
  formatQuotaRemainingTokens,
} from "./quota-display";

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: "en-US",
    resources: {
      "en-US": { translation: modelResourcesEnUS },
      "zh-CN": { translation: modelResourcesZhCN },
    },
  });
});

describe("quota display helpers", () => {
  it("uses token quantity units when calculating forecast amount", () => {
    expect(formatForecastAmount(100, 0.01, 1, "thousand", "\uffe5")).toBe("\uffe51.00");
    expect(formatForecastAmount(2, 0.01, 3, "million", "\uffe5")).toBe("\uffe52.00");
  });
});

describe("quota amount units", () => {
  it("converts raw remaining tokens while preserving configuration values", () => {
    const t = i18n.getFixedT("en-US");
    expect(formatQuotaRemainingTokens(9000, 1, "month", t)).toBe("9 K tokens/month");
    expect(formatQuotaTokenAmount(10, 1, "month", t)).toBe("10 K tokens/month");
  });

  it.each([
    [1, 1000, "K"],
    [2, 10000, "10K"],
    [3, 100000000, "100M"],
    [4, 1000000, "M"],
    [5, 10000000, "10M"],
    [6, 100000000, "100M"],
  ])("converts unit %i using its own multiplier", (type, multiplier, label) => {
    const t = i18n.getFixedT("en-US");
    expect(formatQuotaRemainingTokens(multiplier * 1.5, type, "month", t)).toBe(
      `1.5 ${label} tokens/month`,
    );
    expect(formatQuotaTokenAmount(10, type, "month", t)).toBe(`10 ${label} tokens/month`);
  });

  it("preserves zero and small remaining balances without rounding away tokens", () => {
    const t = i18n.getFixedT("en-US");
    expect(formatQuotaRemainingTokens(0, 1, "month", t)).toBe("0 K tokens/month");
    expect(formatQuotaRemainingTokens(1, 3, "month", t)).toBe("0.00000001 100M tokens/month");
    expect(formatQuotaRemainingTokens(992, 1, "month", t)).toBe("0.992 K tokens/month");
  });

  it.each([0, undefined, 99])("falls back to raw tokens for an unknown unit %s", (type) => {
    expect(formatQuotaRemainingTokens(9000, type, "month", i18n.getFixedT("en-US"))).toBe(
      "9000 tokens/month",
    );
  });

  it.each([-1, undefined])("preserves the unavailable marker for %s", (value) => {
    const t = i18n.getFixedT("en-US");
    expect(formatQuotaRemainingTokens(value, 1, "month", t)).toBe("--");
    expect(formatQuotaTokenAmount(value, 1, "month", t)).toBe("--");
  });

  it("uses the selected locale's units for both quantities", () => {
    const t = i18n.getFixedT("zh-CN");
    expect(formatQuotaRemainingTokens(9000, 1, "月", t)).toBe("9 千 tokens/月");
    expect(formatQuotaTokenAmount(10, 1, "月", t)).toBe("10 千 tokens/月");
  });
});
