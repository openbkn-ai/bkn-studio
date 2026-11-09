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

it.each([0, 1, 2])("uses natural English count nouns for count=%i", async (count) => {
  await i18n.changeLanguage("en-US");
  const item = count === 1 ? "item" : "items";
  const character = count === 1 ? "character" : "characters";
  const field = count === 1 ? "field" : "fields";
  const resource = count === 1 ? "resource" : "resources";
  const sample = count === 1 ? "sample" : "samples";
  const record = count === 1 ? "record" : "records";
  const scenario = count === 1 ? "scenario" : "scenarios";
  const suggestion = count === 1 ? "suggestion" : "suggestions";
  const text = (key: string, values?: Record<string, unknown>) =>
    i18n.t(`knowledgeNetwork.eval.${key}`, { ...values, count });

  expect(() =>
    validateCaseArguments(JSON.stringify({ items: Array.from({ length: count + 1 }, () => 0) }), {
      type: "object",
      properties: { items: { type: "array", maxItems: count } },
    }),
  ).toThrow(`Parameters.items may contain at most ${count} ${item}`);
  expect(() =>
    validateCaseArguments(JSON.stringify({ name: "x".repeat(count + 1) }), {
      type: "object",
      properties: { name: { type: "string", maxLength: count } },
    }),
  ).toThrow(`Parameters.name may contain at most ${count} ${character}`);
  expect(text("foundation.caseModel.minLength", { path: "Name" })).toBe(
    `Name must contain at least ${count} ${character}`,
  );
  expect(text("resultValueUi.fields")).toBe(`${count} ${field}`);
  expect(text("ruleApplication.selectedResources")).toBe(
    `${count} ${resource} selected (up to 200)`,
  );
  expect(text("ruleApplication.selectedSamples")).toBe(`${count} ${sample} selected (up to 50)`);
  expect(text("resultUi.summary.sampleFrom", { target: "Orders: ", total: 1 })).toBe(
    `Orders: Sampled ${count} ${record} (visible total: 1)`,
  );
  expect(text("foundation.assistant.skeletonSummary")).toBe(
    `Prepared ${count} non-runnable scenario ${count === 1 ? "skeleton" : "skeletons"} from current real resources. Add independent inputs, expectations and evidence before generating runnable cases.`,
  );
  expect(text("foundation.assistant.prompts.retryCount", { previous: 1 })).toBe(
    `Correct the previous result: the user requested exactly ${count} ${scenario}, but the previous valid suggestion count was 1. Return exactly ${count} distinct ${suggestion} referencing real resources and compatible rules.`,
  );
});

it.each([
  ["zh-CN", "两端各自最多关联一个对象", "不限制关联数量上限"],
  ["en-US", "At most one counterpart at either end", "No upper count limit"],
])("keeps cardinality labels separate from plural suffixes in %s", async (language, one, many) => {
  await i18n.changeLanguage(language);
  expect(i18n.t("knowledgeNetwork.eval.relationChecks.oneToOne")).toBe(one);
  expect(i18n.t("knowledgeNetwork.eval.relationChecks.manyToMany")).toBe(many);
  for (const key of ["oneToOne", "oneToMany", "manyToOne", "manyToMany"]) {
    expect(i18n.exists(`knowledgeNetwork.eval.relationChecks.${key}`)).toBe(true);
  }
});
