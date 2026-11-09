/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
import { getCaseFormOptions, getCaseTargetSchema } from "./case-form.service";
vi.mock("./case-form.service", () => ({
  getCaseFormOptions: vi.fn(),
  getCaseTargetSchema: vi.fn(),
  listCaseActionInstances: vi.fn(),
}));
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
import { EvalCaseEditorDrawer } from "./EvalCaseEditorDrawer";
import {
  createEvalCase,
  getEvalCaseDraft,
  getEvalTemplateConfig,
  getM1RunCapabilities,
  listEvalCaseResources,
  listEvalCaseResourcesPage,
  listEvalReviewedFunctions,
  replaceEvalCase,
  removeEvalCase,
  trialEvalCase,
} from "./m0-run.service";
import type { EvalCaseDraft } from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  createEvalCase: vi.fn(),
  getEvalCaseDraft: vi.fn(),
  getEvalTemplateConfig: vi.fn(),
  getM1RunCapabilities: vi.fn(),
  listEvalCaseResources: vi.fn(),
  listEvalCaseResourcesPage: vi.fn(),
  listEvalReviewedFunctions: vi.fn(),
  replaceEvalCase: vi.fn(),
  trialEvalCase: vi.fn(),
  removeEvalCase: vi.fn(),
}));

import { previewRuleApplication } from "./rule-application.service";
vi.mock("./rule-application.service", () => ({ previewRuleApplication: vi.fn() }));

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

const draft: EvalCaseDraft = {
  case_id: "manual-1",
  revision: 2,
  enabled: false,
  checksum: "a".repeat(64),
  definition: {
    title: "供应商必须存在",
    category: "relation",
    risk_level: "medium",
    input_spec: { question: "采购订单的供应商是谁？" },
    execution_spec: { runner: "unbound", runnable: false },
    assertions: [{ id: "business-answer", type: "manual_review" }],
    expected_spec: { answer: "供应商 A" },
    expected_source: { kind: "business_expert", evidence_refs: ["工单-1"] },
    diagnostic_spec: { note: "核对供应商" },
  },
  created_by: "alice",
  updated_by: "alice",
  created_at: "2026-10-30T00:00:00Z",
  updated_at: "2026-10-30T00:00:00Z",
};

const saveWithoutEnabling = () => {
  const toggle = screen.getByLabelText("启用用例", { exact: true, selector: '[role="switch"]' });
  if (toggle.getAttribute("aria-checked") === "true") fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    revision: 1,
    checksum: "rules",
    rules: [],
    execution_support: {},
  });
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 1, predicates: [] });
  vi.mocked(getCaseTargetSchema).mockImplementation((resource) =>
    Promise.resolve({
      runner: resource.kind === "function" ? "direct_capability" : "resource_query",
    }),
  );
  vi.mocked(createEvalCase).mockResolvedValue({ ...draft, enabled: false, revision: 1 });
  vi.mocked(getEvalCaseDraft).mockResolvedValue(draft);
  vi.mocked(getM1RunCapabilities).mockResolvedValue(true);
  vi.mocked(listEvalReviewedFunctions).mockResolvedValue([]);
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
    entries: [],
    total: 0,
  });
  vi.mocked(listEvalCaseResources).mockImplementation((_networkId, kind) =>
    Promise.resolve({
      entries:
        kind === "function"
          ? [{ id: "leadtime", name: "标准交期", kind: "function" }]
          : [{ id: "order-1", name: "采购订单", kind: "objectType" }],
      total: 1,
    }),
  );
  vi.mocked(trialEvalCase).mockResolvedValue({
    trial_id: "trial-1",
    definition_checksum: "a".repeat(64),
    actual: { leadtime_days: 14 },
    expected: { leadtime_days: 14 },
    evaluation: {
      quality_outcome: "pass",
      assertions: [{ id: "expected-value", outcome: "pass" }],
    },
    evidence_status: "complete",
  });
});

it("creates a reviewed read-only Function draft without self-granting execution rights", async () => {
  vi.mocked(listEvalReviewedFunctions).mockResolvedValue([
    { name: "标准交期", operation: "leadtime_days" },
  ]);
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  await waitFor(() => expect(listEvalReviewedFunctions).toHaveBeenCalledWith("kn-1"));
  fireEvent.mouseDown(
    screen.getByLabelText("资源类型", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("函数", { exact: true }));
  fireEvent.mouseDown(
    screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("标准交期"));
  await screen.findByRole("combobox", { name: "只读函数" });
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "交期应该为 14 天" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /测试输入|测试说明（选填）/ }), {
    target: { value: "物料交期是多少？" },
  });
  fireEvent.change(screen.getByLabelText("输入参数", { exact: true, selector: "input,textarea" }), {
    target: { value: '{"material_code":"606-000989"}' },
  });
  fireEvent.change(
    screen.getByLabelText("预期结果（JSON）", { exact: true, selector: "input,textarea" }),
    {
      target: { value: '{"leadtime_days":14}' },
    },
  );
  fireEvent.change(
    screen.getByLabelText("比对字段路径", { exact: true, selector: "input,textarea" }),
    {
      target: { value: "$.leadtime_days" },
    },
  );
  fireEvent.change(screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" }), {
    target: { value: "独立业务合同-14" },
  });
  await waitFor(() =>
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "试运行" }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "试运行" }));
  await waitFor(() => expect(trialEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(trialEvalCase).mock.calls[0][1].execution_spec).toMatchObject({
    runner: "direct_capability",
  });
  expect(await screen.findByText("用例试运行结果")).toBeTruthy();
  expect(screen.getByText("预期结果比对")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回编辑" }));
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await waitFor(() => expect(createEvalCase).toHaveBeenCalledOnce());
  const definition = vi.mocked(createEvalCase).mock.calls[0][1];
  expect(definition.input_spec).toEqual({
    question: "物料交期是多少？",
    arguments: { material_code: "606-000989" },
  });
  expect(definition.execution_spec).toMatchObject({
    runner: "direct_capability",
    target: {
      kn_id: "kn-1",
      capability_type: "function",
      metadata_type: "function",
      name: "标准交期",
      operation: "leadtime_days",
      resource_id: "leadtime",
    },
  });
  expect(definition.expected_spec).toEqual({ leadtime_days: 14 });
  expect(
    definition.assertions.some((a) => a.type === "equals" && a.path === "$.leadtime_days"),
  ).toBe(true);
  expect(
    definition.assertions.some((a) => a.type === "resource_used" && a.resource === "标准交期"),
  ).toBe(true);
}, 60000);

