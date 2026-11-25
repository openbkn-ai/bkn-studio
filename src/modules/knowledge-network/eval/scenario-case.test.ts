/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { expect, it } from "vitest";
import { buildScenarioCase } from "./scenario-case";

it("keeps a supply-chain goal separate from its independently checked answers", () => {
  const definition = buildScenarioCase(
    {
      title: "现货发货与剩余可承诺量",
      question: "产品382-000005需要50套，判断现货能否发货和发货后剩余量",
      scenarioContext: "业务日2026-08-25；仅成品仓",
      scenarioConstraints: "不写入业务数据，不启用替代料",
      outputRequirements: "返回can_ship和remaining_promisable_fg，数量单位为套",
      sourceKind: "independent_sample",
      evidenceRef: "当前samples库存CSV独立核算：三座成品仓325+82+127=534，扣除50后484",
      criteria: [
        { id: "ship", type: "equals", path: "$.can_ship", value: "true", valueType: "boolean" },
        {
          id: "stock",
          type: "equals",
          path: "$.remaining_promisable_fg",
          value: "484",
          valueType: "number",
        },
      ],
    },
    "supply_ontology_hand",
  );
  expect(definition.execution_spec).toEqual({
    runner: "agent_task",
    target_kind: "business_scenario",
    kn_id: "supply_ontology_hand",
  });
  expect(typeof definition.input_spec.question).toBe("string");
  expect(definition.input_spec).toMatchObject({
    context: "业务日2026-08-25；仅成品仓",
    output_fields: [
      { path: "$.can_ship", type: "boolean" },
      { path: "$.remaining_promisable_fg", type: "number" },
    ],
  });
  expect(JSON.stringify(definition.input_spec)).not.toContain("484");
  expect(definition.input_spec.arguments).toBeUndefined();
  expect(definition.expected_spec).toEqual({ criteria: { value_0: true, value_1: 484 } });
  expect(definition.expected_source).toEqual({
    kind: "independent_sample",
    evidence_refs: ["当前samples库存CSV独立核算：三座成品仓325+82+127=534，扣除50后484"],
  });
});

it("does not leak stale resource bindings and preserves zero and false as expected values", () => {
  const definition = buildScenarioCase(
    {
      title: "边界",
      question: "没有库存时能否发货",
      criteria: [
        { id: "zero", type: "equals", path: "$.stock", value: "0", valueType: "number" },
        { id: "false", type: "equals", path: "$.can_ship", value: "false", valueType: "boolean" },
      ],
    },
    "kn",
  );
  expect(definition.expected_spec).toEqual({ criteria: { value_0: 0, value_1: false } });
  expect(definition.diagnostic_spec).toEqual({ case_type: "scenario", form_version: 1, note: "" });
  expect(definition.execution_spec.target).toBeUndefined();
  expect(definition.expected_source.evidence_refs).toEqual([]);
});

it("describes the observed output type rather than the JSON configuration of a numeric range", () => {
  const definition = buildScenarioCase(
    {
      title: "库存范围",
      question: "评估可用库存",
      criteria: [
        {
          id: "range",
          type: "numeric_range",
          path: "$.available",
          value: '{"min":0,"max":100}',
          valueType: "json",
        },
      ],
    },
    "kn",
  );
  expect(definition.input_spec.output_fields).toEqual([{ path: "$.available", type: "number" }]);
  expect(JSON.stringify(definition.input_spec)).not.toContain('"max"');
});
