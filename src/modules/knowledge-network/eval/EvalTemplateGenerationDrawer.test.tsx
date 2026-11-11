/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { useAppServices } from "@/framework/context/use-app-services";

import { runEvalAssistant } from "./eval-case-designer.service";
import { previewRuleApplication } from "./rule-application.service";
import { EvalAssistantDrawer } from "./EvalTemplateGenerationDrawer";
import {
  getEvalOverview,
  getM0Run,
  listRunCases,
  getRunCaseDetail,
  getEvalTemplateConfig,
  listEvalSuites,
  listEvalCaseResourcesPage,
  searchM0Runs,
} from "./m0-run.service";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/context/use-app-services", () => ({ useAppServices: vi.fn() }));
vi.mock("./rule-application.service", () => ({ previewRuleApplication: vi.fn() }));
vi.mock("./eval-case-designer.service", () => ({ runEvalAssistant: vi.fn() }));
vi.mock("./EvalRepairPanel", () => ({
  EvalRepairPanel: ({ request }: { request: { target: { name: string } } }) => (
    <section aria-label="修复目标">{request.target.name}</section>
  ),
}));
vi.mock("./m0-run.service", () => ({
  getEvalOverview: vi.fn(),
  getM0Run: vi.fn(),
  listRunCases: vi.fn(),
  getRunCaseDetail: vi.fn(),
  getEvalTemplateConfig: vi.fn(),
  listEvalSuites: vi.fn(),
  listEvalCaseResourcesPage: vi.fn(),
  searchM0Runs: vi.fn(),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppServices).mockReturnValue({
    runtimeConfig: {
      auth: {
        tokenManager: {
          getAccessToken: () => "token",
          refreshAccessToken: vi.fn().mockResolvedValue("token"),
        },
      },
    },
  } as unknown as ReturnType<typeof useAppServices>);
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
    entries: [{ id: "material", name: "物料", kind: "objectType" }],
    total: 1,
  });
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    revision: 1,
    checksum: "config-checksum",
    rules: [
      {
        id: "object-definition",
        kind: "objectType",
        group: "对象类定义",
        title: "对象结构与主显键",
        description: "检查对象类结构",
        appliesWhen: "所有对象类",
        evidence: "对象类声明",
        planDimensions: ["对象类定义"],
        preset: "required",
        enabled: true,
      },
    ],
  });
  vi.mocked(getEvalOverview).mockRejectedValue(new Error("overview unavailable"));
  vi.mocked(listEvalSuites).mockRejectedValue(new Error("suites unavailable"));
  vi.mocked(searchM0Runs).mockRejectedValue(new Error("runs unavailable"));
  vi.mocked(runEvalAssistant).mockResolvedValue({
    answer: "",
    threadId: "thread-1",
    proposal: {
      kind: "eval_case_recommendation",
      summary: "建议验证物料对象类结构。",
      suggestions: [
        {
          resource_key: "objectType:material",
          rule_id: "object-definition",
          reason: "物料是核心业务对象",
          confidence: "high",
        },
      ],
    },
  });
});

it("opens targeted repair in the shared assistant without starting a catalogue scan or normal chat", () => {
  const onClearRepair = vi.fn();
  render(
    <EvalAssistantDrawer
      networkId="kn-1"
      open
      onAdopted={vi.fn()}
      onClose={vi.fn()}
      onClearRepair={onClearRepair}
      repairRequest={{
        networkId: "kn-1",
        id: "repair-1",
        target: { kind: "objectType", id: "order", name: "采购订单" },
        cases: [],
      }}
    />,
  );
  expect(screen.getByRole("region", { name: "修复目标" })).toHaveTextContent("采购订单");
  expect(listEvalCaseResourcesPage).not.toHaveBeenCalled();
  expect(screen.queryByRole("navigation", { name: "质量评测快捷入口" })).toBeNull();
  expect(screen.getByLabelText("向质量评测 AI 助手提问")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "新对话" }));
  expect(onClearRepair).toHaveBeenCalledOnce();
});