it("requires an executable object check instead of accepting a natural-language request", async () => {
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.mouseDown(
    screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("采购订单"));
  expect(
    await screen.findByLabelText("检查项", { exact: true, selector: '[role="combobox"]' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText("测试输入", { exact: true, selector: "input,textarea" }),
  ).toBeNull();
  expect(screen.queryByRole("combobox", { name: "如何判断 1" })).toBeNull();
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "试运行" })).toBeNull();
  expect(createEvalCase).not.toHaveBeenCalled();
});

it("preselects an overview resource for creation and resets it on the next blank creation", async () => {
  const props = { networkId: "kn-1", open: true, onClose: vi.fn(), onChanged: vi.fn() };
  const view = render(
    <EvalCaseEditorDrawer
      {...props}
      initialResource={{ kind: "function", id: "leadtime", name: "标准交期" }}
    />,
  );
  await waitFor(() => expect(listEvalCaseResources).toHaveBeenCalledWith("kn-1", "function", ""));
  expect(
    screen
      .getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' })
      .closest(".ant-select")?.textContent,
  ).toContain("标准交期");
  view.rerender(<EvalCaseEditorDrawer {...props} open={false} />);
  view.rerender(<EvalCaseEditorDrawer {...props} />);
  await waitFor(() => expect(listEvalCaseResources).toHaveBeenCalledWith("kn-1", "objectType", ""));
  expect(
    screen
      .getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' })
      .closest(".ant-select")?.textContent,
  ).not.toContain("标准交期");
});

it("rejects an unsupported action even when save-after-enable is off", async () => {
  vi.mocked(listEvalCaseResources).mockImplementation((_networkId, kind) =>
    Promise.resolve({
      entries:
        kind === "action"
          ? [{ id: "create-po", name: "发起 PO", kind: "action" }]
          : [{ id: "order-1", name: "采购订单", kind: "objectType" }],
      total: 1,
    }),
  );
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  expect(screen.queryByText("分类标签")).toBeNull();
  fireEvent.mouseDown(
    screen.getByLabelText("资源类型", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("行动类"));
  fireEvent.mouseDown(
    screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("发起 PO"));
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "发起采购前必须核对权限" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /测试输入|测试说明（选填）/ }), {
    target: { value: "当前用户是否有权发起采购？" },
  });
  fireEvent.change(screen.getByLabelText("预期结果", { exact: true, selector: "input,textarea" }), {
    target: { value: "仅允许授权用户发起" },
  });
  fireEvent.change(screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" }), {
    target: { value: "采购授权规范" },
  });
  saveWithoutEnabling();
  await screen.findByText(/当前评测对象暂不支持自动运行/);
  expect(createEvalCase).not.toHaveBeenCalled();
  expect(replaceEvalCase).not.toHaveBeenCalled();
}, 30000);

it("requires an implemented execution for a business scenario", async () => {
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  expect(screen.getByText("场景测试")).toBeTruthy();
  expect(screen.getByText("安全测试")).toBeTruthy();
  fireEvent.click(screen.getByText("场景测试"));
  expect(
    screen.queryByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  ).toBeNull();
  expect(
    screen.queryByLabelText("资源类型", { exact: true, selector: '[role="combobox"]' }),
  ).toBeNull();
  expect(screen.queryByText("资源关联方式")).toBeNull();
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "供应链需求齐套判断" },
  });
  fireEvent.change(
    screen.getByLabelText("场景描述与测试输入", { exact: true, selector: "input,textarea" }),
    {
      target: { value: "当前订单能否齐套？" },
    },
  );
  fireEvent.change(screen.getByLabelText("预期结果", { exact: true, selector: "input,textarea" }), {
    target: { value: "不能齐套" },
  });
  fireEvent.change(screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" }), {
    target: { value: "业务验收记录-1" },
  });
  saveWithoutEnabling();
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  expect(
    await screen.findByText("当前没有已授权的场景执行入口，请先配置只读函数授权。"),
  ).toBeTruthy();
  expect(createEvalCase).not.toHaveBeenCalled();
  expect(replaceEvalCase).not.toHaveBeenCalled();
}, 30000);

it("clears a previous resource and blocks an unbound scenario", async () => {
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.mouseDown(
    screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("采购订单"));
  fireEvent.click(screen.getByText("场景测试"));
  expect(
    screen.queryByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "跨资源交期核对" },
  });
  fireEvent.change(
    screen.getByLabelText("场景描述与测试输入", { exact: true, selector: "input,textarea" }),
    {
      target: { value: "订单能否按期交付？" },
    },
  );
  fireEvent.change(screen.getByLabelText("预期结果", { exact: true, selector: "input,textarea" }), {
    target: { value: "可以" },
  });
  fireEvent.change(screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" }), {
    target: { value: "验收记录-2" },
  });
  saveWithoutEnabling();
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  expect(
    await screen.findByText("当前没有已授权的场景执行入口，请先配置只读函数授权。"),
  ).toBeTruthy();
  expect(createEvalCase).not.toHaveBeenCalled();
  expect(replaceEvalCase).not.toHaveBeenCalled();
}, 30000);

it("does not save an unsupported security scenario", async () => {
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByText("安全测试"));
  expect(screen.getByText("评测对象（可选）")).toBeTruthy();
  expect(screen.queryByText("资源关联方式")).toBeNull();
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "越权访问检查" },
  });
  fireEvent.change(
    screen.getByLabelText("安全测试输入", { exact: true, selector: "input,textarea" }),
    {
      target: { value: "普通用户能否读取其他租户资源？" },
    },
  );
  fireEvent.change(screen.getByLabelText("预期结果", { exact: true, selector: "input,textarea" }), {
    target: { value: "拒绝访问" },
  });
  fireEvent.change(screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" }), {
    target: { value: "权限设计规范" },
  });
  saveWithoutEnabling();
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  expect(
    await screen.findByText("当前没有已授权的场景执行入口，请先配置只读函数授权。"),
  ).toBeTruthy();
  expect(createEvalCase).not.toHaveBeenCalled();
  expect(replaceEvalCase).not.toHaveBeenCalled();
}, 30000);

