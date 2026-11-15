/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
import { EvalLogicalPropertyCaseFields } from "./EvalLogicalPropertyCaseFields";
import { getCaseTargetSchema, listCaseActionInstances } from "./case-form.service";
import { previewRuleApplication, type RuleApplicationRow } from "./rule-application.service";
import { type EvalCaseDefinition } from "./m0-run.service";
import { compileCriteria } from "./case-form-model";

vi.mock("./case-form.service", () => ({
  getCaseTargetSchema: vi.fn(),
  listCaseActionInstances: vi.fn(),
}));
vi.mock("./rule-application.service", () => ({ previewRuleApplication: vi.fn() }));
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", resources: evalLocales, interpolation: { escapeValue: false } });
});
const row: RuleApplicationRow = {
  key: "row",
  target_key: "logical",
  resource: { kind: "objectType", id: "order" },
  resource_name: "订单",
  target_id: "amount",
  target_name: "订单 / amount",
  rule_id: "logic-property-call",
  rule_title: "调用参数正确",
  rule_checksum: "rule",
  resource_checksum: "resource",
  match: "applicable",
  configuration: "incomplete",
  execution: "missing_configuration",
  execution_reason: "",
  missing: [],
  check: { type: "logical_property", binding: "call" },
  sample: {
    target_key: "logical",
    sample_id: "default",
    title: "订单逻辑属性",
    question: "检查计算结果",
    arguments: {},
    scope: { mode: "invocation" },
  },
};
const definition: EvalCaseDefinition = {
  title: "订单逻辑属性",
  category: "calculation",
  risk_level: "medium",
  input_spec: {
    question: "检查计算结果",
    arguments: { _instance_identities: [{ id: 1 }], dynamic_params: { count: 0 } },
  },
  execution_spec: { runner: "resource_query", logical_property: "amount" },
  assertions: [],
  expected_spec: { available: true, parameters_valid: true },
  expected_source: { kind: "declared_contract", evidence_refs: [] },
  diagnostic_spec: {},
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    available: true,
    logical_properties: [
      {
        name: "amount",
        display_name: "金额",
        input: {
          type: "object",
          properties: { count: { type: "integer" } },
          required: ["count"],
          additionalProperties: false,
        },
        output: { type: "object", properties: { result: { type: "number" } } },
      },
    ],
  });
  vi.mocked(listCaseActionInstances).mockResolvedValue({
    rows: [{ _instance_identity: { id: 1 }, _display: "真实订单" }],
    nextCursor: undefined,
  });
  vi.mocked(previewRuleApplication).mockResolvedValue({
    page: 1,
    limit: 1,
    total: 1,
    scope_revision: 1,
    entries: [{ ...row, ready_for_save: true, prepared_definition: definition }],
  });
});
it("uses an actual instance and explicit zero input without asking for business criteria on call checks", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalLogicalPropertyCaseFields
      networkId="kn"
      row={row}
      initialDefinition={definition}
      onPrepared={onPrepared}
    />,
  );
  expect(await screen.findByRole("combobox", { name: "执行实例" })).toBeTruthy();
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(definition));
  expect(vi.mocked(previewRuleApplication).mock.calls.at(-1)?.[1].samples?.[0].arguments).toEqual({
    _instance_identities: [{ id: 1 }],
    dynamic_params: { count: 0 },
  });
  expect(screen.queryByRole("combobox", { name: "如何判断 1" })).toBeNull();
});
it("does not prepare a case when required dynamic parameters are missing", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalLogicalPropertyCaseFields
      networkId="kn"
      row={row}
      initialDefinition={{
        ...definition,
        input_spec: {
          question: "检查",
          arguments: { _instance_identities: [{ id: 1 }], dynamic_params: {} },
        },
      }}
      onPrepared={onPrepared}
    />,
  );
  await screen.findByRole("combobox", { name: "执行实例" });
  await new Promise((r) => setTimeout(r, 300));
  expect(previewRuleApplication).not.toHaveBeenCalled();
  expect(onPrepared.mock.calls.every((c) => c[0] === undefined)).toBe(true);
});
it("preserves an independently entered zero result and makes supporting notes optional", async () => {
  const resultRow = {
    ...row,
    check: { type: "logical_property", binding: "result" },
    rule_id: "object-logic-property",
  };
  const expected = compileCriteria([
    {
      id: "value",
      type: "equals",
      path: "$.result",
      value: "0",
      valueType: "number",
      valueProvided: true,
    },
  ]);
  render(
    <EvalLogicalPropertyCaseFields
      networkId="kn"
      row={resultRow}
      initialDefinition={{
        ...definition,
        ...expected,
        expected_source: { kind: "business_expert", evidence_refs: [] },
      }}
      onPrepared={vi.fn()}
    />,
  );
  expect(await screen.findByRole("combobox", { name: "如何判断 1" })).toBeTruthy();
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  const sample = vi.mocked(previewRuleApplication).mock.calls.at(-1)![1].samples![0];
  expect(sample.expected).toEqual(expected.expected_spec);
  expect(sample.source_kind).toBe("business_expert");
  expect(sample.evidence_refs).toEqual([]);
});
it("invalidates prepared output immediately when the selected instance is cleared", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalLogicalPropertyCaseFields
      networkId="kn"
      row={row}
      initialDefinition={definition}
      onPrepared={onPrepared}
    />,
  );
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(definition));
  const select = screen.getByRole("combobox", { name: "执行实例" }).closest(".ant-select")!;
  fireEvent.mouseDown(select.querySelector(".ant-select-clear")!);
  await waitFor(() => expect(onPrepared).toHaveBeenLastCalledWith(undefined));
});
