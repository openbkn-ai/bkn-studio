/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EvalRuleApplicationDrawer } from "./EvalRuleApplicationDrawer";
import { listEvalCaseResourcesPage, type EvalCaseDefinition } from "./m0-run.service";
import { compileCriteria } from "./case-form-model";
import {
  previewRuleApplication,
  saveRuleApplication,
  type RuleApplicationRow,
} from "./rule-application.service";
import type { EvalTemplateRule } from "./types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./m0-run.service", () => ({ listEvalCaseResourcesPage: vi.fn() }));
vi.mock("./case-form.service", () => ({ listCaseActionInstances: vi.fn() }));
vi.mock("./rule-application.service", () => ({
  previewRuleApplication: vi.fn(),
  saveRuleApplication: vi.fn(),
}));
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: () => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});
const label = (key: string) => `knowledgeNetwork.eval.ruleApplication.${key}`;
const footer = () => within(document.querySelector<HTMLElement>(".ant-drawer-footer")!);
const rule: EvalTemplateRule = {
  id: "object-key-uniqueness",
  kind: "objectType",
  title: "主键唯一",
  group: "实例",
  description: "检查主键",
  appliesWhen: "有主键",
  evidence: "实例",
  planDimensions: [],
  enabled: true,
  preset: "required",
  origin: "builtin",
  revision: 1,
  builtinVersion: 4,
};
const row: RuleApplicationRow = {
  key: "target:default",
  target_key: "target",
  resource: { kind: "objectType", id: "material" },
  resource_name: "物料",
  target_id: "material",
  target_name: "物料",
  rule_id: rule.id,
  rule_title: rule.title,
  rule_checksum: "rule-sha",
  resource_checksum: "resource-sha",
  match: "applicable",
  configuration: "complete",
  execution: "ready",
  execution_reason: "已关联数据检查",
  missing: [],
  sample: {
    target_key: "target",
    sample_id: "default",
    rule_checksum: "rule-sha",
    resource_checksum: "resource-sha",
    title: "物料主键唯一",
    question: "检查实例",
    arguments: {},
    scope: { mode: "sample", limit: 100 },
    expected: { violations: 0 },
    source_kind: "declared_contract",
    evidence_refs: ["bkn-rule://uniqueness"],
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
    entries: [{ kind: "objectType", id: "material", name: "物料" }],
    total: 1,
  });
  vi.mocked(previewRuleApplication).mockResolvedValue({
    entries: [row],
    total: 1,
    page: 1,
    limit: 10,
    scope_revision: 0,
  });
  vi.mocked(saveRuleApplication).mockResolvedValue([
    { key: row.key, status: "created", case_id: "case-1" },
  ]);
});

it("previews and saves selected samples through the shared server contract", async () => {
  const onSaved = vi.fn();
  const onOpenCase = vi.fn();
  render(
    <EvalRuleApplicationDrawer
      networkId="kn-1"
      rules={[rule]}
      seed={{ ruleIds: [rule.id] }}
      onClose={vi.fn()}
      onSaved={onSaved}
      onOpenCase={onOpenCase}
    />,
  );
  await screen.findByText("物料");
  fireEvent.click(screen.getAllByRole("checkbox")[1]);
  fireEvent.click(footer().getByRole("button", { name: label("next") }));
  await waitFor(() =>
    expect(previewRuleApplication).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({
        resources: [{ kind: "objectType", id: "material" }],
        rule_ids: [rule.id],
      }),
    ),
  );
  await footer().findByRole("button", { name: label("save") });
  expect(screen.queryByText(label("targetCount"))).toBeNull();
  fireEvent.click(screen.getAllByRole("checkbox")[1]);
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  await waitFor(() =>
    expect(saveRuleApplication).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ samples: [row.sample] }),
      expect.any(Function),
    ),
  );
  expect(onSaved).toHaveBeenCalledOnce();
  expect(await footer().findByRole("button", { name: label("done") })).toBeEnabled();
  expect(footer().queryByRole("button", { name: label("retry") })).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: label("details") }));
  expect(onOpenCase).toHaveBeenCalledWith("case-1");
});