it("keeps object security checks structured and blocks saving without a check", async () => {
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByText("安全测试"));
  fireEvent.mouseDown(
    screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("采购订单"));
  expect(
    await screen.findByLabelText("检查项", { exact: true, selector: '[role="combobox"]' }),
  ).toBeTruthy();
  expect(
    screen.getByLabelText("安全前提与验证目标", { exact: true, selector: "input,textarea" }),
  ).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "预期结果" })).toBeNull();
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  expect(createEvalCase).not.toHaveBeenCalled();
}, 30000);

it("shows a disabled case without review actions", async () => {
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("供应商必须存在");
  expect(
    screen
      .getByLabelText("启用用例", { exact: true, selector: '[role="switch"]' })
      .getAttribute("aria-checked"),
  ).toBe("false");
  expect(screen.queryByRole("button", { name: "确认审核" })).toBeNull();
  expect(screen.queryByRole("button", { name: /驳回/ })).toBeNull();
});

it("keeps the enable switch on for an enabled case", async () => {
  vi.mocked(getEvalCaseDraft).mockResolvedValue({ ...draft, enabled: true });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("供应商必须存在");
  const toggle = screen.getByLabelText<HTMLButtonElement>("启用用例", {
    exact: true,
    selector: '[role="switch"]',
  });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(toggle.disabled).toBe(false);
});

it("deletes an active case from the editor", async () => {
  const onChanged = vi.fn();
  vi.mocked(getEvalCaseDraft).mockResolvedValue({ ...draft, enabled: true });
  vi.mocked(removeEvalCase).mockResolvedValue({ result: "deleted" });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={onChanged}
    />,
  );
  await screen.findByDisplayValue("供应商必须存在");
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(await screen.findByText("删除这条用例？")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: /删\s*除/ })[1]);
  await waitFor(() => expect(removeEvalCase).toHaveBeenCalledWith("kn-1", "manual-1", "delete"));
  expect(onChanged).toHaveBeenCalled();
});

it("keeps an old imported sample readable and blocks saving without execution", async () => {
  const imported: EvalCaseDraft = {
    ...draft,
    case_id: "supply-v3-s-01",
    enabled: false,
    definition: {
      ...draft.definition,
      category: "decision",
      risk_level: "critical",
      input_spec: { question: "供应能力是多少？", arguments: { supplier_id: "S-01" } },
      execution_spec: {
        runner: "unbound",
        runnable: false,
        target: { name: "供应商", resource_id: "supplier-1" },
      },
      expected_spec: { amount: 42, unit: "件" },
      expected_source: { kind: "independent_sample", evidence_refs: ["sample://s-01"] },
      assertions: [{ id: "sample-review", type: "manual_review" }],
    },
  };
  vi.mocked(getEvalCaseDraft).mockResolvedValue(imported);
  vi.mocked(replaceEvalCase).mockResolvedValue({ ...imported, revision: 3 });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId={imported.case_id}
      sourceType="imported_sample"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("供应能力是多少？");
  const expectedInput = screen.getByLabelText("预期结果（JSON）", {
    exact: true,
    selector: "input,textarea",
  });
  if (!(expectedInput instanceof HTMLTextAreaElement))
    throw new Error("expected JSON input missing");
  expect(expectedInput.value).toContain('"amount": 42');
  saveWithoutEnabling();
  await screen.findByText(/当前评测对象暂不支持自动运行/);
  expect(createEvalCase).not.toHaveBeenCalled();
  expect(replaceEvalCase).not.toHaveBeenCalled();
});

it("shows frozen rule gold and rejects an unsupported legacy execution", async () => {
  const application: EvalCaseDraft = {
    ...draft,
    enabled: false,
    definition: {
      ...draft.definition,
      execution_spec: {
        runner: "unbound",
        target_kind: "resource",
        target: { resource_id: "order-1", capability_type: "objectType", name: "采购订单" },
      },
      assertions: [
        {
          id: "expected-output",
          type: "equals",
          source: "normalized_output",
          path: "$",
          required: true,
        },
        { id: "execution-evidence", type: "evidence_complete", required: true },
      ],
      expected_spec: { violations: 0 },
      diagnostic_spec: { rule_snapshot: { id: "object-key-uniqueness" }, expected_locked: true },
    },
  };
  vi.mocked(getEvalCaseDraft).mockResolvedValue(application);
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      open
      caseId={application.case_id}
      sourceType="template"
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  const expected = await screen.findByLabelText("预期结果（JSON）");
  expect(expected).toHaveAttribute("readonly");
  fireEvent.click(await screen.findByRole("button", { name: "确定" }));
  await screen.findByText(/当前评测对象暂不支持自动运行/);
  expect(replaceEvalCase).not.toHaveBeenCalled();
});

it("edits and trials a deterministic object check without replacing its predicate or provenance", async () => {
  const objectDraft: EvalCaseDraft = {
    ...draft,
    definition: {
      ...draft.definition,
      title: "物料主键检查",
      category: "fact",
      input_spec: {
        question: "检查主键是否非空",
        arguments: {},
        check_scope: { mode: "sample", limit: 100 },
        template_rule_id: "object-key-completeness",
        template_rule_revision: 1,
        template_rule_title: "实例主键非空",
        target: { kind: "objectType", id: "order-1", evaluation_target_name: "采购订单" },
      },
      execution_spec: {
        runner: "object_data_check",
        runnable: true,
        target_kind: "resource",
        target: {
          resource_id: "order-1",
          capability_type: "objectType",
          resource_kind: "objectType",
          kn_id: "kn-1",
          name: "采购订单",
        },
      },
      assertions: [
        {
          id: "expected-output",
          type: "equals",
          source: "normalized_output",
          path: "$",
          required: true,
        },
        { id: "execution-evidence", type: "evidence_complete", required: true },
      ],
      expected_spec: { violations: 0 },
      expected_source: {
        kind: "declared_contract",
        evidence_refs: ["bkn-rule://object-key-completeness"],
      },
      diagnostic_spec: {
        note: "原说明",
        template_rule_id: "object-key-completeness",
        expected_locked: true,
      },
    },
  };
  vi.mocked(getEvalCaseDraft).mockResolvedValue(objectDraft);
  vi.mocked(replaceEvalCase).mockResolvedValue({ ...objectDraft, revision: 3 });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("物料主键检查");
  expect(
    screen.getByLabelText("已保存检查项", { exact: true, selector: "input,textarea" }),
  ).toHaveValue("实例主键非空");
  expect(
    screen.getByLabelText("已保存检查目标", { exact: true, selector: "input,textarea" }),
  ).toHaveValue("采购订单");
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "修改后的主键检查" },
  });
  fireEvent.change(
    screen.getByLabelText("最多检查条数", { exact: true, selector: '[role="spinbutton"]' }),
    {
      target: { value: "20" },
    },
  );
  await waitFor(() =>
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "试运行" }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "试运行" }));
  await waitFor(() => expect(trialEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(trialEvalCase).mock.calls[0][1]).toMatchObject({
    execution_spec: objectDraft.definition.execution_spec,
    expected_spec: { violations: 0 },
    expected_source: objectDraft.definition.expected_source,
    input_spec: { check_scope: { mode: "sample", limit: 20 } },
  });
  expect(createEvalCase).not.toHaveBeenCalled();
  expect(replaceEvalCase).not.toHaveBeenCalled();
  await screen.findByText("用例试运行结果");
  fireEvent.click(screen.getByRole("button", { name: "返回编辑" }));
  saveWithoutEnabling();
  await waitFor(() => expect(replaceEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(replaceEvalCase).mock.calls[0][1].definition).toMatchObject({
    title: "修改后的主键检查",
    execution_spec: objectDraft.definition.execution_spec,
    assertions: objectDraft.definition.assertions,
  });
  expect(vi.mocked(replaceEvalCase).mock.calls[0][2]).toBe(false);
});

