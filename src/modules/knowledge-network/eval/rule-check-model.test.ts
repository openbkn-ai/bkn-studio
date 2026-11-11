/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { evalLocales } from "./locales";

import { beforeEach, expect, it } from "vitest";
import { compileCriteria, newCriterion } from "./case-form-model";
import {
  ruleCheckAllowsAll,
  ruleCheckCriteria,
  validateRuleCheck,
  type RuleCheckCapability,
} from "./rule-check-model";
const caps: RuleCheckCapability[] = [
  {
    type: "numeric_range",
    name: "范围",
    kinds: ["objectProperty"],
    bindings: ["property"],
    help: "",
  },
  { type: "result_compare", name: "结果", kinds: ["api"], help: "" },
];
beforeEach(async () => {
  await i18n.init({
    lng: "zh-CN",
    resources: evalLocales,
    showSupportNotice: false,
    interpolation: { escapeValue: false },
  });
});

it("validates actual capability definitions without business rule IDs", () => {
  expect(() =>
    validateRuleCheck(
      "objectProperty",
      { type: "numeric_range", binding: "property", minimum: "0", maximum: "9007199254740993" },
      caps,
    ),
  ).not.toThrow();
  expect(() =>
    validateRuleCheck(
      "objectType",
      { type: "numeric_range", binding: "property", minimum: "0" },
      caps,
    ),
  ).toThrow();
  expect(() =>
    validateRuleCheck(
      "objectProperty",
      { type: "numeric_range", binding: "property", minimum: "2", maximum: "1" },
      caps,
    ),
  ).toThrow();
  expect(() =>
    validateRuleCheck("objectProperty", { type: "numeric_range", binding: "property" }, caps),
  ).toThrow();
  expect(ruleCheckAllowsAll({ type: "unique", binding: "primary_keys" })).toBe(true);
  expect(ruleCheckAllowsAll({ type: "unique", binding: "property" })).toBe(false);
});
it("preserves independent numeric output criteria including zero and rejects incomplete gold", () => {
  const c = {
    ...newCriterion(),
    path: "$.result.id",
    valueType: "number" as const,
    value: "0",
    valueProvided: true,
  };
  const compiled = compileCriteria([c]);
  const check = {
    type: "result_compare",
    assertions: compiled.assertions,
    expected: compiled.expected_spec,
  };
  expect(ruleCheckCriteria(check)[0]).toMatchObject({
    path: "$.result.id",
    value: "0",
    valueType: "number",
  });
  expect(() => validateRuleCheck("api", check, caps)).not.toThrow();
  expect(() =>
    validateRuleCheck("api", { type: "result_compare", assertions: [], expected: {} }, caps),
  ).toThrow();
});

it("requires executable composition and independently supplied comparison values", async () => {
  const { validateRuleProgram, newRuleProgram } = await import("./rule-check-model");
  expect(() => validateRuleProgram(newRuleProgram("objectProperty"))).not.toThrow();
  expect(() => validateRuleProgram({ version: 1 })).toThrow();
  expect(() =>
    validateRuleProgram({
      version: 1,
      aggregates: [{ function: "sum", field: "amount", operator: "eq", value: undefined }],
    }),
  ).toThrow("预期数值");
  expect(() =>
    validateRuleProgram({
      version: 1,
      expect: {
        mode: "all",
        conditions: [{ field: "id", operator: "eq", reference_field: "key" }],
      },
    }),
  ).toThrow("独立对照表");
});