async function openSelectedPreview(rows: RuleApplicationRow[], onClose = vi.fn()) {
  vi.mocked(previewRuleApplication).mockResolvedValue({
    entries: rows,
    total: rows.length,
    page: 1,
    limit: 10,
    scope_revision: 0,
  });
  render(
    <EvalRuleApplicationDrawer
      networkId="kn-1"
      rules={[rule]}
      seed={{ ruleIds: [rule.id], resources: [{ kind: "objectType", id: "material" }] }}
      onClose={onClose}
      onSaved={vi.fn()}
      onOpenCase={vi.fn()}
    />,
  );
  fireEvent.click(footer().getByRole("button", { name: label("next") }));
  await footer().findByRole("button", { name: label("save") });
  for (const checkbox of screen.getAllByRole("checkbox").slice(1)) {
    fireEvent.click(checkbox);
  }
  expect(screen.getAllByText(label("configureAndSave"))).toHaveLength(1);
  expect(screen.queryByText(label("saveCases"))).toBeNull();
  await footer().findByRole("button", { name: label("save") });
}

it("treats an all-reused response as success and finishes without another save", async () => {
  const onClose = vi.fn();
  vi.mocked(saveRuleApplication).mockResolvedValue([
    { key: row.key, status: "reused", case_id: "existing-case" },
  ]);
  await openSelectedPreview([row], onClose);
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  fireEvent.click(await footer().findByRole("button", { name: label("done") }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(saveRuleApplication).toHaveBeenCalledOnce();
  expect(footer().queryByRole("button", { name: label("retry") })).toBeNull();
  expect(screen.getByText(label("savedSummary"))).toBeTruthy();
});

it("retries only the failed sample and retains successful results", async () => {
  const second: RuleApplicationRow = {
    ...row,
    key: "target:second",
    sample: { ...row.sample, sample_id: "second" },
  };
  vi.mocked(saveRuleApplication)
    .mockResolvedValueOnce([
      { key: row.key, status: "created", case_id: "case-1" },
      { key: second.key, status: "failed", reason: "暂时不可用" },
    ])
    .mockResolvedValueOnce([{ key: second.key, status: "reused", case_id: "case-2" }]);
  await openSelectedPreview([row, second]);
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  fireEvent.click(await footer().findByRole("button", { name: label("retry") }));
  await footer().findByRole("button", { name: label("done") });
  expect(vi.mocked(saveRuleApplication).mock.calls[1]?.[1].samples).toEqual([second.sample]);
  expect(screen.getByText(label("created"))).toBeTruthy();
  expect(screen.getByText(label("reused"))).toBeTruthy();
}, 20000);

it("requires configuration changes for a conflict instead of offering a retry", async () => {
  vi.mocked(saveRuleApplication).mockResolvedValue([
    {
      key: row.key,
      status: "conflict",
      case_id: "existing-case",
      reason: "规则已变化，请核对已有用例。",
    },
  ]);
  await openSelectedPreview([row]);
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  expect(await footer().findByRole("button", { name: label("modify") })).toBeEnabled();
  expect(footer().queryByRole("button", { name: label("retry") })).toBeNull();
  expect(footer().queryByRole("button", { name: label("done") })).toBeNull();
  expect(screen.getByText("规则已变化，请核对已有用例。")).toBeTruthy();
});

it("keeps uncertain applicability visible and prevents selecting it", async () => {
  vi.mocked(previewRuleApplication).mockResolvedValue({
    entries: [
      {
        ...row,
        match: "unverified",
        configuration: "incomplete",
        match_reason: "分页合同尚不可读",
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    scope_revision: 0,
  });
  render(
    <EvalRuleApplicationDrawer
      networkId="kn-1"
      rules={[rule]}
      seed={{ ruleIds: [rule.id], resources: [{ kind: "objectType", id: "material" }] }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onOpenCase={vi.fn()}
    />,
  );
  fireEvent.click(footer().getByRole("button", { name: label("next") }));
  await screen.findByText("分页合同尚不可读");
  expect(screen.getAllByRole("checkbox")[1]).toBeDisabled();
  expect(footer().getByRole("button", { name: label("save") })).toBeDisabled();
});

it("drops samples from a removed resource and preserves remaining selections", async () => {
  const supplier = {
    ...row,
    key: "supplier:default",
    target_key: "supplier",
    target_name: "供应商",
    resource: { kind: "objectType", id: "supplier" },
    sample: { ...row.sample, target_key: "supplier" },
  };
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
    entries: [
      { kind: "objectType", id: "material", name: "物料" },
      { kind: "objectType", id: "supplier", name: "供应商" },
    ],
    total: 2,
  });
  vi.mocked(previewRuleApplication).mockImplementation((_kn, request) =>
    Promise.resolve({
      entries: [row, supplier].filter((item) =>
        request.resources.some((resource) => resource.id === item.resource.id),
      ),
      total: request.resources.length,
      page: 1,
      limit: 10,
      scope_revision: 0,
    }),
  );
  render(
    <EvalRuleApplicationDrawer
      networkId="kn-1"
      rules={[rule]}
      seed={{
        ruleIds: [rule.id],
        resources: [
          { kind: "objectType", id: "material" },
          { kind: "objectType", id: "supplier" },
        ],
      }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onOpenCase={vi.fn()}
    />,
  );
  fireEvent.click(footer().getByRole("button", { name: label("next") }));
  await footer().findByRole("button", { name: label("save") });
  for (const checkbox of screen.getAllByRole("checkbox").slice(1)) fireEvent.click(checkbox);
  fireEvent.click(footer().getByRole("button", { name: label("previous") }));
  await screen.findByText("物料");
  fireEvent.click(screen.getAllByRole("checkbox")[1]);
  fireEvent.click(footer().getByRole("button", { name: label("next") }));
  await waitFor(() =>
    expect(previewRuleApplication).toHaveBeenLastCalledWith(
      "kn-1",
      expect.objectContaining({ resources: [{ kind: "objectType", id: "supplier" }] }),
    ),
  );
  await footer().findByRole("button", { name: label("save") });
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  await waitFor(() =>
    expect(saveRuleApplication).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ samples: [supplier.sample] }),
      expect.any(Function),
    ),
  );
}, 20000);

it("does not save a selected candidate without an implemented execution", async () => {
  await openSelectedPreview([
    { ...row, execution: "unsupported", execution_reason: "已关联数据检查" },
  ]);
  expect(footer().getByRole("button", { name: label("save") })).toBeDisabled();
  expect(screen.getByText("knowledgeNetwork.eval.definitionOnly.selectedPending")).toBeTruthy();
  expect(saveRuleApplication).not.toHaveBeenCalled();
});

it("keeps large identifiers and exact expected amounts when applying sample input", async () => {
  const argumentsValue = '{"id":9007199254740993}';
  const expectedValue = '{"amount":0.1234567890123456789}';
  await openSelectedPreview([
    {
      ...row,
      expected_locked: false,
      sample: {
        ...row.sample,
        arguments: parsePrecisionPreservingJSON(argumentsValue) as Record<string, unknown>,
        expected: parsePrecisionPreservingJSON(expectedValue) as Record<string, unknown>,
      },
    },
  ]);
  fireEvent.click(document.querySelector("button.ant-table-row-expand-icon")!);
  expect(
    screen.getByLabelText<HTMLTextAreaElement>(label("arguments"), { selector: "textarea" }).value,
  ).toContain("9007199254740993");
  fireEvent.click(screen.getByRole("button", { name: label("applyConfiguration") }));
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  await waitFor(() => expect(saveRuleApplication).toHaveBeenCalledOnce());
  const sample = vi.mocked(saveRuleApplication).mock.calls[0][1].samples![0];
  expect(transformPrecisionSafeJSONRequest(sample.arguments)).toBe(argumentsValue);
  expect(transformPrecisionSafeJSONRequest(sample.expected)).toBe(expectedValue);
});

it("removes sample limits when changing to a supported full-data check", async () => {
  await openSelectedPreview([row]);
  fireEvent.click(document.querySelector("button.ant-table-row-expand-icon")!);
  fireEvent.mouseDown(screen.getByLabelText(label("scope"), { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByText(label("allData")));
  fireEvent.click(screen.getByRole("button", { name: label("applyConfiguration") }));
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  await waitFor(() => expect(saveRuleApplication).toHaveBeenCalledOnce());
  expect(vi.mocked(saveRuleApplication).mock.calls[0][1].samples![0].scope).toEqual({
    mode: "all",
  });
});
it("does not offer unsupported full-data mode for a property check", async () => {
  await openSelectedPreview([{ ...row, rule_id: "property-type" }]);
  fireEvent.click(document.querySelector("button.ant-table-row-expand-icon")!);
  fireEvent.mouseDown(screen.getByLabelText(label("scope"), { selector: '[role="combobox"]' }));
  expect(screen.queryByText(label("allData"))).toBeNull();
});

it("does not request empty JSON or editable provenance for a fixed object check", async () => {
  await openSelectedPreview([{ ...row, expected_locked: true }]);
  fireEvent.click(document.querySelector("button.ant-table-row-expand-icon")!);
  expect(screen.queryByRole("textbox", { name: label("arguments") })).toBeNull();
  expect(screen.getByText(label("noArguments"))).toBeTruthy();
  expect(screen.getByLabelText(label("source"), { selector: '[role="combobox"]' })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: label("evidence") })).toHaveAttribute("readonly");
});

it("reuses structured source parameters and fixed network arguments when applying a callable rule", async () => {
  await openSelectedPreview([
    {
      ...row,
      resource: { kind: "function", id: "echo" },
      input_contract: {
        available: true,
        system_arguments: { kn_id: "kn-1" },
        input: {
          type: "object",
          properties: {
            kn_id: { type: "string", const: "kn-1" },
            count: { type: "integer", title: "数量" },
          },
          required: ["kn_id", "count"],
        },
      },
      sample: { ...row.sample, scope: { mode: "invocation" }, arguments: { count: 0 } },
    },
  ]);
  fireEvent.click(document.querySelector("button.ant-table-row-expand-icon")!);
  expect(screen.queryByRole("textbox", { name: label("arguments") })).toBeNull();
  expect(screen.getByRole("spinbutton", { name: "count" })).toHaveValue("0");
  fireEvent.click(screen.getByRole("button", { name: label("applyConfiguration") }));
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  await waitFor(() => expect(saveRuleApplication).toHaveBeenCalledOnce());
  expect(vi.mocked(saveRuleApplication).mock.calls[0][1].samples![0].arguments).toEqual({
    kn_id: "kn-1",
    count: 0,
  });
});

it("saves a complete definition-only sample without claiming applicability or executable coverage", async () => {
  const compiled = compileCriteria([
    { id: "error", type: "equals", path: "$.error", value: "缺少编号", valueType: "string" },
  ]);
  const definition: EvalCaseDefinition = {
    title: "待执行检查",
    category: "fact",
    risk_level: "medium",
    input_spec: { question: "按独立合同检查缺失编号的行为", arguments: {} },
    execution_spec: { runner: "unbound" },
    ...compiled,
    expected_source: { kind: "business_expert", evidence_refs: ["接口合同第3节"] },
    diagnostic_spec: { definition_only: true, form_version: 2, rule_snapshot: rule },
  };
  await openSelectedPreview([
    {
      ...row,
      execution: "unsupported",
      match: "not_applicable",
      prepared_definition: definition,
      sample: {
        ...row.sample,
        definition_only: true,
        assertions: compiled.assertions,
        expected: compiled.expected_spec,
        source_kind: "business_expert",
        evidence_refs: ["接口合同第3节"],
      },
    },
  ]);
  fireEvent.click(document.querySelector("button.ant-table-row-expand-icon")!);
  await screen.findByRole("textbox", { name: "knowledgeNetwork.eval.definitionOnly.steps" });
  fireEvent.click(screen.getByRole("button", { name: label("applyConfiguration") }));
  fireEvent.click(footer().getByRole("button", { name: label("save") }));
  await waitFor(() => expect(saveRuleApplication).toHaveBeenCalledOnce());
  const sample = vi.mocked(saveRuleApplication).mock.calls[0][1].samples![0];
  expect(sample.definition_only).toBe(true);
  expect(sample.assertions).toEqual(compiled.assertions);
  expect(sample.source_kind).toBe("business_expert");
});

vi.mock("./EvalResourceCaseFields", () => ({
  EvalResourceCaseFields: ({ onPrepared }: { onPrepared: (value: EvalCaseDefinition) => void }) => (
    <button
      onClick={() =>
        onPrepared({
          title: "函数输入独立样本",
          category: "fact",
          risk_level: "medium",
          input_spec: { question: "只读回显", arguments: { count: 0 } },
          execution_spec: { runner: "direct_capability" },
          assertions: [
            { id: "value", type: "equals", source: "normalized_output", path: "$.count" },
            { id: "execution-evidence", type: "evidence_complete", required: true },
          ],
          expected_spec: { value: 0 },
          expected_source: { kind: "business_expert", evidence_refs: ["独立确认：输入0返回0"] },
          diagnostic_spec: { form_version: 2 },
        })
      }
    >
      完成来源参数与独立预期校验
    </button>
  ),
}));

it("saves a resource sample after server preparation replaces its initial incomplete execution state", async () => {
  const callableRule = {
    ...rule,
    id: "function-input",
    kind: "function" as const,
    title: "函数输入处理正确",
    check: { type: "resource_result", independent_value: true },
  };
  const pending: RuleApplicationRow = {
    ...row,
    resource: { kind: "function", id: "fn" },
    resource_name: "回显函数",
    target_id: "fn",
    target_name: "回显函数",
    rule_id: callableRule.id,
    rule_title: callableRule.title,
    check: callableRule.check,
    configuration: "incomplete",
    execution: "unsupported",
    missing: ["缺少参数与独立预期"],
    input_contract: { rule_based: true, available: true, runner: "direct_capability" },
  };
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
    entries: [{ kind: "function", id: "fn", name: "回显函数" }],
    total: 1,
  });
  vi.mocked(previewRuleApplication).mockResolvedValue({
    entries: [pending],
    total: 1,
    page: 1,
    limit: 10,
    scope_revision: 0,
  });
  render(
    <EvalRuleApplicationDrawer
      networkId="kn-1"
      rules={[callableRule]}
      seed={{ ruleIds: [callableRule.id] }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onOpenCase={vi.fn()}
    />,
  );
  await screen.findByText("回显函数");
  fireEvent.click(screen.getAllByRole("checkbox")[1]);
  fireEvent.click(footer().getByRole("button", { name: label("next") }));
  await footer().findByRole("button", { name: label("save") });
  fireEvent.click(document.querySelector("button.ant-table-row-expand-icon")!);
  fireEvent.click(screen.getByRole("button", { name: "完成来源参数与独立预期校验" }));
  fireEvent.click(screen.getByRole("button", { name: label("applyConfiguration") }));
  const save = footer().getByRole("button", { name: label("save") });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(saveRuleApplication).toHaveBeenCalledOnce());
  const sample = vi.mocked(saveRuleApplication).mock.calls[0][1].samples![0];
  expect(sample.arguments).toEqual({ count: 0 });
  expect(sample.assertions?.map((a) => a.id)).toEqual(["value"]);
  expect(sample.source_kind).toBe("business_expert");
});