it("keeps readable resources selectable while showing partial catalogue failures", async () => {
  vi.mocked(listEvalCaseResources).mockResolvedValue({
    entries: [{ id: "order-1", name: "采购订单", kind: "objectType" }],
    total: 1,
    read_issues: [
      { kind: "objectType", id: "broken", reason: "部分资源声明暂不能读取，当前列表不完整。" },
    ],
  });
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  expect(await screen.findByText("部分资源声明暂不能读取，当前列表不完整。")).toBeTruthy();
  fireEvent.mouseDown(
    screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  );
  expect(await screen.findByText("采购订单")).toBeTruthy();
});

it("rejects a title-only case while the enable switch remains off", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({
    version: 2,
    predicates: ["equals", "exists", "observation_only"],
  });
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  await screen.findByText("判定标准");
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "稍后完善的检查" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await waitFor(() =>
    expect(document.querySelectorAll(".ant-form-item-has-error").length).toBeGreaterThan(0),
  );
  expect(createEvalCase).not.toHaveBeenCalled();
}, 30000);

it("observation-only cases still require an implemented execution", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({
    version: 2,
    predicates: ["equals", "exists", "observation_only"],
  });
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  await screen.findByText("判定标准");
  fireEvent.click(screen.getByText("场景测试", { exact: true }));
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "供给场景观察" },
  });
  fireEvent.change(
    screen.getByLabelText("场景描述与测试输入", { exact: true, selector: "input,textarea" }),
    {
      target: { value: "判断多个订单的供给约束" },
    },
  );
  fireEvent.mouseDown(
    screen.getByLabelText("如何判断 1", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("只观察输出", { exact: true }));
  expect(
    screen.queryByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
  ).toBeNull();
  expect(
    screen.queryByLabelText("依据说明", { exact: true, selector: "input,textarea" }),
  ).toBeNull();
  fireEvent.click(screen.getByLabelText("启用用例", { exact: true, selector: '[role="switch"]' }));
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  expect(
    await screen.findByText("当前没有已授权的场景执行入口，请先配置只读函数授权。"),
  ).toBeTruthy();
  expect(createEvalCase).not.toHaveBeenCalled();
}, 30000);

it.each(["functional", "security"] as const)(
  "creates, trials and enables an object check using a server-prepared rule (%s)",
  async (caseType) => {
    vi.mocked(getEvalTemplateConfig).mockResolvedValue({
      revision: 1,
      checksum: "rules",
      execution_support: { "object-key-uniqueness": { status: "supported", reason: "" } },
      rules: [
        {
          id: "object-key-uniqueness",
          title: "实例主键唯一",
          kind: "objectType",
          enabled: true,
          group: "实例标识",
          description: "读取真实主键，检查重复值",
          appliesWhen: "",
          evidence: "",
          planDimensions: [],
        },
      ],
    });
    const definition = {
      ...draft.definition,
      title: "采购订单 · 实例主键唯一",
      category: "fact" as const,
      input_spec: {
        question: "按真实主键检查唯一性",
        arguments: {},
        template_rule_id: "object-key-uniqueness",
        template_rule_revision: 1,
        check_scope: { mode: "sample", limit: 100 },
      },
      execution_spec: {
        runner: "object_data_check",
        target: {
          kn_id: "kn-1",
          resource_id: "order-1",
          resource_kind: "objectType",
          capability_type: "objectType",
          name: "采购订单",
        },
      },
      expected_spec: { violations: 0 },
      expected_source: {
        kind: "declared_contract" as const,
        evidence_refs: ["bkn-rule://object-key-uniqueness"],
      },
      diagnostic_spec: { expected_locked: true, rule_snapshot: { id: "object-key-uniqueness" } },
    };
    vi.mocked(previewRuleApplication).mockResolvedValue({
      total: 1,
      page: 1,
      limit: 100,
      scope_revision: 0,
      entries: [
        {
          ready_for_save: true,
          prepared_definition: definition,
          key: "target:default",
          target_key: "target",
          resource: { kind: "objectType", id: "order-1" },
          resource_name: "采购订单",
          target_id: "order-1",
          target_name: "采购订单",
          rule_id: "object-key-uniqueness",
          rule_title: "实例主键唯一",
          rule_checksum: "rule",
          resource_checksum: "source",
          match: "applicable",
          configuration: "complete",
          execution: "ready",
          execution_reason: "",
          missing: [],
          expected_locked: true,
          sample: {
            target_key: "target",
            sample_id: "default",
            title: definition.title,
            question: "检查唯一性",
            arguments: {},
            scope: { mode: "sample", limit: 100 },
          },
        },
      ],
    });
    render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
    if (caseType === "security") fireEvent.click(screen.getByText("安全测试", { exact: true }));
    fireEvent.mouseDown(
      screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' }),
    );
    fireEvent.click(await screen.findByText("采购订单"));
    fireEvent.mouseDown(
      await screen.findByLabelText("检查项", { exact: true, selector: '[role="combobox"]' }),
    );
    fireEvent.click(
      await screen.findByText("实例主键唯一", { selector: ".ant-select-item-option-content" }),
    );
    await screen.findByLabelText("最多检查条数", { exact: true, selector: '[role="spinbutton"]' });
    if (caseType === "security")
      fireEvent.change(
        screen.getByLabelText("安全前提与验证目标", { exact: true, selector: "input,textarea" }),
        {
          target: { value: "当前身份只读核对主键，不切换账号。" },
        },
      );
    expect(screen.queryByRole("textbox", { name: /测试输入|测试说明/ })).toBeNull();
    expect(
      screen.queryByLabelText("依据说明", { exact: true, selector: "input,textarea" }),
    ).toBeNull();
    fireEvent.mouseDown(
      screen.getByLabelText("检查范围", { exact: true, selector: '[role="combobox"]' }),
    );
    fireEvent.click(screen.getByText("全量检查", { selector: ".ant-select-item-option-content" }));
    fireEvent.click(screen.getByRole("button", { name: "试运行" }));
    await waitFor(() => expect(trialEvalCase).toHaveBeenCalledOnce());
    expect(vi.mocked(trialEvalCase).mock.calls[0][1]).toMatchObject({
      execution_spec: { runner: "object_data_check" },
      expected_spec: { violations: 0 },
      input_spec: {
        question:
          caseType === "security" ? "当前身份只读核对主键，不切换账号。" : "按真实主键检查唯一性",
        check_scope: { mode: "all" },
      },
      diagnostic_spec: { case_type: caseType },
    });
    expect(createEvalCase).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "返回编辑" }));
    fireEvent.click(
      screen.getByLabelText("启用用例", { exact: true, selector: '[role="switch"]' }),
    );
    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    await waitFor(() => expect(createEvalCase).toHaveBeenCalledOnce());
    expect(vi.mocked(createEvalCase).mock.calls[0][2]).toBe(true);
    expect(vi.mocked(createEvalCase).mock.calls[0][1].diagnostic_spec.case_type).toBe(caseType);
    expect(vi.mocked(createEvalCase).mock.calls[0][1].expected_source).toEqual(
      definition.expected_source,
    );
  },
  30000,
);

