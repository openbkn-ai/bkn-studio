/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeAll, afterAll } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EvalRelationCaseFields } from "./EvalRelationCaseFields";
import {
  getCaseTargetSchema,
  listRelationCheckInstances,
  type RelationCheckForm,
} from "./case-form.service";
import {
  previewRuleApplication,
  type RuleApplicationPreview,
  type RuleApplicationRow,
} from "./rule-application.service";
import type { EvalCaseDefinition } from "./m0-run.service";

const initialMatchMedia = window.matchMedia;
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
});
afterAll(() => {
  window.matchMedia = initialMatchMedia;
});

vi.mock("./useEvalTranslation", async () => {
  const { evalPart } = await import("./locales/zh-CN");
  return {
    useEvalTranslation: () => ({
      t: (key: string) =>
        (evalPart.eval.relationChecks as Record<string, string>)[key.split(".").at(-1)!] ?? key,
      i18n: { language: "zh-CN" },
    }),
  };
});
vi.mock("./case-form.service", () => ({
  getCaseTargetSchema: vi.fn(),
  listRelationCheckInstances: vi.fn(),
}));
vi.mock("./rule-application.service", () => ({ previewRuleApplication: vi.fn() }));

const prepared = {
  title: "采购单供应商 · 关系检查",
  category: "relation",
  risk_level: "medium",
  input_spec: {},
  execution_spec: { runner: "resource_query", relation_rule: "relation-query" },
  assertions: [],
  expected_spec: { violations: 0 },
  expected_source: { kind: "declared_contract", evidence_refs: ["规则"] },
  diagnostic_spec: {},
} as EvalCaseDefinition;
const resource = { kind: "relationType", id: "purchase_supplier", name: "采购单供应商" };
const contract: RelationCheckForm = {
  type: "direct",
  source: { id: "purchase", name: "采购单", primary_keys: ["id"], data_properties: [] },
  target: { id: "supplier", name: "供应商", primary_keys: ["id"], data_properties: [] },
  cardinality: "many_to_one",
  required: ["source"],
  characteristics: [],
  properties: [],
  checks: [
    { id: "relation-query", title: "关系查询可用", applicable: true },
    { id: "relation-result", title: "关联结果正确", applicable: true },
    { id: "relation-cardinality", title: "关联数量符合基数", applicable: true },
    { id: "relation-required", title: "必有关联满足约束", applicable: true },
    {
      id: "relation-property-values",
      title: "关系属性值符合约束",
      applicable: false,
      reason: "仅声明了关系属性的间接关系适用。",
    },
  ],
};
const row = {
  key: "r",
  target_key: "target",
  resource,
  resource_name: resource.name,
  target_id: resource.id,
  target_name: resource.name,
  rule_id: "relation-query",
  rule_title: "关系查询可用",
  rule_checksum: "rule-sha",
  resource_checksum: "resource-sha",
  match: "applicable",
  configuration: "complete",
  execution: "ready",
  execution_reason: "",
  missing: [],
  sample: {
    target_key: "target",
    sample_id: "default",
    rule_checksum: "rule-sha",
    resource_checksum: "resource-sha",
    title: prepared.title,
    question: "关系检查",
    arguments: {},
    scope: { mode: "invocation" },
    expected: { violations: 0 },
    source_kind: "declared_contract",
    evidence_refs: ["规则"],
  },
} as RuleApplicationRow;
const preview = (entry: RuleApplicationRow): RuleApplicationPreview => ({
  entries: [entry],
  total: 1,
  page: 1,
  limit: 1,
  scope_revision: 1,
});
const choose = (label: string, option: string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByText(option, { selector: ".ant-select-item-option-content" }));
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(previewRuleApplication).mockImplementation((_, request) =>
    Promise.resolve(
      preview(
        request.samples?.length
          ? { ...row, ready_for_save: true, prepared_definition: prepared }
          : row,
      ),
    ),
  );
  vi.mocked(listRelationCheckInstances).mockImplementation((_, endpoint) =>
    Promise.resolve({
      rows: [
        {
          _display: endpoint.id === "purchase" ? "采购单一" : "供应商一",
          id: endpoint.id === "purchase" ? "PO001" : "S001",
          _instance_identity: { id: endpoint.id === "purchase" ? "PO001" : "S001" },
        },
      ],
      nextCursor: undefined,
    }),
  );
});
it("prepares query availability without exposing meaningless invocation parameters", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={contract}
      onPrepared={onPrepared}
    />,
  );
  choose("检查项", "关系查询可用");
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
  expect(screen.queryByText("调用参数")).toBeNull();
  expect(screen.getByText(/零关联允许通过/)).toBeTruthy();
  expect(vi.mocked(previewRuleApplication).mock.calls.at(-1)?.[1].samples?.[0].arguments).toEqual({
    relation_check: { rule: "relation-query" },
  });
});
it("requires real endpoints, an explicit negative expectation and independent evidence", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={contract}
      onPrepared={onPrepared}
    />,
  );
  choose("检查项", "关联结果正确");
  await screen.findByRole("combobox", { name: "起点实例 · 采购单" });
  await waitFor(() => expect(listRelationCheckInstances).toHaveBeenCalledTimes(2));
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
  choose("起点实例 · 采购单", '采购单一 · {"id":"PO001"}');
  choose("终点实例 · 供应商", '供应商一 · {"id":"S001"}');
  choose("预期关联", "不应关联");
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
  fireEvent.change(screen.getByRole("textbox", { name: "预期依据" }), {
    target: { value: "业务确认：该采购单没有采购此供应商。" },
  });
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
  const sample = vi.mocked(previewRuleApplication).mock.calls.at(-1)?.[1].samples?.[0];
  expect(sample?.expected).toEqual({ related: false });
  expect(sample?.arguments).toEqual({
    relation_check: { rule: "relation-result", source: { id: "PO001" }, target: { id: "S001" } },
  });
  expect(sample?.source_kind).toBe("business_expert");
});
it("restricts cardinality checks to the constrained side and keeps sampling explicit", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={contract}
      onPrepared={onPrepared}
    />,
  );
  choose("检查项", "关联数量符合基数");
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
  expect(screen.getByRole("spinbutton", { name: "最多检查条数" })).toHaveValue("100");
  expect(screen.getAllByText("起点对象 · 采购单").length).toBeGreaterThan(0);
  expect(vi.mocked(previewRuleApplication).mock.calls.at(-1)?.[1].samples?.[0].arguments).toEqual({
    relation_check: { rule: "relation-cardinality", end: "source", limit: 100 },
  });
});
it("keeps inapplicable reasons collapsed and links to the actual relation editor", async () => {
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={contract}
      onPrepared={vi.fn()}
    />,
  );
  expect(screen.queryByText("仅声明了关系属性的间接关系适用。")).not.toBeInTheDocument();
  const link = screen.getByRole("link", { name: "配置关联约束" });
  expect(link).toHaveAttribute(
    "href",
    expect.stringContaining(
      "/knowledge-network/workspace/kn/relation-types/purchase_supplier/edit",
    ),
  );
  expect(link).toHaveAttribute("target", "_blank");
  fireEvent.click(screen.getByText(/不适用的检查项/));
  expect(await screen.findByText("仅声明了关系属性的间接关系适用。")).toBeInTheDocument();
});
it("clears a prepared definition on service failure and allows retry", async () => {
  vi.mocked(previewRuleApplication).mockRejectedValueOnce(Error("service unavailable"));
  const onPrepared = vi.fn();
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={contract}
      onPrepared={onPrepared}
    />,
  );
  choose("检查项", "关系查询可用");
  await screen.findByText("检查配置读取失败，请重试。");
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
  fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
});