it("answers workspace questions without forcing them into case generation", async () => {
  vi.mocked(runEvalAssistant).mockResolvedValueOnce({
    answer: "当前应先检查失败运行，再决定回归范围。",
    threadId: "thread-guide",
  });
  render(
    <EvalAssistantDrawer
      activeTab="runs"
      networkId="kn-1"
      onAdopted={vi.fn()}
      onClose={vi.fn()}
      open
    />,
  );

  const input = await screen.findByLabelText("向质量评测 AI 助手提问");
  fireEvent.change(input, { target: { value: "接下来应该处理什么？" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

  expect(await screen.findByText("当前应先检查失败运行，再决定回归范围。")).toBeTruthy();
  expect(screen.getByText(/运行与诊断 ·/)).toBeTruthy();
});

it("refreshes real overview, suite and run statistics before asking the assistant", async () => {
  vi.mocked(getEvalOverview).mockResolvedValueOnce({
    generated_at: "2026-11-03T15:00:00Z",
    scope: { revision: 1, excluded_kinds: [], excluded_resources: [] },
    resources: {
      total: 31,
      in_scope: 30,
      excluded: 1,
      covered: 20,
      evaluated: 12,
      passed: 10,
      problems: 2,
      uncovered: 10,
      unresolved_bindings: 0,
    },
    rule_points: { enabled_rules: 35, applicable: 90, covered: 70, missing: 20, not_ready: 3 },
    cases: {
      total: 52,
      excluded: 2,
      enabled: 48,
      runnable: 40,
      evaluated: 30,
      passed: 25,
      failed: 2,
      inconclusive: 1,
      review_required: 0,
      execution_failed: 2,
      in_progress: 0,
      cancelled: 0,
      not_run: 18,
    },
    coverage: {
      resource_percent: 66.7,
      rule_percent: 77.8,
      execution_percent: 62.5,
      pass_percent: 83.3,
    },
    by_resource_type: [],
  });
  vi.mocked(listEvalSuites).mockResolvedValueOnce({
    entries: [],
    total: 4,
    page: 1,
    limit: 20,
  });
  vi.mocked(searchM0Runs).mockResolvedValueOnce({
    total: 9,
    page: 1,
    limit: 5,
    entries: [
      {
        id: "run-1",
        suite_name: "核心回归",
        execution_status: "completed",
        phase: null,
        quality_outcome: "pass",
        progress: { planned_cases: 3, completed_cases: 3 },
        created_at: "2026-11-03T14:00:00Z",
      },
    ],
  });
  vi.mocked(runEvalAssistant).mockResolvedValueOnce({ answer: "资源覆盖率为 66.7%。" });
  render(
    <EvalAssistantDrawer
      activeTab="overview"
      networkId="kn-1"
      onAdopted={vi.fn()}
      onClose={vi.fn()}
      open
    />,
  );

  const input = await screen.findByLabelText("向质量评测 AI 助手提问");
  fireEvent.change(input, { target: { value: "汇总当前覆盖情况" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  await screen.findByText("资源覆盖率为 66.7%。");

  expect(vi.mocked(runEvalAssistant).mock.calls.at(-1)?.[0].workspace).toMatchObject({
    caseCount: 52,
    suiteCount: 4,
    runCount: 9,
    overview: {
      resources: { total: 31, covered: 20, uncovered: 10 },
      cases: { total: 52, passed: 25 },
    },
    recentRuns: {
      total: 9,
      entries: [{ id: "run-1", qualityOutcome: "pass" }],
    },
  });
});

it("offers allowlisted workspace actions and delegates execution to existing flows", async () => {
  const onNavigate = vi.fn();
  const onCreateCase = vi.fn();
  const onRunSelectedCases = vi.fn();
  vi.mocked(runEvalAssistant).mockResolvedValueOnce({
    answer: "可以先打开用例库，新建用例后运行当前已选用例。",
    actions: [{ type: "case_library" }, { type: "create_case" }, { type: "run_selected_cases" }],
    threadId: "thread-actions",
  });
  render(
    <EvalAssistantDrawer
      networkId="kn-1"
      onAdopted={vi.fn()}
      onClose={vi.fn()}
      onCreateCase={onCreateCase}
      onNavigate={onNavigate}
      onRunSelectedCases={onRunSelectedCases}
      open
      workspace={{ selectedCaseCount: 2 }}
    />,
  );

  const input = await screen.findByLabelText("向质量评测 AI 助手提问");
  fireEvent.change(input, { target: { value: "帮我新建并运行用例" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

  expect(await screen.findByText("建议操作")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "打开用例库" }));
  expect(onNavigate).toHaveBeenCalledWith("cases", "library");
  fireEvent.click(screen.getByRole("button", { name: "新建用例" }));
  expect(onCreateCase).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "运行已选用例（2）" }));
  expect(onRunSelectedCases).toHaveBeenCalledTimes(1);
});

it("explains a 424 context failure and recovers after refresh", async () => {
  vi.mocked(listEvalCaseResourcesPage).mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 424 },
  });
  render(<EvalAssistantDrawer networkId="kn-1" onAdopted={vi.fn()} onClose={vi.fn()} open />);
  expect(await screen.findByText("资源或规则读取失败，请点击右上角刷新重试。")).toBeTruthy();
  expect(screen.getByText(/评测上下文读取失败/)).toBeTruthy();
  expect(screen.queryByText(/Request failed with status code/)).toBeNull();
  expect(screen.queryByText(/正在读取当前知识网络/)).toBeNull();
  vi.mocked(runEvalAssistant).mockResolvedValue({ answer: "可以通过运行记录查看失败用例。" });
  const input = screen.getByLabelText("向质量评测 AI 助手提问");
  fireEvent.change(input, { target: { value: "怎么查看失败用例" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  await screen.findByText("可以通过运行记录查看失败用例。");
  expect(
    vi.mocked(runEvalAssistant).mock.calls.at(-1)?.[0].workspace.resourceContextAvailable,
  ).toBe(false);
  expect(screen.getByText("资源或规则读取失败，请点击右上角刷新重试。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "刷新质量评测上下文" }));
  expect(await screen.findByText(/已刷新资源与规则，共读取 1 个资源、1 条启用规则/)).toBeTruthy();
  expect(screen.queryByText(/评测上下文读取失败/)).toBeNull();
  expect(screen.getByText(/1\/1 个资源 · 1 条启用规则/)).toBeTruthy();
});

it("loads context once when no rules are configured", async () => {
  const config = await vi.mocked(getEvalTemplateConfig)("kn-1");
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({ ...config, rules: [] });
  render(<EvalAssistantDrawer networkId="kn-1" onAdopted={vi.fn()} onClose={vi.fn()} open />);
  expect(await screen.findByText(/1 个资源 · 0 条启用规则/)).toBeTruthy();
  expect(listEvalCaseResourcesPage).toHaveBeenCalledTimes(1);
});

it("reloads context when the knowledge network changes", async () => {
  const props = { onAdopted: vi.fn(), onClose: vi.fn(), open: true };
  const { rerender } = render(<EvalAssistantDrawer {...props} networkId="kn-1" />);
  await screen.findByText(/1\/1 个资源 · 1 条启用规则/);
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
    entries: [],
    total: 0,
  });
  rerender(<EvalAssistantDrawer {...props} networkId="kn-2" />);
  expect(await screen.findByText(/0\/0 个资源 · 1 条启用规则/)).toBeTruthy();
  expect(listEvalCaseResourcesPage).toHaveBeenLastCalledWith("kn-2", "", "", 1, 100, true);
  expect(getEvalTemplateConfig).toHaveBeenLastCalledWith("kn-2");
});

it("uses the common rule application contract for AI recommendations", async () => {
  vi.mocked(previewRuleApplication).mockResolvedValue({
    entries: [
      {
        key: "target:default",
        target_key: "target",
        resource: { kind: "objectType", id: "material" },
        resource_name: "物料",
        target_id: "material",
        target_name: "物料",
        rule_id: "object-definition",
        rule_title: "对象结构与主显键",
        rule_checksum: "rule",
        resource_checksum: "resource",
        match: "applicable",
        configuration: "incomplete",
        execution: "unsupported",
        execution_reason: "当前检查不能自动执行",
        missing: ["独立预期"],
        sample: {
          target_key: "target",
          sample_id: "default",
          title: "物料检查",
          question: "问题",
          arguments: {},
          scope: { mode: "sample", limit: 100 },
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 100,
    scope_revision: 0,
  });
  const onApplyRules = vi.fn();
  render(
    <EvalAssistantDrawer
      networkId="kn-1"
      open
      onAdopted={vi.fn()}
      onClose={vi.fn()}
      onApplyRules={onApplyRules}
    />,
  );
  await screen.findByText(/可以咨询和使用整个质量评测模块/);
  const input = screen.getByLabelText("向质量评测 AI 助手提问");
  fireEvent.change(input, { target: { value: "验证物料对象类" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  await screen.findByText(/建议验证物料对象类结构/);
  expect(previewRuleApplication).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "生成选中用例" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "knowledgeNetwork.eval.ruleApplication.batchApply" }),
  );
  expect(onApplyRules).toHaveBeenCalledWith({
    ruleIds: ["object-definition"],
    resources: [{ kind: "objectType", id: "material" }],
    targets: [
      { resource_key: "objectType:material", rule_id: "object-definition", target_id: "material" },
    ],
  });
});

it("loads bounded real run details for an evidence question without loading raw traces", async () => {
  const id = "01a1a8bf-c6d6-78e2-b4d5-c525cd9513ad";
  vi.mocked(getM0Run).mockResolvedValue({ id } as Awaited<ReturnType<typeof getM0Run>>);
  vi.mocked(listRunCases).mockImplementation((_kn, _run, cursor) => {
    const page = cursor ? Number(cursor) : 0;
    return Promise.resolve({
      total: 80,
      next_cursor: String(page + 1),
      entries: Array.from({ length: 20 }, (_, i) => ({ id: `case-${page * 20 + i}` })),
    } as Awaited<ReturnType<typeof listRunCases>>);
  });
  vi.mocked(getRunCaseDetail).mockImplementation((_kn, _run, caseId) =>
    Promise.resolve({
      id: caseId,
      case_id: caseId,
      case_version_id: "version-1",
      execution_status: "completed",
      duration_ms: 100,
      assertions: [],
      case_title: "主键检查",
      quality_outcome: "pass",
      findings: [],
      observation: {
        evidence_status: "complete",
        query_summary: { scope: { mode: "sample", limit: 17 }, checked_rows: 17, violations: 0 },
        facts: {
          version: 1,
          resource_kind: "relationType",
          resource_id: "order_user",
          source: "resource_query",
          shape: "records",
          scope: "sample",
          scope_details: { unit: "endpoint_instances", limit: 17, end: "source" },
          checked_rows: 17,
          completeness: "unknown",
          evidence_status: "complete",
        },
        normalized_output: { violations: 0 },
      },
    }),
  );
  vi.mocked(runEvalAssistant).mockResolvedValue({
    answer: "仅依据已读取用例说明采样情况。",
    threadId: "thread-1",
  });
  render(<EvalAssistantDrawer networkId="kn-1" onAdopted={vi.fn()} onClose={vi.fn()} open />);
  await screen.findByText(/可以咨询和使用整个质量评测模块/);
  await waitFor(() => expect(listEvalCaseResourcesPage).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("向质量评测 AI 助手提问"), {
    target: { value: `请分析运行 ${id} 的采样证据` },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => {
    const runDetails = vi.mocked(runEvalAssistant).mock.calls.at(-1)?.[0].workspace?.runDetails;
    expect(runDetails).toMatchObject({ id, complete: false, totalCases: 80 });
    expect(runDetails?.cases[0].querySummary).toMatchObject({ checked_rows: 17 });
    expect(runDetails?.cases[0].facts).toMatchObject({
      scope: "sample",
      checked_rows: 17,
      scope_details: { unit: "endpoint_instances", limit: 17, end: "source" },
      completeness: "unknown",
    });
  });
  expect(getRunCaseDetail).toHaveBeenCalledTimes(50);
  expect(listRunCases).toHaveBeenCalledTimes(3);
});

it("reads subsequent recommendation pages and does not advertise unsupported complete rows as savable", async () => {
  const entry = (i: number) => ({
    key: `target-${i}:default`,
    target_key: `target-${i}`,
    resource: { kind: "objectType", id: "material" },
    resource_name: "物料",
    target_id: `property-${i}`,
    target_name: `属性-${i}`,
    rule_id: "object-definition",
    rule_title: "对象结构与主显键",
    rule_checksum: "rule",
    resource_checksum: "resource",
    match: "applicable" as const,
    configuration: "complete" as const,
    execution: "unsupported",
    execution_reason: "尚未获得只读授权",
    ready_for_save: false,
    save_error: "尚未获得只读授权",
    missing: [],
    sample: {
      target_key: `target-${i}`,
      sample_id: "default",
      title: "物料检查",
      question: "问题",
      arguments: {},
      scope: {},
    },
  });
  vi.mocked(previewRuleApplication).mockImplementation((_kn, request) =>
    Promise.resolve({
      entries: request.page === 1 ? Array.from({ length: 100 }, (_, i) => entry(i)) : [entry(100)],
      total: 101,
      page: request.page,
      limit: 100,
      scope_revision: 1,
    }),
  );
  render(
    <EvalAssistantDrawer
      networkId="kn-1"
      open
      onAdopted={vi.fn()}
      onClose={vi.fn()}
      onApplyRules={vi.fn()}
    />,
  );
  await waitFor(() => expect(listEvalCaseResourcesPage).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("向质量评测 AI 助手提问"), {
    target: { value: "验证物料" },
  });
  fireEvent.keyDown(screen.getByLabelText("向质量评测 AI 助手提问"), {
    key: "Enter",
    code: "Enter",
  });
  expect(await screen.findByText("展示 101 / 101 个检查点")).toBeTruthy();
  expect(previewRuleApplication).toHaveBeenCalledTimes(2);
  expect(screen.getByText("可保存 0 条")).toBeTruthy();
  expect(screen.getByText("已选 101 条")).toBeTruthy();
  expect(screen.queryByText(/未命中的/)).toBeNull();
});