it("edits resource query cases without converting them to an unbound Function", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 2, predicates: ["json_schema"] });
  const resource: EvalCaseDraft = {
    ...draft,
    definition: {
      ...draft.definition,
      title: "指标调用检查",
      category: "calculation",
      input_spec: { question: "查询当前指标", arguments: { query: {} } },
      execution_spec: {
        runner: "resource_query",
        target_kind: "resource",
        target: {
          kn_id: "kn-1",
          resource_kind: "metric",
          capability_type: "metric",
          resource_id: "gmv",
          name: "GMV",
        },
      },
      assertions: [
        {
          id: "availability",
          type: "json_schema",
          source: "normalized_output",
          path: "$",
          schema: {
            type: "object",
            required: ["available"],
            properties: { available: { const: true } },
          },
          required: true,
        },
        { id: "evidence", type: "evidence_complete", required: true },
      ],
      expected_spec: {},
      expected_source: { kind: "declared_contract", evidence_refs: [] },
      diagnostic_spec: { form_version: 2 },
    },
  };
  vi.mocked(getEvalCaseDraft).mockResolvedValue(resource);
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("指标调用检查");
  expect(await screen.findByText("调用可用性")).toBeTruthy();
  fireEvent.click(screen.getByText("其他查询设置（可选）"));
  expect(
    screen.getByLabelText<HTMLTextAreaElement>("输入参数", {
      exact: true,
      selector: "input,textarea",
    }).value,
  ).toContain('"query"');
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await waitFor(() => expect(replaceEvalCase).toHaveBeenCalledOnce());
  const definition = vi.mocked(replaceEvalCase).mock.calls[0][1].definition;
  expect(definition.execution_spec).toMatchObject({
    runner: "resource_query",
    target: { resource_id: "gmv", resource_kind: "metric" },
  });
  expect(definition.input_spec).toEqual({ question: "查询当前指标", arguments: { query: {} } });
  expect(definition.assertions).toContainEqual(
    expect.objectContaining({ type: "evidence_complete", required: true }),
  );
});

