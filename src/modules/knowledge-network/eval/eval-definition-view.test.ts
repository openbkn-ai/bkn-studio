/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, it, vi } from "vitest";
vi.mock("i18next", () => ({ default: { t: (key: string) => key } }));
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import {
  criterionStandard,
  definitionObject,
  definitionValue,
  valueAtPath,
  ruleLabel,
} from "./eval-definition-view";
import type { EvalSuiteCaseDetail } from "./m0-run.service";
const detail = (expected: Record<string, unknown>, visible = true): EvalSuiteCaseDetail =>
  ({
    gold_visible: visible,
    source: {},
    definition: { input_spec: {}, diagnostic_spec: {}, expected_spec: expected },
  }) as EvalSuiteCaseDetail;
it("does not traverse prototypes or silently coerce invalid paths", () => {
  const value = { nested: { zero: 0, no: false, empty: "" } };
  expect(valueAtPath(value, "$")).toBe(value);
  expect(valueAtPath(value, "$.nested.zero")).toBe(0);
  expect(valueAtPath(value, "$.nested.no")).toBe(false);
  expect(valueAtPath(value, "$.nested.empty")).toBe("");
  for (const path of ["nested.zero", "$[0]", "$.toString", "$.nested.missing"])
    expect(valueAtPath(value, path)).toBeUndefined();
  expect(definitionObject([])).toEqual({});
  expect(definitionObject(null)).toEqual({});
});
it("renders empty, null and large integer values without precision loss", () => {
  expect(definitionValue(undefined)).toBe("—");
  expect(definitionValue("")).toBe('""');
  expect(definitionValue(null)).toBe("null");
  expect(definitionValue(parsePrecisionPreservingJSON('{"id":9007199254740993}'))).toBe(
    '{"id":9007199254740993}',
  );
});
it("keeps protected expected values out of criterion summaries", () => {
  const assertion = { type: "equals", expected_path: "$.secret" };
  const text = criterionStandard(assertion, detail({ secret: "gold-answer" }, false));
  expect(text).not.toContain("gold-answer");
  expect(criterionStandard(assertion, detail({ secret: false }))).toBe("false");
});
it("formats bounded and unbounded numeric ranges with inclusive edges", () => {
  const a = { type: "numeric_range", expected_path: "$.range" };
  expect(criterionStandard(a, detail({ range: { min: 0, max: 10, include_max: false } }))).toBe(
    "[0, 10)",
  );
  expect(criterionStandard(a, detail({ range: {} }))).toBe("(−∞, +∞)");
});
it("uses assertion schema and resource identity independently of hidden gold", () => {
  expect(
    criterionStandard({ type: "json_schema", schema: { type: "string" } }, detail({}, false)),
  ).toBe('{"type":"string"}');
  expect(
    criterionStandard({ type: "resource_used", resource: "mounted-tool" }, detail({}, false)),
  ).toBe("mounted-tool");
});
it("prefers the executed rule identity over mutable source metadata", () => {
  const d = detail({});
  d.definition.input_spec = {
    template_rule_title: "Frozen title",
    template_rule_id: "rule-1",
    template_rule_revision: 3,
  };
  d.source = { rule_title: "new title", rule_id: "rule-2" };
  expect(ruleLabel(d)).toContain("Frozen title");
  expect(ruleLabel(d)).not.toContain("rule-1");
  expect(ruleLabel(d)).toContain("3");
  expect(ruleLabel(d)).not.toContain("new title");
});

it("uses the rule title rather than an internal rule ID and reports a missing title honestly", () => {
  const d = detail({});
  d.definition.input_spec = {
    template_rule_id: "opaque-rule-id",
    template_rule_title: "属性值类型一致",
    template_rule_revision: 3,
  };
  expect(ruleLabel(d)).toContain("属性值类型一致");
  expect(ruleLabel(d)).not.toContain("opaque-rule-id");
  delete d.definition.input_spec.template_rule_title;
  expect(ruleLabel(d)).toContain("referencesUi.unnamedRule");
});
