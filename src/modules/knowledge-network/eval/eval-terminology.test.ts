/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeAll, expect, it } from "vitest";
import i18n from "i18next";
import { evalLocales } from "./locales";
import { evalExecutionStatusLabel, evalOutcomeLabel, evalTerm } from "./eval-terminology";
beforeAll(async () => {
  await i18n.init({ lng: "zh-CN", resources: evalLocales });
});
it("keeps failed execution separate from an unsuccessful business result", () => {
  expect(evalExecutionStatusLabel("failed")).toBe("执行异常");
  expect(evalOutcomeLabel("fail")).toBe("未通过");
  expect(evalOutcomeLabel("review_required")).toBe("需人工判断");
  expect(evalExecutionStatusLabel("running")).toBe("执行中");
});
it("reuses terms across creation, suite details and run results without merging scope meanings", () => {
  for (const key of ["resultUi.resource", "suiteCaseUi.target"])
    expect(i18n.t(`knowledgeNetwork.eval.${key}`)).toBe(evalTerm("assessmentTarget"));
  for (const key of ["resultUi.testQuestion", "suiteCaseUi.question"])
    expect(i18n.t(`knowledgeNetwork.eval.${key}`)).toBe(evalTerm("testInput"));
  expect(
    new Set([evalTerm("assessmentScope"), evalTerm("checkScope"), evalTerm("runScope")]).size,
  ).toBe(3);
});
it("resolves shared English labels after a language change", async () => {
  await i18n.changeLanguage("en-US");
  expect(evalTerm("caseName")).toBe("Case name");
  expect(i18n.t("knowledgeNetwork.eval.resultUi.resource")).toBe("Evaluation target");
  expect(evalExecutionStatusLabel("failed")).toBe("Execution error");
  await i18n.changeLanguage("zh-CN");
});

it("resolves every shared terminology reference in both languages", async () => {
  for (const language of ["zh-CN", "en-US"] as const) {
    await i18n.changeLanguage(language);
    const visit = (value: unknown, path: string) => {
      if (typeof value === "string" && value.includes("$t(knowledgeNetwork.eval.terms.")) {
        expect(i18n.t(path)).not.toContain("$t(");
        expect(i18n.t(path)).not.toContain("knowledgeNetwork.eval.");
      } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value))
          visit(child, path ? `${path}.${key}` : key);
      }
    };
    visit(evalLocales[language].knowledgeNetwork, "knowledgeNetwork");
  }
  await i18n.changeLanguage("zh-CN");
});