it("creates a resource availability case from its real parameter fields and rejects out of range values", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({
    version: 2,
    predicates: ["json_schema", "equals", "observation_only"],
  });
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    runner: "resource_query",
    available: true,
    help: "工具参数由实际合同提供",
    input: {
      type: "object",
      properties: {
        query: { type: "string" },
        count: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["query", "count"],
      additionalProperties: false,
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      open
      initialResource={{ id: "search", name: "搜索", kind: "mcp" }}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByLabelText("count", { exact: true, selector: '[role="spinbutton"]' });
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "搜索调用可用" },
  });
  fireEvent.change(
    screen.getByLabelText("测试说明（选填）", { exact: true, selector: "input,textarea" }),
    {
      target: { value: "检查搜索是否可用" },
    },
  );
  fireEvent.change(screen.getByLabelText("query", { exact: true, selector: "input,textarea" }), {
    target: { value: "OpenBKN" },
  });
  fireEvent.change(
    screen.getByLabelText("count", { exact: true, selector: '[role="spinbutton"]' }),
    { target: { value: "51" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  expect(await screen.findByText(/不符合maximum=50/)).toBeTruthy();
  expect(createEvalCase).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByLabelText("count", { exact: true, selector: '[role="spinbutton"]' }),
    { target: { value: "2" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await waitFor(() => expect(createEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(createEvalCase).mock.calls[0][1]).toMatchObject({
    input_spec: { arguments: { query: "OpenBKN", count: 2 } },
    execution_spec: { runner: "resource_query" },
    expected_source: { kind: "declared_contract" },
  });
});

it("shows resource authorization failure before asking the user to fill invocation JSON", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 2, predicates: ["json_schema"] });
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    runner: "resource_query",
    available: false,
    reason: "此消息资源尚未通过只读审核",
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      open
      initialResource={{ id: "messages", name: "消息", kind: "api" }}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  expect(await screen.findByText("此消息资源尚未通过只读审核")).toBeTruthy();
  expect(createEvalCase).not.toHaveBeenCalled();
});

it("keeps custom business criteria when the user cancels a purpose switch", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({
    version: 2,
    predicates: ["equals", "json_schema", "observation_only"],
  });
  vi.mocked(getEvalCaseDraft).mockResolvedValue({
    ...draft,
    definition: {
      ...draft.definition,
      title: "自定义搜索数量",
      category: "fact",
      input_spec: { question: "检查返回数量", arguments: { count: 2 } },
      execution_spec: {
        runner: "resource_query",
        target_kind: "resource",
        target: {
          kn_id: "kn-1",
          resource_kind: "mcp",
          capability_type: "mcp",
          resource_id: "search",
          name: "搜索",
        },
      },
      assertions: [
        {
          id: "count",
          type: "equals",
          source: "normalized_output",
          path: "$.result.count",
          expected_path: "$.criteria.count",
          on_missing: "fail",
          required: true,
        },
        { id: "evidence", type: "evidence_complete", required: true },
      ],
      expected_spec: { criteria: { count: 2 } },
      expected_source: { kind: "independent_sample", evidence_refs: ["sample://two"] },
      diagnostic_spec: { form_version: 2 },
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("自定义搜索数量");
  await waitFor(() =>
    expect(
      screen.getByLabelText("自定义结果判定", { selector: 'input[type="radio"]' }),
    ).toBeChecked(),
  );
  expect(screen.getByDisplayValue("2")).toBeTruthy();
  const confirmSpy = vi
    .spyOn(Modal, "confirm")
    .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  fireEvent.click(screen.getByLabelText("仅记录输出", { selector: 'input[type="radio"]' }));
  await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
  expect(confirmSpy.mock.calls[0][0]).toMatchObject({
    title: "切换检查目的？",
    cancelText: "保留当前标准",
  });
  confirmSpy.mock.calls[0][0].onCancel?.();
  expect(
    screen.getByLabelText("自定义结果判定", { selector: 'input[type="radio"]' }),
  ).toBeChecked();
  fireEvent.click(screen.getByLabelText("确定", { selector: "button" }));
  await waitFor(() => expect(replaceEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(replaceEvalCase).mock.calls[0][1].definition.assertions).toContainEqual(
    expect.objectContaining({ type: "equals", path: "$.result.count" }),
  );
  confirmSpy.mockRestore();
});

it("blocks Function save and trial when its source contract cannot be read", async () => {
  vi.mocked(listEvalReviewedFunctions).mockResolvedValue([
    { name: "标准交期", operation: "leadtime_days" },
  ]);
  vi.mocked(getCaseTargetSchema).mockRejectedValue(new Error("contract unavailable"));
  vi.mocked(getEvalCaseDraft).mockResolvedValue({
    ...draft,
    definition: {
      ...draft.definition,
      title: "函数合同失败",
      input_spec: { question: "核对交期", arguments: { material_code: "one" } },
      execution_spec: {
        runner: "direct_capability",
        target: {
          kn_id: "kn-1",
          capability_type: "function",
          metadata_type: "function",
          resource_id: "leadtime",
          name: "标准交期",
          operation: "leadtime_days",
        },
      },
      assertions: [
        {
          id: "value",
          type: "equals",
          source: "normalized_output",
          path: "$.days",
          on_missing: "fail",
          required: true,
        },
      ],
      expected_spec: { days: 14 },
      expected_source: { kind: "independent_sample", evidence_refs: ["sample://leadtime"] },
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  expect(await screen.findByText("参数合同读取失败，不能确认输入是否完整。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^试运行$/ }));
  await screen.findByText("请先读取当前资源的参数合同后再试运行。");
  expect(trialEvalCase).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await screen.findByText("请先读取当前资源的参数合同后再保存。");
  expect(replaceEvalCase).not.toHaveBeenCalled();
  expect(trialEvalCase).not.toHaveBeenCalled();
});

it("preserves a rule resource standard and provenance when editing invocation arguments", async () => {
  const fixed: EvalCaseDraft = {
    ...draft,
    definition: {
      ...draft.definition,
      title: "规则搜索可用性",
      input_spec: {
        question: "核对调用",
        arguments: { count: 2 },
        template_rule_id: "mcp-tool-call",
      },
      execution_spec: {
        runner: "resource_query",
        target_kind: "resource",
        target: {
          kn_id: "kn-1",
          resource_kind: "mcp",
          capability_type: "mcp",
          resource_id: "search",
          name: "搜索",
        },
      },
      assertions: [
        {
          id: "available",
          type: "json_schema",
          source: "normalized_output",
          path: "$",
          required: true,
          schema: {
            type: "object",
            required: ["available"],
            properties: { available: { const: true } },
          },
        },
        { id: "evidence", type: "evidence_complete", required: true },
      ],
      expected_spec: { available: true },
      expected_source: { kind: "declared_contract", evidence_refs: ["bkn-rule://mcp-tool-call"] },
      diagnostic_spec: {
        rule_snapshot: { id: "mcp-tool-call" },
        expected_locked: true,
        note: "原说明",
      },
    },
  };
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 2, predicates: ["json_schema"] });
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    runner: "resource_query",
    available: true,
    input: { type: "object", properties: { count: { type: "integer", maximum: 50 } } },
  });
  vi.mocked(getEvalCaseDraft).mockResolvedValue(fixed);
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      sourceType="template"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("规则搜索可用性");
  await screen.findByLabelText("count", { exact: true, selector: '[role="spinbutton"]' });
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "规则搜索改名" },
  });
  fireEvent.change(
    screen.getByLabelText("count", { exact: true, selector: '[role="spinbutton"]' }),
    { target: { value: "3" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await waitFor(() => expect(replaceEvalCase).toHaveBeenCalledOnce());
  const saved = vi.mocked(replaceEvalCase).mock.calls[0][1].definition;
  expect(saved).toEqual({
    ...fixed.definition,
    title: "规则搜索改名",
    input_spec: { ...fixed.definition.input_spec, arguments: { count: 3 } },
    diagnostic_spec: { ...fixed.definition.diagnostic_spec, case_type: "functional" },
  });
});

it("explains which required Function parameter is missing instead of reporting a generic JSON error", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 2, predicates: ["equals"] });
  vi.mocked(listEvalReviewedFunctions).mockResolvedValue([
    { name: "标准交期", operation: "leadtime_days" },
  ]);
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    runner: "direct_capability",
    available: true,
    input: {
      type: "object",
      required: ["material_code"],
      properties: { material_code: { type: "string" } },
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      open
      initialResource={{ id: "leadtime", kind: "function", name: "标准交期" }}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByLabelText("material_code", { exact: true, selector: "input,textarea" });
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  expect(await screen.findByText("请填写参数 material_code")).toBeTruthy();
  expect(createEvalCase).not.toHaveBeenCalled();
});

it("waits for the current resource contract before enabling trial execution", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 2, predicates: ["json_schema"] });
  let resolveSchema!: (value: Awaited<ReturnType<typeof getCaseTargetSchema>>) => void;
  vi.mocked(getCaseTargetSchema).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSchema = resolve;
      }),
  );
  vi.mocked(getEvalCaseDraft).mockResolvedValue({
    ...draft,
    definition: {
      ...draft.definition,
      category: "calculation",
      input_spec: { question: "读取工具结果", arguments: {} },
      assertions: [
        {
          id: "output",
          type: "json_schema",
          source: "normalized_output",
          path: "$",
          schema: {},
          required: true,
        },
        { id: "evidence", type: "evidence_complete", required: true },
      ],
      expected_spec: {},
      expected_source: { kind: "declared_contract", evidence_refs: [] },
      diagnostic_spec: { form_version: 2 },
      execution_spec: {
        runner: "resource_query",
        target_kind: "resource",
        target: {
          kn_id: "kn-1",
          resource_kind: "mcp",
          capability_type: "mcp",
          resource_id: "tool",
          name: "工具",
        },
      },
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByDisplayValue("供应商必须存在");
  await waitFor(() => expect(getCaseTargetSchema).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "试运行" })).toBeDisabled();
  expect(trialEvalCase).not.toHaveBeenCalled();
  resolveSchema({
    runner: "resource_query",
    available: true,
    input: { type: "object", properties: {} },
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "试运行" })).toBeEnabled());
});

