/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeAll, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import { checkReasonText } from "@/modules/bkn-project/components/release/releaseMessages";

describe("knowledge-base review items in the release review", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  const reason = (details?: unknown) =>
    checkReasonText(i18n.t, {
      accept: "knowledge_base_review_items",
      code: "knowledge_base",
      details,
      passed: false,
      reason: "knowledge_base_review_items",
    });

  it("names only the kinds counted with items, and makes up no count", () => {
    expect(reason({ review_conflicts: 0, review_links: 3, review_values: "2" })).toBe(
      "知识库还有未处理的待核实条目：关联待核查 3 条。可以在构建页逐条处理，或确认后带着它们发布。",
    );
    for (const details of [undefined, {}, { review_links: 0, review_values: 1.5 }]) {
      expect(reason(details)).toBe(
        "知识库还有未处理的待核实条目。可以在构建页逐条处理，或确认后带着它们发布。",
      );
    }
  });
});