it("refreshes declarations after configuration and exposes newly applicable checks", async () => {
  const onPrepared = vi.fn();
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    relation: {
      ...contract,
      cardinality: "one_to_one",
      checks: contract.checks.map((c) => ({ ...c, applicable: true })),
    },
  });
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={contract}
      onPrepared={onPrepared}
    />,
  );
  expect(screen.getByText("每个起点最多关联一个终点")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "刷新关系配置" }));
  await screen.findByText("两端各自最多关联一个对象");
  expect(getCaseTargetSchema).toHaveBeenCalledWith(resource, "kn");
  expect(screen.queryByText(/不适用的检查项/)).not.toBeInTheDocument();
  expect(onPrepared).toHaveBeenCalledWith(undefined);
});

it("passes fresh sample checksums back to rule application after preparation", async () => {
  const onSamplePrepared = vi.fn();
  vi.mocked(previewRuleApplication).mockImplementation((_, request) =>
    Promise.resolve(
      preview(
        request.samples?.length
          ? {
              ...row,
              sample: { ...row.sample, resource_checksum: "fresh-resource-sha" },
              ready_for_save: true,
              prepared_definition: prepared,
            }
          : row,
      ),
    ),
  );
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={contract}
      onPrepared={vi.fn()}
      onSamplePrepared={onSamplePrepared}
    />,
  );
  choose("检查项", "关系查询可用");
  await waitFor(() =>
    expect(onSamplePrepared).toHaveBeenCalledWith(
      expect.objectContaining({ resource_checksum: "fresh-resource-sha" }),
    ),
  );
});
it("uses one concise hint instead of four empty declaration rows", () => {
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={{
        ...contract,
        cardinality: undefined,
        required: [],
        characteristics: [],
        properties: [],
      }}
      onPrepared={vi.fn()}
    />,
  );
  expect(
    screen.getByText("未声明额外关联约束，可配置基础查询和关联结果检查。"),
  ).toBeInTheDocument();
  expect(screen.queryByText("未声明", { exact: true })).not.toBeInTheDocument();
});

it("hides configuration fields and does not prepare a selected check that became inapplicable", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalRelationCaseFields
      networkId="kn"
      resource={resource}
      contract={{
        ...contract,
        cardinality: undefined,
        checks: contract.checks.map((c) =>
          c.id === "relation-cardinality"
            ? { ...c, applicable: false, reason: "未声明数量限制" }
            : c,
        ),
      }}
      initialDefinition={{
        ...prepared,
        input_spec: {
          arguments: {
            relation_check: { rule: "relation-cardinality", end: "source", limit: 100 },
          },
        },
      }}
      onPrepared={onPrepared}
    />,
  );
  expect(screen.getByText("未声明数量限制")).toBeInTheDocument();
  expect(screen.queryByRole("spinbutton", { name: "最多检查条数" })).not.toBeInTheDocument();
  expect(screen.queryByText("判定标准", { exact: true })).not.toBeInTheDocument();
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
});