it("offers trial execution for an explicitly available read-only action", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 2, predicates: ["json_schema"] });
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    runner: "resource_query",
    available: true,
    input: {
      type: "object",
      properties: {
        dynamic_params: {
          type: "object",
          required: ["param"],
          properties: { param: { type: "string" } },
        },
      },
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      open
      initialResource={{ id: "echo", kind: "action", name: "只读回显" }}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByLabelText("param", { exact: true, selector: "input,textarea" });
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "行动参数核验" },
  });
  fireEvent.change(
    screen.getByLabelText("测试说明（选填）", { exact: true, selector: "input,textarea" }),
    {
      target: { value: "只读回显调用" },
    },
  );
  fireEvent.change(screen.getByLabelText("param", { exact: true, selector: "input,textarea" }), {
    target: { value: "test" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "试运行" }));
  await waitFor(() => expect(trialEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(trialEvalCase).mock.calls[0][1]).toMatchObject({
    execution_spec: { runner: "resource_query" },
    input_spec: { arguments: { dynamic_params: { param: "test" } } },
  });
});

it("finds the selected resource by its name instead of its opaque ID", async () => {
  render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.mouseDown(
    screen.getByLabelText("资源类型", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("函数", { exact: true }));
  const target = screen.getByLabelText("评测对象", { exact: true, selector: '[role="combobox"]' });
  fireEvent.change(target, { target: { value: "标准交期" } });
  expect(await screen.findByText("标准交期", { exact: true })).toBeTruthy();
});

it("saves a parameterized functional case without requiring duplicated test notes", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({
    version: 2,
    predicates: ["json_schema", "equals"],
  });
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    runner: "resource_query",
    available: true,
    input: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string", title: "查询内容" } },
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      open
      initialResource={{ id: "search", name: "搜索", kind: "mcp" }}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByLabelText("query", { exact: true, selector: "input,textarea" });
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "查询内容可正常搜索" },
  });
  fireEvent.change(screen.getByLabelText("query", { exact: true, selector: "input,textarea" }), {
    target: { value: "OpenBKN" },
  });
  expect(
    screen.getByLabelText("测试说明（选填）", { exact: true, selector: "input,textarea" }),
  ).toHaveValue("");
  expect(
    screen.queryByLabelText("依据说明", { exact: true, selector: "input,textarea" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await waitFor(() => expect(createEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(createEvalCase).mock.calls[0][1]).toMatchObject({
    input_spec: { question: "查询内容可正常搜索", arguments: { query: "OpenBKN" } },
    expected_source: { kind: "declared_contract", evidence_refs: [] },
  });
});

const renderFalseResultCase = async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({
    version: 2,
    predicates: ["json_schema", "equals", "exists"],
  });
  vi.mocked(getCaseTargetSchema).mockResolvedValue({
    runner: "resource_query",
    available: true,
    input: { type: "object", properties: {} },
    output: { type: "object", properties: { result: { type: "boolean" } } },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      open
      initialResource={{ id: "search", name: "搜索", kind: "mcp" }}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByText("调用可用性");
  fireEvent.change(screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }), {
    target: { value: "业务返回为否" },
  });
  fireEvent.click(screen.getByText("自定义结果判定"));
  fireEvent.mouseDown(
    await screen.findByLabelText("正确值 1", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(
    await screen.findByText("否（false）", { selector: ".ant-select-item-option-content" }),
  );
};

it("requires business-expert evidence before saving an independent correct value", async () => {
  await renderFalseResultCase();
  expect(
    screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" }),
  ).toHaveAttribute("placeholder", expect.stringContaining("业务负责人"));
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  expect(
    await screen.findByText("请说明正确值的依据，例如业务规则、计算过程或已核对的样本。"),
  ).toBeVisible();
  expect(createEvalCase).not.toHaveBeenCalled();
});

it("validates independent-sample evidence length and saves a valid reference", async () => {
  await renderFalseResultCase();
  fireEvent.mouseDown(
    screen.getByLabelText("正确值从哪里来", { exact: true, selector: '[role="combobox"]' }),
  );
  fireEvent.click(
    screen.getByText("已核对的对照样本", { selector: ".ant-select-item-option-content" }),
  );
  const evidence = screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" });
  expect(evidence).toHaveAttribute("placeholder", expect.stringContaining("样本订单A"));
  fireEvent.change(evidence, { target: { value: "核".repeat(513) } });
  fireEvent.click(screen.getByLabelText("确定", { selector: "button" }));
  expect(await screen.findByText("第 1 条依据超过512个字符，请精简或分行。")).toBeVisible();
  expect(createEvalCase).not.toHaveBeenCalled();
  fireEvent.change(evidence, { target: { value: "已核对的反例样本，结果为否；验收表第3行" } });
  fireEvent.click(screen.getByLabelText("确定", { selector: "button" }));
  await waitFor(() => expect(createEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(createEvalCase).mock.calls[0][1]).toMatchObject({
    expected_source: {
      kind: "independent_sample",
      evidence_refs: ["已核对的反例样本，结果为否；验收表第3行"],
    },
  });
}, 15_000);

it.each(["场景测试", "安全测试"])(
  "configures %s with a real execution entry and keeps it separate from assessment",
  async (mode) => {
    vi.mocked(getCaseFormOptions).mockResolvedValue({
      version: 2,
      predicates: ["equals", "exists", "json_schema"],
    });
    vi.mocked(listEvalReviewedFunctions).mockResolvedValue([
      { name: "标准交期", operation: "leadtime_days" },
    ]);
    vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
      entries: [{ id: "entry-fn", name: "标准交期", kind: "function" }],
      total: 1,
    });
    vi.mocked(getCaseTargetSchema).mockResolvedValue({
      runner: "direct_capability",
      available: true,
      input: { type: "object", properties: { qty: { type: "number" } }, required: ["qty"] },
      output: { type: "object", properties: { value: { type: "number" } } },
    });
    render(<EvalCaseEditorDrawer networkId="kn-1" open onClose={vi.fn()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByText(mode));
    fireEvent.mouseDown(
      screen.getByLabelText("执行入口", { exact: true, selector: '[role="combobox"]' }),
    );
    fireEvent.click(await screen.findByText("标准交期 · leadtime_days"));
    await waitFor(() =>
      expect(
        screen
          .getByLabelText("执行入口", { exact: true, selector: '[role="combobox"]' })
          .closest(".ant-form-item"),
      ).not.toHaveClass("ant-form-item-has-error"),
    );
    fireEvent.change(
      await screen.findByLabelText("qty", { exact: true, selector: '[role="spinbutton"]' }),
      {
        target: { value: "0" },
      },
    );
    fireEvent.change(
      screen.getByLabelText("用例名称", { exact: true, selector: "input,textarea" }),
      {
        target: { value: "当前身份下的完整场景" },
      },
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: mode === "场景测试" ? "场景描述与测试输入" : "安全测试输入",
      }),
      { target: { value: "在当前授权内调用入口，零输入应返回零，不申请其他身份。" } },
    );
    fireEvent.mouseDown(
      screen.getByLabelText("检查什么 1", { exact: true, selector: '[role="combobox"]' }),
    );
    fireEvent.click(await screen.findByText("value"));
    fireEvent.change(
      await screen.findByLabelText("正确值 1", { exact: true, selector: '[role="spinbutton"]' }),
      {
        target: { value: "0" },
      },
    );
    fireEvent.change(
      screen.getByLabelText("依据说明", { exact: true, selector: "input,textarea" }),
      {
        target: { value: "独立核算：零输入的期望结果是0。" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    await waitFor(() => expect(createEvalCase).toHaveBeenCalled());
    const definition = vi.mocked(createEvalCase).mock.calls[0][1];
    expect(definition.execution_spec.target_kind).toBe("business_scenario");
    expect(definition.execution_spec.target).toEqual(
      expect.objectContaining({ resource_id: "entry-fn", name: "标准交期" }),
    );
    expect(definition.input_spec.arguments).toEqual({ qty: 0 });
    expect(definition.diagnostic_spec.case_type).toBe(
      mode === "场景测试" ? "scenario" : "security",
    );
    expect(definition.diagnostic_spec.resource_id).toBeUndefined();
  },
  30000,
);

it("edits a disabled definition even when its runtime input contract cannot be read", async () => {
  vi.mocked(getCaseFormOptions).mockResolvedValue({ version: 2, predicates: ["equals"] });
  vi.mocked(getCaseTargetSchema).mockRejectedValue(new Error("contract unavailable"));
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    revision: 1,
    checksum: "rules",
    rules: [
      {
        id: "function-input",
        kind: "function",
        title: "输入处理",
        enabled: true,
        group: "输入输出",
        description: "核对输入处理",
        appliesWhen: "函数输入",
        evidence: "独立合同",
        planDimensions: [],
      },
    ],
    execution_support: {
      "function-input": { status: "unsupported", reason: "缺少异常执行能力，可保存定义" },
    },
  });
  vi.mocked(getEvalCaseDraft).mockResolvedValue({
    ...draft,
    definition: {
      ...draft.definition,
      title: "待执行定义",
      input_spec: { question: "缺少编号应返回明确错误", arguments: {} },
      execution_spec: {
        runner: "unbound",
        target_kind: "resource",
        target: {
          kn_id: "kn-1",
          resource_kind: "function",
          capability_type: "function",
          resource_id: "leadtime",
          name: "标准交期",
        },
      },
      assertions: [
        {
          id: "error",
          type: "equals",
          source: "normalized_output",
          path: "$.error",
          on_missing: "fail",
          required: true,
        },
      ],
      expected_spec: { error: "缺少编号" },
      expected_source: { kind: "business_expert", evidence_refs: ["接口合同第3节"] },
      diagnostic_spec: {
        form_version: 2,
        definition_only: true,
        resource_case_form: true,
        template_rule_id: "function-input",
      },
    },
  });
  render(
    <EvalCaseEditorDrawer
      networkId="kn-1"
      caseId="manual-1"
      open
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  expect(
    await screen.findByLabelText(
      "测试步骤与验证目标",
      { exact: true, selector: "input,textarea" },
      { timeout: 10000 },
    ),
  ).toHaveValue("缺少编号应返回明确错误");
  expect(
    screen.getByLabelText("启用用例", { exact: true, selector: '[role="switch"]' }),
  ).toBeDisabled();
  expect(screen.queryByRole("button", { name: "试运行" })).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "确定" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "确定" }));
  await waitFor(() => expect(replaceEvalCase).toHaveBeenCalledOnce());
  expect(vi.mocked(replaceEvalCase).mock.calls[0][2]).toBe(false);
  expect(vi.mocked(replaceEvalCase).mock.calls[0][1].definition.execution_spec.runner).toBe(
    "unbound",
  );
});
