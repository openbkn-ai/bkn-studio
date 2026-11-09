/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { beforeEach, expect, it } from "vitest";
import { evalLocales } from "./locales";
import { compileCriteria, validateCaseArguments } from "./case-form-model";
import { validateRuleProgram } from "./rule-check-model";
import { caseExecutionSetupLabel, caseExecutionSetupReason } from "./eval-case-execution";
import { evalReferenceLabel, readableEvalText } from "./eval-readable-references";
import { compareEvalRuns } from "./m0-run.service";
import { REGRESSION_SUITE_TAG } from "./types";

beforeEach(async () => {
  await i18n.init({
    lng: "zh-CN",
    resources: evalLocales,
    showSupportNotice: false,
    interpolation: { escapeValue: false },
  });
});

it.each([
  {
    language: "zh-CN",
    criteria: "请配置 1 至 20 项判定标准",
    argument: "参数.unit类型不正确，必须为数值",
    array: "参数.items至少需要2项",
    condition: "逐行校验第 1 条：请填写字段",
    execution: "可运行",
    grant: "缺少只读授权",
    comparison: "只能比较已有质量结论的运行",
  },
  {
    language: "en-US",
    criteria: "Configure 1 to 20 evaluation criteria",
    argument: "Parameters.unit has an incorrect type; a number is required",
    array: "Parameters.items must contain at least 2 items",
    condition: "Row checks, condition 1: enter a field",
    execution: "Runnable",
    grant: "Read-only authorization is missing",
    comparison: "Only runs with a quality result can be compared",
  },
])("translates validation and execution messages in $language", async (copy) => {
  await i18n.changeLanguage(copy.language);
  expect(() => compileCriteria([])).toThrow(copy.criteria);
  expect(() =>
    validateCaseArguments('{"unit":"wrong"}', {
      type: "object",
      properties: { unit: { type: "integer" } },
    }),
  ).toThrow(copy.argument);
  expect(() =>
    validateCaseArguments('{"items":[]}', {
      type: "object",
      properties: { items: { type: "array", minItems: 2 } },
    }),
  ).toThrow(copy.array);
  expect(() =>
    validateRuleProgram({
      version: 1,
      expect: { mode: "all", conditions: [{ field: "", operator: "eq", value: 1 }] },
    }),
  ).toThrow(copy.condition);
  expect(
    caseExecutionSetupLabel({
      id: "case-1",
      title: "Case",
      enabled: true,
      created_at: "",
      execution_setup: "ready_for_preflight",
    }),
  ).toBe(copy.execution);
  expect(caseExecutionSetupReason("grant_missing")).toBe(copy.grant);
  await expect(compareEvalRuns("kn", { id: "a" }, { id: "b" })).rejects.toThrow(copy.comparison);
});

it("resolves messages at call time without changing stored regression tags or reference patterns", async () => {
  expect(caseExecutionSetupReason("execution_not_configured")).toBe("需补充执行配置");
  const tag = REGRESSION_SUITE_TAG;
  await i18n.changeLanguage("en-US");
  expect(caseExecutionSetupReason("execution_not_configured")).toBe(
    "Execution configuration is required",
  );
  expect(REGRESSION_SUITE_TAG).toBe(tag);
  expect(REGRESSION_SUITE_TAG).toBe("回归");
  expect(i18n.t("knowledgeNetwork.eval.suiteUi.regressionTag")).toBe("Regression");
  const label = evalReferenceLabel("caseExecution", { name: "Order <gold>" });
  expect(label).toContain("Order <gold>");
  for (const prefix of ["用例执行 ID：", "case_run_id: "]) {
    expect(readableEvalText(prefix + "case-run-1", [{ id: "case-run-1", label }])).toBe(label);
  }
});
