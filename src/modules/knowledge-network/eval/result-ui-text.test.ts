/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { afterEach, expect, it } from "vitest";
import { resultUi } from "./locales/result-ui";
import { resultUiText } from "./result-ui-text";

afterEach(async () => {
  if (i18n.isInitialized) await i18n.changeLanguage("zh-CN");
});

it("keeps result and navigation translations in parity", () => {
  expect(Object.keys(resultUi["en-US"]).sort()).toEqual(Object.keys(resultUi["zh-CN"]).sort());
});

it("uses current language for totals and aggregate results without caching translations", async () => {
  await i18n.init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: {} });
  expect(resultUiText("total", { count: 4 })).toBe("共 4 条");
  await i18n.changeLanguage("en-US");
  expect(resultUiText("total", { count: 4 })).toBe("4 total");
  expect(
    resultUiText("aggregateSummary", {
      rows: 100,
      checks: 2,
      outcome: resultUiText("aggregatePass"),
    }),
  ).toBe(
    "Completed full-scope aggregate comparisons: 2; currently visible records: 100. All configured criteria were met.",
  );
});

it("preserves literal business references in repair prompts when the host escapes values", async () => {
  await i18n.init({ lng: "zh-CN", resources: {}, interpolation: { escapeValue: true } });
  const prompt = "订单 <A&B/>";
  expect(resultUiText("repairRetry", { prompt })).toMatch(/^订单 <A&B\/> /);
});
