/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App, Modal } from "antd";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { EvalWorkspaceScene } from "./EvalWorkspaceScene";
import { applyEvalCaseBatch } from "./case-batch.service";
vi.mock("./case-batch.service", () => ({ applyEvalCaseBatch: vi.fn() }));
import { evalLocales } from "./locales";
import {
  getEvalCapabilities,
  getEvalRunPlanCount,
  listEvalRunPlans,
  getEvalCaseDraft,
  getEvalCaseDefinition,
  setEvalCaseEnabled,
  getEvalTemplateConfig,
  getEvalOverview,
  getEvalOverviewScope,
  saveEvalOverviewScope,
  listEvalCaseResourcesPage,
  getM1RunCapabilities,
  listEvalCases,
  listEvalCaseResourceSummary,
  listEvalSuites,
  listM0Runs,
  removeEvalCase,
  searchM0Runs,
  previewM1RunSelection,
  createM1Run,
  type M0Run,
  type M0CaseDetail,
} from "./m0-run.service";
import type { EvalTemplateRule } from "./types";
const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn<(to: { search: string }, options?: unknown) => void>(),
  search: "?tab=overview",
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({
    hash: "",
    key: "test",
    pathname: "/knowledge-network/workspace/supply_ontology_hand/evals",
    search: routerMocks.search,
    state: null,
  }),
  useNavigate: () => routerMocks.navigate,
}));
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});
const rules: EvalTemplateRule[] = [
  {
    id: "object-definition",
    kind: "objectType",
    group: "定义与绑定",
    title: "对象定义完整性",
    description: "检查对象定义",
    appliesWhen: "已配置数据源",
    evidence: "定义快照",
    planDimensions: ["对象定义"],
    preset: "required",
    enabled: true,
  },
  {
    id: "object-instance",
    kind: "objectType",
    group: "实例数据",
    title: "实例可查询性",
    description: "检查对象实例",
    appliesWhen: "存在实例",
    evidence: "实例样本",
    planDimensions: ["实例查询"],
    preset: "standard",
    enabled: true,
  },
];
vi.mock("./m0-run.service", () => ({
  CASE_LIST_BATCH_SIZE: 50,
  getEvalCapabilities: vi.fn(),
  getEvalRunPlanCount: vi.fn(),
  listEvalRunPlans: vi.fn(),
  createEvalCase: vi.fn(),
  getEvalCaseDraft: vi.fn(),
  getEvalCaseDefinition: vi.fn(),
  setEvalCaseEnabled: vi.fn(),
  replaceEvalCase: vi.fn(),
  removeEvalCase: vi.fn(),
  listEvalCases: vi.fn(),
  listEvalCaseResourceSummary: vi.fn(),
  getEvalTemplateConfig: vi.fn(),
  getEvalOverview: vi.fn(),
  getEvalOverviewScope: vi.fn(),
  saveEvalOverviewScope: vi.fn(),
  listEvalCaseResourcesPage: vi.fn(),
  getM1RunCapabilities: vi.fn(),
  listEvalSuites: vi.fn(),
  listEvalSuiteVersions: vi.fn(),
  createM1Run: vi.fn(),
  previewM1RunSelection: vi.fn(),
  listM0Runs: vi.fn(),
  searchM0Runs: vi.fn(),
}));
vi.mock("./EvalTemplateGenerationDrawer", () => ({
  EvalAssistantDrawer: ({
    repairRequest,
    onClose,
  }: {
    repairRequest?: {
      cases: { id: string; latest_run_id?: string; latest_case_run_id?: string }[];
    };
    onClose: () => void;
  }) => (
    <aside aria-label="质量评测 AI 助手">
      <output data-testid="repair-request">{JSON.stringify(repairRequest)}</output>
      <button onClick={onClose}>关闭助手</button>
    </aside>
  ),
}));
vi.mock("./EvalMultiRunPanel", () => ({
  EvalMultiRunPanel: ({
    runId,
    initialOutcome,
    preferredCaseRunId,
    onRerun,
    onRepair,
    initialDetailTab,
  }: {
    runId: string;
    initialOutcome?: string;
    preferredCaseRunId?: string;
    onRerun?: (detail: M0CaseDetail) => void;
    onRepair?: (run: M0Run, detail: M0CaseDetail) => void | Promise<void>;
    initialDetailTab?: string;
  }) => (
    <div>
      <div>Multi Run panel · {runId}</div>
      <output data-testid="case-outcome-filter">{initialOutcome}</output>
      <output data-testid="preferred-case">{preferredCaseRunId}</output>
      <output data-testid="detail-tab">{initialDetailTab}</output>
      {onRepair && (
        <button
          onClick={() =>
            void onRepair(
              {
                id: runId,
                execution_status: "completed",
                quality_outcome: "fail",
                phase: null,
                result_revision: 2,
                progress: { planned_cases: 1, completed_cases: 1 },
              },
              {
                id: preferredCaseRunId ?? "case-run-1",
                case_id: "case-1",
                case_version_id: "version-1",
                case_title: "标准交期校验",
                execution_status: "completed",
                quality_outcome: "fail",
                assertions: [],
                findings: [],
                duration_ms: 5,
              },
            )
          }
        >
          AI 修复
        </button>
      )}
      {onRerun && (
        <button
          onClick={() =>
            onRerun({
              id: "case-run-1",
              case_id: "case-1",
              case_title: "标准交期校验",
              case_version_id: "version-2",
              case_version: 2,
              execution_status: "completed",
              quality_outcome: "fail",
              duration_ms: 5,
              assertions: [],
              findings: [],
            })
          }
        >
          重新运行
        </button>
      )}
    </div>
  ),
}));
vi.mock("./EvalAgentComparisonWorkspace", () => ({
  EvalAgentComparisonWorkspace: ({
    onBack,
    onInspect,
  }: {
    onBack: () => void;
    onInspect: (run: M0Run, caseRunId: string) => void;
  }) => (
    <section aria-label="Comparison workspace">
      <button onClick={onBack}>Back to records</button>
      <button
        onClick={() =>
          onInspect(
            {
              id: "off-page-agent-run",
              runner_type: "external_agent",
              execution_status: "completed",
              phase: null,
              quality_outcome: "pass",
              result_revision: 1,
              scope: { kind: "suite", suite_id: "supply-m0-leadtime", version: 1 },
              progress: { planned_cases: 30, completed_cases: 30 },
            },
            "case-outside-first-page",
          )
        }
      >
        Inspect comparison cell
      </button>
    </section>
  ),
}));
vi.mock("./EvalRunComparisonDrawer", () => ({
  EvalRunComparisonPanel: () => <div>Comparison panel</div>,
}));
vi.mock("./EvalCaseEditorDrawer", () => ({
  EvalCaseEditorDrawer: ({
    open,
    caseId,
    initialResource,
  }: {
    open: boolean;
    caseId?: string;
    initialResource?: { id: string; name: string; kind: string };
  }) =>
    open ? (
      <div role="dialog">
        编辑用例 {caseId}
        {initialResource && (
          <output data-testid="initial-resource">{JSON.stringify(initialResource)}</output>
        )}
      </div>
    ) : null,
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
  routerMocks.search = "?tab=overview";
  vi.mocked(getEvalCaseDefinition).mockImplementation(async (_networkId, caseId) => {
    const latest = vi.mocked(listEvalCases).mock.results.at(-1);
    const page = latest?.type === "return" ? await latest.value : undefined;
    const summary = page?.entries.find(
      (entry: Awaited<ReturnType<typeof listEvalCases>>["entries"][number]) => entry.id === caseId,
    );
    return {
      case_id: caseId,
      archived: false,
      gold_visible: false,
      source: {
        type: summary?.source_type,
        rule_id: summary?.template_rule_id,
        rule_title: summary?.template_rule_title,
      },
      definition: {
        title: summary?.title ?? caseId,
        category: "fact",
        risk_level: "medium",
        input_spec: summary?.input_spec ?? {},
        execution_spec: summary?.execution_spec ?? { runner: "direct_capability" },
        assertions: [],
        expected_spec: null,
        expected_source: { kind: "business_expert", evidence_refs: [] },
        diagnostic_spec: { template_rule_revision: summary?.template_rule_revision },
      },
    };
  });
  vi.clearAllMocks();
  vi.mocked(listEvalCaseResourceSummary).mockResolvedValue({
    entries: [{ name: "标准交期", kinds: ["unknown"], case_count: 1 }],
    total: 1,
    case_total: 1,
    page: 1,
    limit: 10,
  });
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: false });
  vi.mocked(getEvalRunPlanCount).mockResolvedValue(0);
  vi.mocked(listEvalRunPlans).mockResolvedValue({ entries: [], total: 0, page: 1, limit: 20 });
  vi.mocked(getM1RunCapabilities).mockResolvedValue(false);
  vi.mocked(listEvalSuites).mockResolvedValue({ entries: [], total: 0, page: 1, limit: 20 });
  vi.mocked(listM0Runs).mockResolvedValue([]);
  vi.mocked(searchM0Runs).mockResolvedValue({ entries: [], total: 0, page: 1, limit: 20 });
  vi.mocked(getEvalOverview).mockResolvedValue({
    generated_at: "2026-11-03T00:00:00Z",
    scope: { revision: 0, excluded_kinds: [], excluded_resources: [] },
    resources: {
      total: 29,
      in_scope: 27,
      excluded: 2,
      covered: 20,
      evaluated: 16,
      passed: 15,
      problems: 1,
      uncovered: 9,
      unresolved_bindings: 0,
    },
    rule_points: {
      enabled_rules: 35,
      applicable: 90,
      covered: 63,
      missing: 27,
      not_ready: 4,
    },
    cases: {
      total: 52,
      excluded: 2,
      enabled: 35,
      runnable: 32,
      evaluated: 28,
      passed: 27,
      failed: 1,
      inconclusive: 0,
      review_required: 0,
      execution_failed: 0,
      in_progress: 0,
      cancelled: 0,
      not_run: 7,
    },
    coverage: {
      resource_percent: 74.1,
      rule_percent: 70,
      execution_percent: 80,
      pass_percent: 96.4,
    },
    by_resource_type: [
      {
        kind: "objectType",
        resources: 10,
        in_scope_resources: 8,
        excluded_resources: 2,
        covered_resources: 8,
        evaluated_resources: 7,
        passed_resources: 7,
        problem_resources: 0,
        coverage_percent: 80,
      },
    ],
    resource_details: [
      {
        kind: "objectType",
        id: "material",
        name: "物料",
        in_scope: true,
        status: "passed",
        case_count: 2,
        evaluated_cases: 2,
        passed_cases: 2,
        problem_cases: 0,
        pending_cases: 0,
        latest_run_id: "run-material",
        latest_quality_outcome: "pass",
      },
      {
        kind: "objectType",
        id: "supplier",
        name: "供应商",
        in_scope: false,
        status: "excluded",
        case_count: 0,
        evaluated_cases: 0,
        passed_cases: 0,
        problem_cases: 0,
        pending_cases: 0,
      },
    ],
    case_details: [
      {
        id: "supply-f07-leadtime",
        title: "F-07 外购物料标准采购交期",
        version: 1,
        enabled: true,
        runnable: true,
        excluded: false,
        target_kind: "resource",
        target_names: ["标准交期"],
        status: "failed",
        latest_run_id: "run-f07",
        latest_execution_status: "completed",
        latest_quality_outcome: "fail",
      },
    ],
  });
  vi.mocked(getEvalOverviewScope).mockResolvedValue({
    revision: 0,
    excluded_kinds: [],
    excluded_resources: [],
  });
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "supply-f07-leadtime",
        title: "F-07 外购物料标准采购交期",
        enabled: true,
        execution_setup: "ready_for_preflight",
        source_type: "imported_sample",
        source_case_id: "F-07",
        input_spec: { question: "标准采购交期是多少天？" },
        execution_spec: {
          runner: "direct_capability",
          target: { name: "标准交期", operation: "leadtime_days" },
        },
        created_at: "2026-10-29T00:00:00Z",
      },
    ],
    total: 1,
    next_cursor: null,
  });
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    revision: 0,
    checksum: "0123456789abcdef",
    rules,
  });
});
it("shows objective resource, rule and execution coverage without a quality conclusion", async () => {
  render(
    <EvalWorkspaceScene
      networkId="supply_ontology_hand"
      activeTab="overview"
      onTabChange={vi.fn()}
    />,
  );
  expect(await screen.findByLabelText("配置评测范围", { selector: "button" })).toBeTruthy();
  expect(screen.queryByText("知识网络评测统计")).toBeNull();
  expect(screen.getByRole("tab", { name: "资源覆盖" })).toBeTruthy();
  const caseView = screen.getByRole("tab", { name: "用例与运行" });
  expect(caseView).toBeTruthy();
  expect(screen.getAllByText("资源总数").length).toBeGreaterThan(0);
  expect(screen.getAllByText("资源覆盖").length).toBeGreaterThan(0);
  expect(screen.getByText("规则检测点覆盖")).toBeTruthy();
  const coverage = await screen.findByText("资源评测覆盖", { exact: true });
  expect(coverage).toBeVisible();
  expect(coverage.closest(".ant-collapse")).toBeNull();
  expect(screen.queryByText("按资源类型查看覆盖", { exact: true })).toBeNull();
  expect(
    within(coverage.closest<HTMLElement>(".ant-card")!).getByRole("button", { name: "对象类" }),
  ).toBeVisible();
  expect(screen.queryByText("待补充情况")).toBeNull();
  expect(screen.getByText("纳入 27 个 · 排除 2 个")).toBeTruthy();
  fireEvent.click(caseView);
  expect(screen.getByText("用例总数")).toBeTruthy();
  expect(screen.queryByText("运行配置就绪")).toBeNull();
  expect(screen.getByText("已启用用例")).toBeTruthy();
  expect(screen.getByText("执行覆盖")).toBeTruthy();
  expect(screen.getByText("另有 2 条用例不参与当前评测，")).toBeTruthy();
  expect(screen.queryByText(/严格质量检测/)).toBeNull();
});
it("hides excluded resource types and restores them after saving assessment scope", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  let overview = await getEvalOverview("supply_ontology_hand");
  overview = {
    ...overview,
    by_resource_type: [
      ...overview.by_resource_type,
      {
        kind: "skill",
        resources: 1,
        in_scope_resources: 1,
        excluded_resources: 0,
        covered_resources: 0,
        evaluated_resources: 0,
        passed_resources: 0,
        problem_resources: 0,
        coverage_percent: 0,
      },
      {
        kind: "function",
        resources: 1,
        in_scope_resources: 0,
        excluded_resources: 1,
        covered_resources: 0,
        evaluated_resources: 0,
        passed_resources: 0,
        problem_resources: 0,
        coverage_percent: 0,
      },
    ],
    scope: {
      revision: 0,
      excluded_kinds: ["skill"],
      excluded_resources: [{ kind: "function", id: "fn-1" }],
    },
  };
  vi.mocked(getEvalOverview).mockImplementation(() => Promise.resolve(overview));
  vi.mocked(getEvalOverviewScope).mockImplementation(() => Promise.resolve(overview.scope));
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({ entries: [], total: 0 });
  vi.mocked(saveEvalOverviewScope).mockImplementation((_networkId, scope) => {
    overview = { ...overview, scope: { ...scope, revision: scope.revision + 1 } };
    return Promise.resolve(overview.scope);
  });
  render(
    <App>
      <EvalWorkspaceScene
        networkId="supply_ontology_hand"
        activeTab="overview"
        onTabChange={vi.fn()}
      />
    </App>,
  );
  await screen.findByText("资源评测覆盖", { exact: true });
  await screen.findByRole("button", { name: "对象类" });
  expect(screen.queryByRole("button", { name: "SKILLS" })).toBeNull();
  // Excluding individual resources must not hide their entire resource type.
  expect(screen.getByRole("button", { name: "函数" })).toBeTruthy();
  for (const included of [true, false]) {
    fireEvent.click(screen.getByRole("button", { name: "配置评测范围" }));
    const dialog = await screen.findByRole("dialog", { name: "配置评测范围" });
    const checkbox = await within(dialog).findByRole("checkbox", { name: "SKILLS" });
    expect((checkbox as HTMLInputElement).checked).toBe(!included);
    fireEvent.click(checkbox);
    fireEvent.click(within(dialog).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "配置评测范围" })).toBeNull());
    await screen.findByText("资源评测覆盖", { exact: true });
    await waitFor(() => {
      if (included) expect(screen.getByRole("button", { name: "SKILLS" })).toBeTruthy();
      else expect(screen.queryByRole("button", { name: "SKILLS" })).toBeNull();
    });
    expect(screen.getByRole("button", { name: "函数" })).toBeTruthy();
  }
  expect(saveEvalOverviewScope).toHaveBeenLastCalledWith("supply_ontology_hand", {
    revision: 1,
    excluded_kinds: ["skill"],
    excluded_resources: [{ kind: "function", id: "fn-1" }],
  });
}, 60000);
it("starts a new case for an uncovered resource with its identity preselected", async () => {
  const overview = await vi.mocked(getEvalOverview)("kn-1");
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  vi.mocked(getEvalOverview).mockResolvedValue({
    ...overview,
    resource_details: [
      {
        kind: "relationType",
        id: "order-supplier",
        name: "订单关联供应商",
        in_scope: true,
        status: "uncovered",
        case_count: 0,
        evaluated_cases: 0,
        passed_cases: 0,
        problem_cases: 0,
        pending_cases: 0,
      },
    ],
    case_details: [],
  });
  const onTabChange = vi.fn();
  const view = render(
    <EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={onTabChange} />,
  );
  const panel = await screen.findByLabelText("资源与场景评测结果", { selector: "section" });
  fireEvent.click(
    within(panel).getByText("未完成评测", { selector: "button > span" }).closest("button")!,
  );
  fireEvent.click(within(panel).getByLabelText("订单关联供应商 操作", { selector: "button" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "新建用例" }));
  expect(onTabChange).toHaveBeenCalledWith("cases", expect.any(Object));
  view.rerender(
    <EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={onTabChange} />,
  );
  const initial = await screen.findByTestId("initial-resource");
  expect(JSON.parse(initial.textContent ?? "")).toEqual({
    kind: "relationType",
    id: "order-supplier",
    name: "订单关联供应商",
  });
}, 15_000);

it("opens a scenario result in the case library using its case ID without a resource filter", async () => {
  const overview = await vi.mocked(getEvalOverview)("kn-1");
  vi.mocked(getEvalOverview).mockResolvedValue({
    ...overview,
    case_details: [
      {
        id: "scenario-order-pay",
        title: "订单支付金额场景",
        enabled: true,
        runnable: true,
        excluded: false,
        target_kind: "business_scenario",
        target_names: [],
        targets: [],
        status: "failed",
      },
    ],
  });
  const onTabChange = vi.fn();
  const view = render(
    <EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={onTabChange} />,
  );
  const panel = await screen.findByLabelText("资源与场景评测结果", { selector: "section" });
  const row = within(panel)
    .getByText("订单支付金额场景", { selector: "button > span" })
    .closest("button")!
    .closest("tr")!;
  fireEvent.click(within(row).getByLabelText("订单支付金额场景 操作", { selector: "button" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "前往用例库" }));
  expect(onTabChange).toHaveBeenCalledWith("cases", expect.any(Object));
  expect(routerMocks.navigate).not.toHaveBeenCalled();
  view.rerender(
    <EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={onTabChange} />,
  );
  await waitFor(() =>
    expect(listEvalCases).toHaveBeenCalledWith("kn-1", "scenario-order-pay", undefined, undefined),
  );
}, 15_000);

it("drills resource coverage down to resources and opens their cases", async () => {
  const onTabChange = vi.fn();
  render(
    <EvalWorkspaceScene
      networkId="supply_ontology_hand"
      activeTab="overview"
      onTabChange={onTabChange}
    />,
  );
  await screen.findByText("资源评测覆盖", { exact: true });
  fireEvent.click(
    (await screen.findByText("对象类", { selector: "button > span" })).closest("button")!,
  );
  const detail = (await screen.findByText("对象类评测明细")).closest<HTMLElement>(
    '[role="dialog"]',
  )!;
  expect(within(detail).getByText("物料")).toBeTruthy();
  expect(within(detail).getByText("供应商")).toBeTruthy();
  expect(within(detail).getByText("2 条用例")).toBeTruthy();
  fireEvent.click(within(detail).getByText("物料").closest("button")!);
  expect(routerMocks.navigate).toHaveBeenCalledWith(
    "/knowledge-network/workspace/supply_ontology_hand/object-types/material/detail",
    {
      state: {
        returnTo: "/knowledge-network/workspace/supply_ontology_hand/evals?tab=overview",
      },
    },
  );
  fireEvent.click(
    within(detail).getByText("查看用例", { selector: "button > span" }).closest("button")!,
  );
  expect(onTabChange).toHaveBeenCalledWith("cases", expect.any(Object));
}, 15_000);
it.each([
  ["failed", "未通过"],
  ["passed", "通过"],
] as const)(
  "drills %s Case counters into the filtered Case library without a drawer",
  async (status, label) => {
    const overview = await vi.mocked(getEvalOverview)("kn-1");
    vi.mocked(getEvalOverview).mockResolvedValue({
      ...overview,
      cases: {
        ...overview.cases,
        passed: status === "passed" ? 1 : 0,
        failed: status === "failed" ? 1 : 0,
      },
    });
    const onTabChange = vi.fn();
    render(<EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={onTabChange} />);
    fireEvent.click(await screen.findByText("用例与运行", { selector: '[role="tab"]' }));
    fireEvent.click(
      within(screen.getByTestId("eval-overview-results"))
        .getByText(label, { selector: "button > span" })
        .closest("button")!,
    );
    expect(onTabChange).toHaveBeenCalledWith(
      "cases",
      expect.objectContaining({
        view: "library",
        result: status,
        status: "enabled",
        participation: "participating",
        search: "",
        resource: "",
        resourceType: "all",
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  },
  15_000,
);
it("routes overview totals to the correct Case or Suite view with fresh filters", async () => {
  const onTabChange = vi.fn();
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={onTabChange} />);
  fireEvent.click(await screen.findByText("用例与运行", { selector: '[role="tab"]' }));
  fireEvent.click(
    within(screen.getByLabelText("用例与运行统计", { selector: "section" }))
      .getByText("用例总数", { selector: "button > span" })
      .closest("button")!,
  );
  expect(onTabChange).toHaveBeenLastCalledWith(
    "cases",
    expect.objectContaining({
      view: "library",
      result: "all",
      participation: "all",
      status: "all",
    }),
  );
  fireEvent.click(
    within(screen.getByLabelText("用例与运行统计", { selector: "section" }))
      .getByText("已启用用例", { selector: "button > span" })
      .closest("button")!,
  );
  expect(onTabChange).toHaveBeenLastCalledWith(
    "cases",
    expect.objectContaining({ status: "enabled", participation: "participating", result: "all" }),
  );
  fireEvent.click(
    within(screen.getByLabelText("用例与运行统计", { selector: "section" }))
      .getByText("执行覆盖", { selector: "button > span" })
      .closest("button")!,
  );
  expect(onTabChange).toHaveBeenLastCalledWith(
    "cases",
    expect.objectContaining({ result: "evaluated", participation: "participating" }),
  );
  fireEvent.click(
    within(screen.getByLabelText("用例与运行统计", { selector: "section" }))
      .getByText("测试集", { selector: "button > span" })
      .closest("button")!,
  );
  expect(onTabChange).toHaveBeenLastCalledWith(
    "cases",
    expect.objectContaining({ view: "suites" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
}, 15_000);
it("offers manual and template creation from the Case library New menu", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "新建" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "新建" }));
  expect(await screen.findByRole("menuitem", { name: "手动新建" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "从模板新建" })).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("menuitem", { name: "手动新建" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("编辑用例");
  expect(screen.queryByText("从模板新建用例")).toBeNull();
}, 30000);
it("opens the shared rule application flow from template creation with enabled library rules", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({ entries: [], total: 0 });
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    revision: 1,
    checksum: "rule-sha",
    rules: [rules[0], { ...rules[1], enabled: false }],
  });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "新建" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "新建" }));
  const templateItem = await screen.findByRole("menuitem", { name: "从模板新建" });
  await waitFor(() => expect(templateItem).not.toHaveAttribute("aria-disabled", "true"));
  fireEvent.click(templateItem);
  const drawer = await screen.findByRole("dialog", { name: "从模板新建用例" });
  expect(within(drawer).getByText("选择范围")).toBeTruthy();
  fireEvent.mouseDown(within(drawer).getByLabelText("选择规则", { selector: '[role="combobox"]' }));
  fireEvent.click(
    await screen.findByText("对象定义完整性", { selector: ".ant-select-item-option-content" }),
  );
  expect(
    screen.queryByText("实例可查询性", { selector: ".ant-select-item-option-content" }),
  ).toBeNull();
  await waitFor(() =>
    expect(listEvalCaseResourcesPage).toHaveBeenLastCalledWith(
      "supply_ontology_hand",
      "objectType",
      "",
      1,
      10,
      true,
    ),
  );
  expect(within(drawer).getByRole("button", { name: "下一步" })).toBeDisabled();
}, 30000);
it("keeps manual creation available when evaluation templates fail to load", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  vi.mocked(getEvalTemplateConfig).mockRejectedValue(new Error("template unavailable"));
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "新建" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "新建" }));
  expect(await screen.findByRole("menuitem", { name: "从模板新建" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "手动新建" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("编辑用例");
}, 30000);
it("runs a ready Case from its action menu without opening the launch drawer", async () => {
  vi.mocked(getM1RunCapabilities).mockResolvedValue(true);
  vi.mocked(previewM1RunSelection).mockResolvedValue({
    case_count: 1,
    eligible: true,
    execution_mode: "platform",
    reasons: [],
  });
  vi.mocked(createM1Run).mockResolvedValue({ id: "case-run-1" } as Awaited<
    ReturnType<typeof createM1Run>
  >);
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "case-1",
        title: "物料标准交期",
        enabled: true,
        execution_setup: "ready_for_preflight",
        created_at: "2026-11-02T00:00:00Z",
      },
    ],
    total: 1,
    next_cursor: null,
  });
  const confirm = vi.spyOn(Modal, "confirm").mockImplementation((config) => {
    void (config.onOk as (() => void) | undefined)?.();
    return {} as ReturnType<typeof Modal.confirm>;
  });
  const onTabChange = vi.fn();
  render(
    <EvalWorkspaceScene
      networkId="supply_ontology_hand"
      activeTab="cases"
      onTabChange={onTabChange}
    />,
  );
  const row = (await screen.findByText("物料标准交期")).closest("tr");
  fireEvent.click(within(row!).getByRole("button", { name: "用例操作" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "运行" }));
  await waitFor(() =>
    expect(previewM1RunSelection).toHaveBeenCalledWith("supply_ontology_hand", {
      kind: "cases",
      case_ids: ["case-1"],
    }),
  );
  await waitFor(() =>
    expect(createM1Run).toHaveBeenCalledWith(
      "supply_ontology_hand",
      { kind: "cases", case_ids: ["case-1"] },
      expect.any(String),
    ),
  );
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({ title: "确定运行「物料标准交期」吗？" }),
  );
  expect(screen.queryByText("发起质量评测")).toBeNull();
  expect(routerMocks.navigate).toHaveBeenCalledWith(
    expect.objectContaining({ search: expect.stringContaining("run_id=") as unknown }),
    expect.anything(),
  );
}, 30000);
it("selects multiple runnable cases and submits one batch run", async () => {
  vi.mocked(getM1RunCapabilities).mockResolvedValue(true);
  vi.mocked(previewM1RunSelection).mockResolvedValue({
    case_count: 2,
    eligible: true,
    execution_mode: "platform",
    reasons: [],
  });
  vi.mocked(createM1Run).mockResolvedValue({ id: "batch-run-1" } as Awaited<
    ReturnType<typeof createM1Run>
  >);
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "case-1",
        title: "物料标准交期",
        enabled: true,
        execution_setup: "ready_for_preflight",
        created_at: "2026-11-02T00:00:00Z",
      },
      {
        id: "case-2",
        title: "供应商端点合法性",
        enabled: true,
        execution_setup: "ready_for_preflight",
        created_at: "2026-11-02T00:00:00Z",
      },
    ],
    total: 2,
    next_cursor: null,
  });
  const confirm = vi.spyOn(Modal, "confirm").mockImplementation((config) => {
    void (config.onOk as (() => void) | undefined)?.();
    return {} as ReturnType<typeof Modal.confirm>;
  });
  const onTabChange = vi.fn();
  render(
    <EvalWorkspaceScene
      networkId="supply_ontology_hand"
      activeTab="cases"
      onTabChange={onTabChange}
    />,
  );
  const firstRow = (await screen.findByText("物料标准交期")).closest("tr");
  const secondRow = screen.getByText("供应商端点合法性").closest("tr");
  fireEvent.click(within(firstRow!).getByRole("checkbox"));
  fireEvent.click(within(secondRow!).getByRole("checkbox"));
  fireEvent.click(screen.getByText("运行（2）", { selector: "button > span" }).closest("button")!);
  const scope = {
    kind: "cases" as const,
    case_ids: ["case-1", "case-2"],
  };
  await waitFor(() =>
    expect(previewM1RunSelection).toHaveBeenCalledWith("supply_ontology_hand", scope),
  );
  await waitFor(() =>
    expect(createM1Run).toHaveBeenCalledWith("supply_ontology_hand", scope, expect.any(String)),
  );
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({ title: "确定运行这 2 条用例吗？" }),
  );
  expect(screen.queryByText("发起质量评测")).toBeNull();
  expect(routerMocks.navigate).toHaveBeenCalledWith(
    expect.objectContaining({ search: expect.stringContaining("run_id=") as unknown }),
    expect.anything(),
  );
}, 15_000);
it("offers detail, edit and delete for draft and enabled cases", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "draft-case",
        title: "草稿用例",
        enabled: false,
        source_type: "manual",
        created_at: "2026-10-29T00:00:00Z",
      },
      {
        id: "enabled-case",
        title: "已启用用例",
        enabled: true,
        source_type: "manual",
        created_at: "2026-10-28T00:00:00Z",
      },
    ],
    total: 2,
    next_cursor: null,
  });
  vi.mocked(removeEvalCase).mockResolvedValue({ result: "deleted" });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  await screen.findByText("草稿用例", {}, { timeout: 10000 });
  const actions = screen.getAllByRole("button", { name: "用例操作" });
  fireEvent.click(actions[0]);
  expect(await screen.findByRole("menuitem", { name: "详情" })).toBeTruthy();
  expect(await screen.findByRole("menuitem", { name: "编辑" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "删除" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "启用" })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "归档" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "完善样本" })).toBeNull();
  const confirmSpy = vi
    .spyOn(Modal, "confirm")
    .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  fireEvent.click(screen.getByRole("menuitem", { name: "删除" }));
  expect(confirmSpy.mock.calls[0][0].title).toBe("删除「草稿用例」？");
  await (confirmSpy.mock.calls[0][0].onOk as () => Promise<void>)();
  await waitFor(() =>
    expect(removeEvalCase).toHaveBeenCalledWith("supply_ontology_hand", "draft-case", "delete"),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "用例操作" })[1]);
  expect(await screen.findByRole("menuitem", { name: "删除" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "停用" })).toBeTruthy();
  fireEvent.click(screen.getByRole("menuitem", { name: "删除" }));
  expect(confirmSpy.mock.calls[1][0].title).toBe("删除「已启用用例」？");
  await (confirmSpy.mock.calls[1][0].onOk as () => Promise<void>)();
  expect(removeEvalCase).toHaveBeenCalledWith("supply_ontology_hand", "enabled-case", "delete");
  confirmSpy.mockRestore();
}, 30000);
it("stops an enabled case and resumes a stopped case without changing its version", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "active",
        title: "运行中用例",
        enabled: true,
        source_type: "manual",
        created_at: "2026-10-29T00:00:00Z",
      },
      {
        id: "stopped",
        title: "已停用用例",
        enabled: false,
        source_type: "manual",
        created_at: "2026-10-28T00:00:00Z",
      },
    ],
    total: 2,
    next_cursor: null,
  });
  vi.mocked(setEvalCaseEnabled).mockResolvedValue(undefined);
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  await screen.findByText("运行中用例", {}, { timeout: 10000 });
  const confirmSpy = vi
    .spyOn(Modal, "confirm")
    .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  fireEvent.click(screen.getAllByRole("button", { name: "用例操作" })[0]);
  fireEvent.click(await screen.findByRole("menuitem", { name: "停用" }));
  expect(confirmSpy.mock.calls[0][0].title).toBe("停用「运行中用例」？");
  await (confirmSpy.mock.calls[0][0].onOk as () => Promise<void>)();
  expect(setEvalCaseEnabled).toHaveBeenCalledWith("supply_ontology_hand", "active", false);
  fireEvent.click(screen.getAllByRole("button", { name: "用例操作" })[1]);
  fireEvent.click(await screen.findByRole("menuitem", { name: "启用" }));
  await waitFor(() =>
    expect(setEvalCaseEnabled).toHaveBeenCalledWith("supply_ontology_hand", "stopped", true),
  );
  expect(getEvalCaseDraft).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
}, 30000);
it("shows the exact template rule linked to a generated Case", async () => {
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "case-template-1",
        title: "采购订单 · 供应商必填",
        enabled: false,
        source_type: "template",
        template_rule_id: "custom-supplier-required",
        template_rule_title: "供应商必填",
        template_rule_revision: 3,
        input_spec: { question: "核对采购订单供应商" },
        execution_spec: {
          runner: "unbound",
          target: { name: "采购订单", capability_type: "object_type", resource_id: "order" },
        },
        created_at: "2026-10-29T00:00:00Z",
      },
    ],
    total: 1,
    next_cursor: null,
  });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  expect(await screen.findByText("供应商必填")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /采购订单 · 供应商必填/ }));
  expect(await screen.findByText(/供应商必填 · 规则修订 3/)).toBeTruthy();
  expect(screen.getByText(/^采购订单 · 对象类$/)).toBeTruthy();
});
it("shows the current rule name when an older Case only stores the rule ID", async () => {
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "case-legacy-1",
        title: "采购订单 · 对象定义检查",
        enabled: false,
        source_type: "template",
        template_rule_id: "object-definition",
        created_at: "2026-10-29T00:00:00Z",
      },
    ],
    total: 1,
    next_cursor: null,
  });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  expect(await screen.findByText("对象定义完整性（当前名称）")).toBeTruthy();
  expect(screen.getByText("规则生成")).toBeTruthy();
});
it("paginates the Case table while keeping the resource navigation available", async () => {
  const entries = Array.from({ length: 44 }, (_, index) => ({
    id: `case-${index + 1}`,
    title: `用例 ${index + 1}`,
    enabled: false,
    execution_spec: { target: { name: "共有资源" } },
    created_at: "2026-10-29T00:00:00Z",
  }));
  vi.mocked(listEvalCases).mockResolvedValue({ entries, total: 44, next_cursor: null });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const table = screen.getByRole("region", { name: "用例清单" });
  expect(await within(table).findByText("用例 1")).toBeTruthy();
  expect(within(table).queryByText("用例 11")).toBeNull();
  expect(within(table).getAllByRole("row")).toHaveLength(11);
  expect(within(table).getByText("共 44 条")).toBeTruthy();
  expect(within(table).getByRole("listitem", { name: "3" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: /^用例库（44）/ })).toBeTruthy();
  fireEvent.click(within(table).getByRole("listitem", { name: /Next Page|下一页/i }));
  expect(within(table).getByText("用例 11")).toBeTruthy();
  expect(within(table).queryByText("用例 1")).toBeNull();
  expect(within(table).getByText("共 44 条")).toBeTruthy();
  fireEvent.click(within(table).getByRole("listitem", { name: /Previous Page|上一页/i }));
  expect(within(table).getByText("用例 1")).toBeTruthy();
}, 30000);
it("shows complete resource counts independently of the first Case batch", async () => {
  vi.mocked(listEvalCaseResourceSummary).mockResolvedValue({
    entries: [{ name: "物料", kinds: ["objectType"], case_count: 60 }],
    total: 1,
    case_total: 60,
    page: 1,
    limit: 10,
  });
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "case-1",
        title: "物料用例",
        enabled: false,
        execution_spec: { target: { name: "物料", resource_id: "material" } },
        created_at: "2026-10-29T00:00:00Z",
      },
    ],
    total: 60,
    next_cursor: "next",
  });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  const resource = await within(navigation).findByTitle("物料");
  expect(within(resource).getByText("60")).toBeTruthy();
  expect(within(resource).getByTitle("完整用例库中关联该资源的用例数")).toBeTruthy();
  expect(screen.getByRole("tab", { name: /^用例库（60）/ })).toBeTruthy();
  expect(within(navigation).queryByText("本批资源 · 搜索全部请用右侧搜索")).toBeNull();
}, 30000);
it("keeps the resource pager independent of Case selection and filtering", async () => {
  vi.mocked(listEvalCaseResourceSummary).mockImplementation((_kn, _type, page, limit = 10) =>
    Promise.resolve({
      entries: Array.from({ length: page === 1 ? 10 : 1 }, (_, index) => ({
        name: `资源 ${(page - 1) * limit + index + 1}`,
        kinds: ["unknown"],
        case_count: 1,
      })),
      total: 11,
      case_total: 11,
      page,
      limit,
    }),
  );
  const entries = Array.from({ length: 11 }, (_, index) => ({
    id: `case-${index + 1}`,
    title: `用例 ${index + 1}`,
    enabled: false,
    execution_spec: { target: { name: `资源 ${index + 1}` } },
    created_at: "2026-10-29T00:00:00Z",
  }));
  vi.mocked(listEvalCases).mockResolvedValue({ entries, total: 11, next_cursor: null });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  expect(await within(navigation).findByTitle("资源 1")).toBeTruthy();
  expect(within(navigation).queryByTitle("资源 11")).toBeNull();
  fireEvent.click(within(navigation).getByRole("listitem", { name: /Next Page|下一页/i }));
  expect(await within(navigation).findByTitle("资源 11")).toBeTruthy();
  expect(within(navigation).queryByTitle("资源 1")).toBeNull();
  fireEvent.click(within(navigation).getByRole("button", { name: /资源 11/ }));
  await waitFor(() =>
    expect(listEvalCases).toHaveBeenCalledWith("supply_ontology_hand", "", undefined, undefined, {
      name: "资源 11",
      type: undefined,
    }),
  );
  expect(screen.getByPlaceholderText("搜索用例、资源名称或 ID")).toHaveProperty("value", "");
  expect(within(navigation).getByTitle("资源 11")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("搜索用例、资源名称或 ID"), {
    target: { value: "搜索" },
  });
  await waitFor(() =>
    expect(listEvalCases).toHaveBeenLastCalledWith(
      "supply_ontology_hand",
      "搜索",
      undefined,
      undefined,
      { name: "资源 11", type: undefined },
    ),
  );
  expect(listEvalCaseResourceSummary).toHaveBeenCalledTimes(2);
  expect(within(navigation).getByTitle("资源 11")).toBeTruthy();
  fireEvent.mouseDown(
    within(navigation).getByLabelText("按资源类型定位", { selector: '[role="combobox"]' }),
  );
  fireEvent.click(
    await screen.findByText("对象类", { selector: ".ant-select-item-option-content" }),
  );
  expect(await within(navigation).findByTitle("资源 1")).toBeTruthy();
  expect(vi.mocked(listEvalCaseResourceSummary).mock.lastCall?.slice(1, 3)).toEqual([
    "objectType",
    1,
  ]);
}, 30000);
it("moves between Case batches without losing the previous page cursor", async () => {
  const makeCase = (index: number) => ({
    id: `case-${index}`,
    title: `用例 ${index}`,
    enabled: false,
    created_at: "2026-10-29T00:00:00Z",
  });
  vi.mocked(listEvalCases).mockImplementation((_networkId, _query, cursor) =>
    Promise.resolve(
      cursor === "cursor-50"
        ? { entries: [makeCase(51)], total: 51, next_cursor: null }
        : {
            entries: Array.from({ length: 50 }, (_, index) => makeCase(index + 1)),
            total: 51,
            next_cursor: "cursor-50",
          },
    ),
  );
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const table = screen.getByRole("region", { name: "用例清单" });
  await within(table).findByText("用例 1");
  fireEvent.click(within(table).getByRole("listitem", { name: "6" }));
  await waitFor(() =>
    expect(listEvalCases).toHaveBeenCalledWith("supply_ontology_hand", "", "cursor-50", undefined),
  );
  expect(await within(table).findByText("用例 51")).toBeTruthy();
  expect(within(table).getByText("共 51 条")).toBeTruthy();
  fireEvent.click(within(table).getByRole("listitem", { name: /Previous Page|上一页/i }));
  expect(await within(table).findByText("用例 41")).toBeTruthy();
  expect(within(table).getByText("共 51 条")).toBeTruthy();
}, 90000);
it("jumps across cursor batches when a distant page number is selected", async () => {
  const makeCase = (index: number) => ({
    id: `case-${index}`,
    title: `用例 ${index}`,
    enabled: false,
    created_at: "2026-10-29T00:00:00Z",
  });
  vi.mocked(listEvalCases).mockImplementation((_networkId, _query, cursor) =>
    Promise.resolve(
      cursor === "cursor-100"
        ? { entries: [makeCase(101)], total: 101, next_cursor: null }
        : cursor === "cursor-50"
          ? {
              entries: Array.from({ length: 50 }, (_, index) => makeCase(index + 51)),
              total: 101,
              next_cursor: "cursor-100",
            }
          : {
              entries: Array.from({ length: 50 }, (_, index) => makeCase(index + 1)),
              total: 101,
              next_cursor: "cursor-50",
            },
    ),
  );
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const table = screen.getByRole("region", { name: "用例清单" });
  await within(table).findByText("用例 1");
  fireEvent.click(within(table).getByRole("listitem", { name: "11" }));
  expect(await within(table).findByText("用例 101")).toBeTruthy();
  expect(listEvalCases).toHaveBeenCalledWith("supply_ontology_hand", "", "cursor-50", undefined);
  expect(listEvalCases).toHaveBeenCalledWith("supply_ontology_hand", "", "cursor-100", undefined);
  fireEvent.click(within(table).getByRole("listitem", { name: "1" }));
  expect(await within(table).findByText("用例 1")).toBeTruthy();
}, 90000);
it("filters disabled Cases on the server while preserving the network Case total", async () => {
  vi.mocked(listEvalCases).mockImplementation((_networkId, _query, _cursor, status) =>
    Promise.resolve({
      entries: [],
      total: status === "disabled" ? 43 : 44,
      next_cursor: null,
    }),
  );
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const manager = within(screen.getByTestId("eval-case-manager"));
  expect(screen.getByText("测试集管理").closest('[role="tab"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(await manager.findByText(/^用例库（44）/)).toBeTruthy();
  fireEvent.mouseDown(manager.getByText("全部状态"));
  fireEvent.click(
    await screen.findByText("未启用", { selector: ".ant-select-item-option-content" }),
  );
  await waitFor(() =>
    expect(listEvalCases).toHaveBeenCalledWith("supply_ontology_hand", "", undefined, "disabled"),
  );
  expect(await manager.findByText("共 43 条")).toBeTruthy();
  expect(manager.getByText(/^用例库（44）/)).toBeTruthy();
  expect(screen.getByText("测试集管理").closest('[role="tab"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
it("keeps the total Case count when a search narrows the list", async () => {
  const firstPage = await vi.mocked(listEvalCases)("supply_ontology_hand", "", undefined);
  vi.mocked(listEvalCases).mockImplementation((_networkId, query) =>
    Promise.resolve({
      ...firstPage,
      total: query ? 1 : 44,
    }),
  );
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  await waitFor(() => expect(listEvalCases).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("tab", { name: "测试集管理" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: /^测试集（0）/ })).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("搜索用例、资源名称或 ID"), {
    target: { value: "标准交期" },
  });
  await waitFor(() => expect(screen.getByText("共 1 条")).toBeTruthy());
  expect(screen.getByRole("tab", { name: "测试集管理" })).toBeTruthy();
});
it("searches resources across all Case pages through the catalogue API", async () => {
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  await screen.findByText("F-07 外购物料标准采购交期");
  expect(screen.queryByPlaceholderText("搜索资源名称或 ID")).toBeNull();
  fireEvent.change(screen.getByPlaceholderText("搜索用例、资源名称或 ID"), {
    target: { value: "标准交期" },
  });
  await waitFor(() =>
    expect(listEvalCases).toHaveBeenCalledWith(
      "supply_ontology_hand",
      "标准交期",
      undefined,
      undefined,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "close-circle" }));
  expect(screen.getByPlaceholderText("搜索用例、资源名称或 ID")).toHaveProperty("value", "");
  await waitFor(() =>
    expect(vi.mocked(listEvalCases).mock.lastCall).toEqual([
      "supply_ontology_hand",
      "",
      undefined,
      undefined,
    ]),
  );
});
it("combines resource, status and keyword filters without clearing the other side", async () => {
  vi.mocked(listEvalCaseResourceSummary).mockResolvedValue({
    entries: [{ name: "物料", kinds: ["objectType"], case_count: 1 }],
    total: 1,
    case_total: 50,
    page: 1,
    limit: 10,
  });
  const entries = [
    {
      id: "case-material",
      title: "物料唯一性",
      enabled: true,
      execution_spec: {
        target: { name: "物料", capability_type: "object_type", resource_id: "material" },
      },
      created_at: "2026-10-29T00:00:00Z",
    },
  ];
  vi.mocked(listEvalCases).mockImplementation((_networkId, search, _cursor, status, resource) =>
    Promise.resolve({
      entries,
      total: search || status || resource?.name || resource?.type ? 1 : 50,
      next_cursor: null,
    }),
  );
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  fireEvent.click(await within(navigation).findByRole("button", { name: /物料1/ }));
  fireEvent.mouseDown(screen.getByText("全部状态"));
  fireEvent.click(
    await screen.findByText("已启用", { selector: ".ant-select-item-option-content" }),
  );
  fireEvent.change(screen.getByPlaceholderText("搜索用例、资源名称或 ID"), {
    target: { value: "唯一性" },
  });
  await waitFor(() =>
    expect(vi.mocked(listEvalCases).mock.lastCall).toEqual([
      "supply_ontology_hand",
      "唯一性",
      undefined,
      "enabled",
      { name: "物料", type: undefined },
    ]),
  );
  expect(screen.getByRole("tab", { name: /^用例库（50）/ })).toBeTruthy();
  fireEvent.click(within(navigation).getByRole("button", { name: "全部资源" }));
  await waitFor(() =>
    expect(vi.mocked(listEvalCases).mock.lastCall).toEqual([
      "supply_ontology_hand",
      "唯一性",
      undefined,
      "enabled",
    ]),
  );
});
it("shows the latest Case attempt state without inferring a verdict from another Run", async () => {
  const page = await vi.mocked(listEvalCases)("kn-1");
  vi.mocked(listEvalCases).mockResolvedValue({
    ...page,
    entries: page.entries.map((entry) => ({
      ...entry,
      latest_result: {
        status: "cancelled",
        run_id: "cancelled-run",
        case_run_id: "cancelled-case-run",
        execution_status: "cancelled",
        quality_outcome: "inconclusive",
        assessment_scope: "runtime",
      },
    })),
  });
  vi.mocked(listM0Runs).mockResolvedValue([
    {
      id: "completed-run",
      scope: { kind: "cases", case_ids: ["supply-f07-leadtime"] },
      execution_status: "completed",
      phase: null,
      quality_outcome: "pass",
      progress: { planned_cases: 1, completed_cases: 1 },
    },
  ]);
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const row = (await screen.findByText("F-07 外购物料标准采购交期")).closest("tr")!;
  expect(within(row).getByRole("button", { name: "已取消" })).toBeTruthy();
  expect(within(row).queryByText("通过", { exact: true })).toBeNull();
  expect(within(row).queryByText("无法判定", { exact: true })).toBeNull();
  expect(listM0Runs).not.toHaveBeenCalled();
});
it("shows cancellation as a Run state instead of a business quality conclusion", async () => {
  vi.mocked(listM0Runs).mockResolvedValue([
    {
      id: "cancelled-run",
      execution_status: "cancelled",
      phase: null,
      quality_outcome: "inconclusive",
      progress: { planned_cases: 1, completed_cases: 0 },
    },
  ]);
  render(
    <EvalWorkspaceScene
      networkId="supply_ontology_hand"
      activeTab="overview"
      onTabChange={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "用例与运行" }));
  const summary = screen.getByTestId("eval-recent-runs");
  expect(await within(summary).findByText("已取消", { exact: true })).toBeTruthy();
  const row = summary.querySelector<HTMLTableRowElement>('tr[data-row-key="cancelled-run"]');
  expect(row).not.toBeNull();
  expect(within(row!).queryByText("无法判定", { exact: true })).toBeNull();
});
it("identifies recent Runs by test suite and time without displaying identifiers", async () => {
  const runId = "01a187dd-c7bc-748a-b09a-823a5a10a59a";
  vi.mocked(listM0Runs).mockResolvedValue([
    {
      id: runId,
      suite_name: "标准交期",
      scope: { kind: "suite", suite_id: "supply-m0-leadtime", version: 1 },
      created_at: "2026-10-29T10:00:00Z",
      execution_status: "cancelled",
      phase: null,
      quality_outcome: "inconclusive",
      progress: { planned_cases: 1, completed_cases: 0 },
    },
  ]);
  render(
    <EvalWorkspaceScene
      networkId="supply_ontology_hand"
      activeTab="overview"
      onTabChange={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "用例与运行" }));
  const recentRuns = screen.getByTestId("eval-recent-runs");
  const runButton = (
    await within(recentRuns).findByText("标准交期", { selector: "strong" })
  ).closest("button")!;
  const table = runButton.closest("table");
  expect(table).not.toBeNull();
  expect(within(table!).getByText("标准交期")).toBeTruthy();
  expect(within(table!).getByText(/2026\/10\/29/)).toBeTruthy();
  expect(runButton.getAttribute("title")).toBeNull();
  expect(within(table!).queryByText(/#5a10a59a/)).toBeNull();
  expect(within(table!).queryByText(runId)).toBeNull();
  const row = table!.querySelector<HTMLTableRowElement>(`tr[data-row-key="${runId}"]`);
  expect(row).not.toBeNull();
  expect(within(row!).queryByText("无法判定")).toBeNull();
});
it("does not describe a cancelled Run as a quality failure in history", async () => {
  const cancelled = {
    id: "cancelled-run",
    execution_status: "cancelled" as const,
    phase: null,
    quality_outcome: "inconclusive" as const,
    progress: { planned_cases: 1, completed_cases: 0 },
  };
  vi.mocked(listM0Runs).mockResolvedValue([cancelled]);
  vi.mocked(searchM0Runs).mockResolvedValue({ entries: [cancelled], total: 1, page: 1, limit: 20 });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="runs" onTabChange={vi.fn()} />,
  );
  const history = screen.getByRole("complementary", { name: "运行记录" });
  await waitFor(() => expect(searchM0Runs).toHaveBeenCalled());
  expect(within(history).getByText("共 1 条")).toBeTruthy();
  const row = await waitFor(() =>
    history.querySelector<HTMLTableRowElement>('tr[data-row-key="cancelled-run"]'),
  );
  expect(row).not.toBeNull();
  expect(within(row!).getAllByRole("cell")[3]).toHaveTextContent("—");
  expect(within(row!).queryByText("无法判定", { exact: true })).toBeNull();
});
it("filters the run table and opens a full run page while preserving the list", async () => {
  const run = {
    id: "run-one",
    suite_name: "标准交期",
    scope: { kind: "suite", suite_id: "supply-m0-leadtime", version: 1 },
    execution_status: "completed" as const,
    phase: null,
    quality_outcome: "pass" as const,
    result_revision: 1,
    progress: { planned_cases: 1, completed_cases: 1 },
  };
  vi.mocked(searchM0Runs).mockResolvedValue({ entries: [run], total: 1, page: 1, limit: 20 });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="runs" onTabChange={vi.fn()} />,
  );
  const history = screen.getByRole("complementary", { name: "运行记录" });
  await waitFor(() => expect(searchM0Runs).toHaveBeenCalled());
  expect(screen.queryByRole("region", { name: "运行详情与结果" })).toBeNull();
  fireEvent.click(await within(history).findByRole("button", { name: /标准交期/ }));
  const detailDialog = screen.getByRole("region", { name: "运行详情与结果" });
  expect(detailDialog).toBeTruthy();
  const assistantButton = screen.getByRole("button", { name: "AI 助手" });
  expect(assistantButton.closest(".ant-tabs-nav")).toBeTruthy();
  expect(detailDialog).not.toContainElement(assistantButton);
  expect(screen.getAllByRole("button", { name: "AI 助手" })).toHaveLength(1);
  expect(await screen.findByText("Multi Run panel · run-one")).toBeTruthy();
  fireEvent.click(within(detailDialog).getByRole("button", { name: "历史对比" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("region", { name: "运行详情与结果" })).toBeTruthy();
  expect(screen.getByText("Comparison panel")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回运行详情" }));
  expect(screen.getByRole("region", { name: "运行详情与结果" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回" }));
  expect(screen.queryByRole("region", { name: "运行详情与结果" })).toBeNull();
  expect(screen.queryByRole("button", { name: "发起运行" })).toBeNull();
  expect(screen.queryByRole("region", { name: "运行详情与结果" })).toBeNull();
  fireEvent.change(screen.getByPlaceholderText("搜索测试集或运行 ID"), {
    target: { value: "run-one" },
  });
  await waitFor(() =>
    expect(searchM0Runs).toHaveBeenCalledWith("supply_ontology_hand", {
      q: "run-one",
      status: undefined,
      outcome: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      limit: 20,
    }),
  );
}, 30000);
it("filters runs by the selected local dates and clears both dates", async () => {
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="runs" onTabChange={vi.fn()} />,
  );
  await waitFor(() => expect(searchM0Runs).toHaveBeenCalled());
  fireEvent.focus(screen.getByPlaceholderText("开始日期"));
  fireEvent.change(screen.getByPlaceholderText("开始日期"), {
    target: { value: "2026-10-28" },
  });
  fireEvent.keyDown(screen.getByPlaceholderText("开始日期"), { key: "Enter", code: "Enter" });
  fireEvent.focus(screen.getByPlaceholderText("结束日期"));
  fireEvent.change(screen.getByPlaceholderText("结束日期"), {
    target: { value: "2026-10-29" },
  });
  fireEvent.keyDown(screen.getByPlaceholderText("结束日期"), { key: "Enter", code: "Enter" });
  const nextDay = new Date("2026-10-29T00:00:00");
  nextDay.setDate(nextDay.getDate() + 1);
  await waitFor(() =>
    expect(searchM0Runs).toHaveBeenCalledWith("supply_ontology_hand", {
      q: undefined,
      status: undefined,
      outcome: undefined,
      from: new Date("2026-10-28T00:00:00").toISOString(),
      to: nextDay.toISOString(),
      page: 1,
      limit: 20,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  expect(screen.getByPlaceholderText("开始日期")).toHaveProperty("value", "");
  expect(screen.getByPlaceholderText("结束日期")).toHaveProperty("value", "");
});
const statsRun: M0Run = {
  id: "stats-run",
  scope: { kind: "cases", suite_id: "", version: 1 },
  execution_status: "completed",
  phase: null,
  quality_outcome: "fail",
  progress: { planned_cases: 25, completed_cases: 25 },
  case_counts: {
    total: 25,
    passed: 20,
    failed: 2,
    inconclusive: 1,
    review_required: 1,
    execution_failed: 1,
    cancelled: 0,
    pending: 0,
  },
};
const recentStatsRun: M0Run = {
  ...statsRun,
  id: "recent-stats-run",
  suite_name: "跨页对齐测试集",
  scope: { kind: "suite", suite_id: "comparison-suite", version: 1 },
  created_at: "2026-11-05T07:14:00Z",
  assessment_scope: "mixed",
  external_agent: { name: "Codex", model: "model-x" },
  trigger_type: "plan_manual",
  case_counts: {
    ...statsRun.case_counts!,
    runtime: { ...statsRun.case_counts!, total: 20, passed: 15 },
  },
};
it("aligns recent Runs with history columns, metadata and runtime-only statistics", async () => {
  const recentRuns = Array.from({ length: 6 }, (_, index) => ({
    ...recentStatsRun,
    id: index === 0 ? recentStatsRun.id : `recent-${index}`,
    suite_name: index === 5 ? "第六条运行" : `${recentStatsRun.suite_name}${index || ""}`,
  }));
  vi.mocked(listM0Runs).mockResolvedValue(recentRuns);
  vi.mocked(searchM0Runs).mockResolvedValue({
    entries: [recentStatsRun],
    total: 1,
    page: 1,
    limit: 20,
  });
  const onTabChange = vi.fn();
  const { rerender } = render(
    <EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={onTabChange} />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "用例与运行" }));
  const recent = screen.getByTestId("eval-recent-runs");
  expect(await within(recent).findAllByText("75%")).toHaveLength(5);
  const headings = within(recent)
    .getAllByRole("columnheader")
    .map((cell) => cell.textContent);
  expect(headings).toEqual([
    "测试集",
    "发起时间",
    "执行状态",
    "评测结果",
    "用例总数",
    "运行通过率",
    "通过",
    "未通过",
    "无法判定",
  ]);
  expect(within(recent).getAllByRole("row")).toHaveLength(6);
  expect(within(recent).queryByText("第六条运行")).toBeNull();
  const row = recent.querySelector<HTMLTableRowElement>('tr[data-row-key="recent-stats-run"]')!;
  const recentCells = within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
  expect(recentCells[0]).toContain("Codex · model-x");
  expect(recentCells[0]).toContain("运行计划 · 立即运行");
  expect(recentCells[4]).toBe("25");
  expect(recentCells[5]).toBe("75%");
  expect(recentCells.slice(6)).toEqual(["15", "2", "1"]);
  expect(within(row).queryByText("recent-stats-run")).toBeNull();
  expect(within(row).getByText("已完成").className).toContain("ant-tag");
  rerender(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={onTabChange} />);
  const history = await screen.findByRole("complementary", { name: "运行记录" });
  await within(history).findByText("75%");
  expect(
    within(history)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(headings);
  const historyRow = history.querySelector<HTMLTableRowElement>(
    'tr[data-row-key="recent-stats-run"]',
  )!;
  expect(
    within(historyRow)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(recentCells);
}, 30000);
it.each([
  ["通过", "15", "pass"],
  ["未通过", "2", "fail"],
  ["无法判定", "1", "inconclusive"],
])("opens %s cases directly from recent Runs", async (label, count, outcome) => {
  vi.mocked(listM0Runs).mockResolvedValue([recentStatsRun]);
  vi.mocked(searchM0Runs).mockResolvedValue({
    entries: [recentStatsRun],
    total: 1,
    page: 1,
    limit: 20,
  });
  const onTabChange = vi.fn();
  const { rerender } = render(
    <EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={onTabChange} />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "用例与运行" }));
  const recent = screen.getByTestId("eval-recent-runs");
  fireEvent.click(
    await within(recent).findByRole("button", { name: `查看${label}用例：${count} 条` }),
  );
  expect(routerMocks.navigate).toHaveBeenCalledWith(
    expect.objectContaining({
      search: expect.stringContaining("run_id=recent-stats-run") as unknown,
    }),
    expect.anything(),
  );
  rerender(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={onTabChange} />);
  expect(await screen.findByText("Multi Run panel · recent-stats-run")).toBeTruthy();
  expect(screen.getByTestId("case-outcome-filter")).toHaveTextContent(outcome);
});
it("keeps recent declaration-only and missing statistics honest", async () => {
  vi.mocked(listM0Runs).mockResolvedValue([
    {
      ...statsRun,
      id: "declaration-run",
      assessment_scope: "declaration",
      quality_outcome: "pass",
      case_counts: {
        ...statsRun.case_counts!,
        runtime: { ...statsRun.case_counts!, total: 0, passed: 0, failed: 0, inconclusive: 0 },
      },
    },
    { ...statsRun, id: "unknown-run", case_counts: undefined },
  ]);
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole("tab", { name: "用例与运行" }));
  const recent = screen.getByTestId("eval-recent-runs");
  expect(await within(recent).findByText("不适用")).toBeTruthy();
  expect(within(recent).getByText("声明检查通过")).toBeTruthy();
  const unknown = recent.querySelector<HTMLTableRowElement>('tr[data-row-key="unknown-run"]')!;
  expect(
    within(unknown)
      .getAllByRole("cell")
      .slice(4)
      .map((cell) => cell.textContent),
  ).toEqual(["—", "—", "—", "—", "—"]);
});
it("shows whole run counts and opens failures directly without a problem workspace", async () => {
  vi.mocked(searchM0Runs).mockResolvedValue({ entries: [statsRun], total: 1, page: 1, limit: 20 });
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);
  expect(await screen.findByText("80%")).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "用例总数" })).toBeTruthy();
  expect(screen.queryByRole("columnheader", { name: "运行 ID" })).toBeNull();
  expect(screen.queryByRole("tab", { name: /^问题记录/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "查看未通过用例：2 条" }));
  expect(await screen.findByText("Multi Run panel · stats-run")).toBeTruthy();
  expect(screen.getByTestId("case-outcome-filter")).toHaveTextContent("fail");
  fireEvent.click(screen.getByRole("button", { name: "返回" }));
  fireEvent.click(screen.getByRole("button", { name: "查看无法判定用例：1 条" }));
  expect(await screen.findByTestId("case-outcome-filter")).toHaveTextContent("inconclusive");
}, 30000);
it("keeps a pending run rate below 100 percent and leaves missing counts unknown", async () => {
  const running: M0Run = {
    ...statsRun,
    id: "running-run",
    execution_status: "running",
    quality_outcome: null,
    case_counts: {
      ...statsRun.case_counts!,
      total: 25,
      passed: 1,
      failed: 0,
      inconclusive: 0,
      review_required: 0,
      execution_failed: 0,
      pending: 24,
    },
  };
  vi.mocked(searchM0Runs).mockResolvedValue({
    entries: [running, { ...statsRun, id: "old-run", case_counts: undefined }],
    total: 2,
    page: 1,
    limit: 20,
  });
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);
  expect(await screen.findByText("4%")).toBeTruthy();
  expect(screen.queryByText("100%")).toBeNull();
  expect(screen.queryByText("0%")).toBeNull();
});
it("previews the selected failed Case before creating a separate rerun", async () => {
  vi.mocked(searchM0Runs).mockResolvedValue({ entries: [statsRun], total: 1, page: 1, limit: 20 });
  vi.mocked(getM1RunCapabilities).mockResolvedValue(true);
  vi.mocked(previewM1RunSelection).mockResolvedValue({
    case_count: 1,
    eligible: true,
    execution_mode: "platform",
    reasons: [],
  });
  vi.mocked(createM1Run).mockResolvedValue({
    ...statsRun,
    id: "new-run",
    execution_status: "queued",
    case_counts: undefined,
  });
  const onTabChange = vi.fn();
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={onTabChange} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "查看未通过用例：2 条" }, { timeout: 10000 }),
  );
  const confirmSpy = vi
    .spyOn(Modal, "confirm")
    .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  fireEvent.click(await screen.findByRole("button", { name: "重新运行" }));
  await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
  await (confirmSpy.mock.calls[0][0].onOk as () => Promise<void>)();
  expect(createM1Run).toHaveBeenCalledWith(
    "kn-1",
    { kind: "cases", case_ids: ["case-1"] },
    expect.any(String),
  );
  expect(await screen.findByText("Multi Run panel · new-run")).toBeTruthy();
  expect(screen.getByTestId("case-outcome-filter")).toHaveTextContent("all");
  confirmSpy.mockRestore();
}, 30000);
it("does not show the F-07 result or an execution binding on an imported draft", async () => {
  const firstPage = await vi.mocked(listEvalCases)("supply_ontology_hand", "", undefined);
  vi.mocked(listEvalCases).mockResolvedValue({
    ...firstPage,
    entries: [
      ...firstPage.entries,
      {
        id: "supply-v3-m-01",
        title: "M-01 产品有多少种？",
        enabled: false,
        execution_setup: "review_required",
        input_spec: { question: "产品有多少种？", arguments: {} },
        execution_spec: { runner: "unbound" },
        created_at: "2026-10-29T00:00:00Z",
      },
    ],
    total: 2,
  });
  vi.mocked(listM0Runs).mockResolvedValue([
    {
      id: "run-1",
      execution_status: "completed",
      phase: null,
      quality_outcome: "pass",
      progress: { planned_cases: 1, completed_cases: 1 },
    },
  ]);
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const draftRow = (await screen.findByText("M-01 产品有多少种？")).closest("tr");
  expect(draftRow).not.toBeNull();
  expect(within(draftRow!).getByText("未启用")).toBeTruthy();
  expect(within(draftRow!).getAllByText("未指定单一资源")).toHaveLength(1);
  expect(screen.getAllByTitle("未指定单一资源")).toHaveLength(1);
  fireEvent.mouseDown(screen.getByLabelText("按资源类型定位", { selector: '[role="combobox"]' }));
  expect(
    screen.queryByText("未指定单一资源", { selector: ".ant-select-item-option-content" }),
  ).toBeNull();
  expect(within(draftRow!).queryByText("pass")).toBeNull();
});
it("shows the actual resources for single-resource and multi-resource drafts", async () => {
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "supply-v3-m-01",
        title: "M-01 产品总数",
        enabled: false,
        execution_setup: "review_required",
        execution_spec: {
          runner: "unbound",
          binding_status: "resolved",
          target: { name: "产品总数", capability_type: "metric", resource_id: "metric-1" },
        },
        created_at: "2026-10-29T00:00:00Z",
      },
      {
        id: "supply-v3-m-11",
        title: "M-11 预测需求",
        enabled: false,
        execution_setup: "review_required",
        execution_spec: {
          runner: "unbound",
          binding_status: "resolved",
          target_kind: "business_scenario",
          target: {
            name: "未关闭预测单数",
            capability_type: "function",
            resource_id: "function-1",
          },
          related_targets: [
            { name: "预测需求量合计", capability_type: "metric", resource_id: "metric-2" },
          ],
        },
        created_at: "2026-10-29T00:00:00Z",
      },
    ],
    total: 2,
    next_cursor: null,
  });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const metricRow = (await screen.findByText("M-01 产品总数")).closest("tr");
  const scenarioRow = (await screen.findByText("M-11 预测需求")).closest("tr");
  expect(within(metricRow!).getByText("产品总数")).toBeTruthy();
  expect(within(metricRow!).getByText("对象指标")).toBeTruthy();
  expect(within(scenarioRow!).queryByText(/未关闭预测单数|预测需求量合计/)).toBeNull();
  expect(within(scenarioRow!).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  expect(within(scenarioRow!).getByText("未启用")).toBeTruthy();
  expect(screen.queryByTitle("未指定单一资源")).toBeNull();
  fireEvent.click(screen.getByText("M-11 预测需求"));
  const detail = await screen.findByRole("dialog");
  expect(await within(detail).findByText("运行条件未满足")).toBeTruthy();
  expect(within(detail).getByText("业务场景（不绑定单一对象）")).toBeTruthy();
  expect(within(detail).getByText("执行依赖")).toBeTruthy();
  expect(within(detail).getByText(/^未关闭预测单数 · 函数$/)).toBeTruthy();
  expect(within(detail).getByText(/^预测需求量合计 · 对象指标$/)).toBeTruthy();
});
it("opens the network template rules in the Eval template tab", async () => {
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="plan" onTabChange={vi.fn()} />,
  );
  expect(await screen.findByTestId("eval-template-panel")).toBeTruthy();
  expect(screen.getByRole("navigation")).toBeTruthy();
  expect(await screen.findByText("对象定义完整性")).toBeTruthy();
  expect(getEvalTemplateConfig).toHaveBeenCalledWith("supply_ontology_hand");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "实例可查询性" },
  });
  expect(screen.getByText("实例可查询性")).toBeTruthy();
  expect(screen.queryByText("对象定义完整性")).toBeNull();
  expect(screen.queryByText(/尚未接入|真实数据 · M0/)).toBeNull();
});
it("shows template editing only when template management is enabled", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({
    case_management: true,
    template_management: true,
  });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="plan" onTabChange={vi.fn()} />,
  );
  await waitFor(() => expect(getEvalCapabilities).toHaveBeenCalledWith("supply_ontology_hand"));
  expect(await screen.findByRole("button", { name: /新\s*建/ })).toBeTruthy();
});
it("does not infer template management from Case management", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="plan" onTabChange={vi.fn()} />,
  );
  expect(await screen.findByTestId("eval-template-panel")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /新\s*建/ })).toBeNull();
});
it("does not fall back to front-end rules when the service fails", async () => {
  vi.mocked(getEvalTemplateConfig).mockRejectedValue(new Error("service unavailable"));
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="plan" onTabChange={vi.fn()} />,
  );
  expect(await screen.findByText(/无法读取评测规则/)).toBeTruthy();
  expect(screen.queryByText("对象定义完整性")).toBeNull();
});
it("loads Run plan count before opening its lazily loaded details", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: false, run_plans: true });
  let resolveCount!: (count: number) => void;
  vi.mocked(getEvalRunPlanCount).mockReturnValue(
    new Promise((resolve) => {
      resolveCount = resolve;
    }),
  );
  await act(() => {
    render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(getEvalRunPlanCount).toHaveBeenCalledWith("kn-1", expect.any(AbortSignal)),
  );
  expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（加载中）");
  expect(listEvalRunPlans).not.toHaveBeenCalled();
  await act(() => Promise.resolve(resolveCount(7)));
  expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（7）");
  expect(listEvalRunPlans).not.toHaveBeenCalled();
  vi.mocked(listEvalRunPlans).mockResolvedValue({
    entries: [],
    total: 0,
    total_all: 8,
    page: 1,
    limit: 20,
  });
  await act(() => {
    fireEvent.click(screen.getByRole("tab", { name: /^运行计划/ }));

    return Promise.resolve();
  });
  await waitFor(() => expect(listEvalRunPlans).toHaveBeenCalled());
  expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（8）");
});
it("distinguishes Run plan count errors from zero and retries without opening details", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: false, run_plans: true });
  vi.mocked(getEvalRunPlanCount)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(0);
  await act(() => {
    render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent(
      "运行计划（读取失败）",
    ),
  );
  expect(screen.queryByRole("tab", { name: "运行计划（0）" })).toBeNull();
  await act(() => {
    fireEvent.click(screen.getByRole("button", { name: "重试读取运行计划总数" }));

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（0）"),
  );
  expect(listEvalRunPlans).not.toHaveBeenCalled();
});
it("retries a failed Run plan capability read instead of treating it as no plans", async () => {
  vi.mocked(getEvalCapabilities)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ case_management: false, run_plans: true });
  vi.mocked(getEvalRunPlanCount).mockResolvedValue(3);
  await act(() => {
    render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);

    return Promise.resolve();
  });
  const retry = await screen.findByRole("button", { name: "重试读取运行计划总数" });
  expect(getEvalRunPlanCount).not.toHaveBeenCalled();
  await act(() => {
    fireEvent.click(retry);

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（3）"),
  );
  expect(listEvalRunPlans).not.toHaveBeenCalled();
});
it("ignores stale Run plan counts after changing networks and does not load counts outside runs", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: false, run_plans: true });
  let resolveOldCount!: (count: number) => void;
  vi.mocked(getEvalRunPlanCount).mockImplementation((network) =>
    network === "kn-1"
      ? new Promise((resolve) => {
          resolveOldCount = resolve;
        })
      : Promise.resolve(4),
  );
  const view = render(
    <EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={vi.fn()} />,
  );
  await waitFor(() => expect(getEvalCapabilities).toHaveBeenCalled());
  expect(getEvalRunPlanCount).not.toHaveBeenCalled();
  await act(() => {
    view.rerender(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(getEvalRunPlanCount).toHaveBeenCalledWith("kn-1", expect.any(AbortSignal)),
  );
  const signal = vi.mocked(getEvalRunPlanCount).mock.calls[0][1];
  await act(() => {
    view.rerender(<EvalWorkspaceScene networkId="kn-2" activeTab="runs" onTabChange={vi.fn()} />);

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（4）"),
  );
  expect(signal?.aborted).toBe(true);
  await act(() => Promise.resolve(resolveOldCount(99)));
  expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（4）");
  expect(listEvalRunPlans).not.toHaveBeenCalled();
});
it("keeps a newer Run plan detail count when the initial count request finishes late", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: false, run_plans: true });
  let resolveCount!: (count: number) => void;
  vi.mocked(getEvalRunPlanCount).mockReturnValue(
    new Promise((resolve) => {
      resolveCount = resolve;
    }),
  );
  vi.mocked(listEvalRunPlans).mockResolvedValue({ entries: [], total: 6, page: 1, limit: 20 });
  await act(() => {
    render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);

    return Promise.resolve();
  });
  await waitFor(() => expect(getEvalRunPlanCount).toHaveBeenCalled());
  await act(() => {
    fireEvent.click(screen.getByRole("tab", { name: /^运行计划/ }));

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（6）"),
  );
  await act(() => Promise.resolve(resolveCount(5)));
  expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（6）");
});
it("reports Run plan detail loading failure and recovers its count on retry", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: false, run_plans: true });
  vi.mocked(getEvalRunPlanCount).mockResolvedValue(2);
  vi.mocked(listEvalRunPlans)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ entries: [], total: 3, page: 1, limit: 20 });
  await act(() => {
    render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（2）"),
  );
  await act(() => {
    fireEvent.click(screen.getByRole("tab", { name: /^运行计划/ }));

    return Promise.resolve();
  });
  await screen.findByText("无法读取运行计划，请稍后重试。");
  expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（读取失败）");
  await act(() => {
    fireEvent.click(screen.getByRole("button", { name: /^重\s*试$/ }));

    return Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: /^运行计划/ })).toHaveTextContent("运行计划（3）"),
  );
});
it("groups run records and plans under one workspace", async () => {
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="runs" onTabChange={vi.fn()} />,
  );
  await act(async () => {});
  const workspace = screen.getByTestId("eval-run-workspace");
  expect(
    within(workspace)
      .getAllByRole("tab")
      .map((tab) => tab.textContent),
  ).toEqual([expect.stringMatching(/^运行记录/), expect.stringMatching(/^运行计划/)]);
  const primaryTabs = screen.getAllByRole("tablist")[0];
  expect(
    within(primaryTabs)
      .getAllByRole("tab")
      .map((tab) => tab.textContent),
  ).toEqual(["概览", "模板管理", expect.stringMatching(/^测试集管理/), "运行与诊断"]);
  expect(within(workspace).getByRole("complementary", { name: "运行记录" })).toBeTruthy();
  expect(within(workspace).queryByRole("region", { name: "运行计划" })).toBeNull();
  await waitFor(() =>
    expect(within(workspace).getByRole("tab", { name: /^运行计划/ })).toHaveTextContent(
      "运行计划（未启用）",
    ),
  );
  expect(within(workspace).queryByText("运行记录", { exact: true })).toBeNull();
  expect(within(workspace).queryByRole("button", { name: "发起运行" })).toBeNull();
  const refreshRuns = within(workspace).getByRole("button", { name: "刷新运行记录" });
  expect(refreshRuns.closest(".ant-tabs-nav")).toBeNull();
  expect(within(workspace).getByRole("complementary", { name: "运行记录" })).toContainElement(
    refreshRuns,
  );
  fireEvent.mouseOver(within(workspace).getByRole("img", { name: "运行记录说明" }));
  // Verify tooltip content here; jsdom's inherited-style visibility walk is
  // prohibitively expensive after Ant Design injects the tooltip styles.
  expect(await screen.findByRole("tooltip", { hidden: true })).toHaveTextContent(
    "查看测试集每次运行的执行过程与评测结果。",
  );
  fireEvent.mouseLeave(within(workspace).getByRole("img", { name: "运行记录说明" }));
  await act(() => {
    fireEvent.click(within(workspace).getByRole("tab", { name: /^运行计划/ }));

    return Promise.resolve();
  });
  expect(within(workspace).getByRole("region", { name: "运行计划" })).toBeTruthy();
  expect(within(workspace).queryByText("运行计划", { exact: true })).toBeNull();
  fireEvent.mouseOver(within(workspace).getByRole("img", { name: "运行计划说明" }));
  expect(
    await screen.findByText(
      "按设定周期自动运行已发布测试集；同一计划的上次运行未结束时将跳过本次触发。",
    ),
  ).toBeTruthy();
  expect(within(workspace).getByText("运行计划服务尚未启用")).toBeTruthy();
  const createPlan = within(workspace).getByRole("button", { name: /^新\s*建$/ });
  expect(createPlan.hasAttribute("disabled")).toBe(true);
  expect(createPlan.closest(".ant-tabs-nav")).toBeNull();
  expect(within(workspace).getByRole("region", { name: "运行计划" })).toContainElement(createPlan);
  expect(within(workspace).queryByRole("complementary", { name: "运行记录" })).toBeNull();
}, 30000);
it("keeps only run records without a separate problem workspace", () => {
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="runs" onTabChange={vi.fn()} />,
  );
  const workspace = screen.getByTestId("eval-run-workspace");
  expect(workspace).toBeTruthy();
  expect(within(workspace).getByRole("tab", { name: /^运行记录/ })).toBeTruthy();
  expect(within(workspace).getByRole("complementary", { name: "运行记录" })).toBeTruthy();
  expect(within(workspace).queryByText("运行策略")).toBeNull();
  expect(within(workspace).queryByText("关键词")).toBeNull();
  expect(within(workspace).getByRole("searchbox", { name: "搜索运行" })).toBeTruthy();
  expect(within(workspace).getByRole("columnheader", { name: "测试集" })).toBeTruthy();
  expect(within(workspace).getByRole("columnheader", { name: "发起时间" })).toBeTruthy();
  expect(within(workspace).queryByRole("columnheader", { name: "运行 ID" })).toBeNull();
  expect(within(workspace).queryByRole("columnheader", { name: "测试集 / 发起时间" })).toBeNull();
  expect(screen.queryByText("Run panel")).toBeNull();
  expect(screen.queryByRole("button", { name: "发起运行" })).toBeNull();
  expect(screen.queryByRole("tab", { name: /^问题记录/ })).toBeNull();
  expect(screen.queryByTestId("eval-diagnostics-workspace")).toBeNull();
});
it("opens Agent comparison and inspects an off-page run in the full run page", async () => {
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="runs" onTabChange={vi.fn()} />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "智能体对比" }));
  expect(screen.getByRole("region", { name: "Comparison workspace" })).toBeTruthy();
  expect(screen.queryByRole("complementary", { name: "运行记录" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Inspect comparison cell" }));
  const dialog = await screen.findByRole("region", { name: "运行详情与结果" });
  expect(within(dialog).getByText("Multi Run panel · off-page-agent-run")).toBeTruthy();
  expect(within(dialog).getByTestId("preferred-case")).toHaveTextContent("case-outside-first-page");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "返回" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to records" }));
  expect(screen.getByRole("complementary", { name: "运行记录" })).toBeTruthy();
});
const batchFixtures = [
  {
    id: "batch-draft",
    title: "批量草稿",
    enabled: false,
    source_type: "manual",
    created_at: "2026-11-04T00:00:00Z",
  },
  {
    id: "batch-disabled",
    title: "批量停用",
    enabled: false,
    source_type: "manual",
    created_at: "2026-11-04T00:00:00Z",
  },
];
function renderBatchCases() {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: batchFixtures,
    total: 2,
    next_cursor: null,
  });
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
}
it("batch enables inactive cases and retains only failed selections for retry", async () => {
  renderBatchCases();
  expect(screen.queryByRole("button", { name: "启用" })).toBeNull();
  await screen.findByText("批量草稿");
  // Keep checkbox queries within their row: a document-wide accessible-name
  // scan repeatedly resolves the complete Ant Design stylesheet in jsdom.
  const table = within(screen.getByText("批量草稿").closest("table")!);
  const checkbox = (title: string) =>
    within(table.getByText(title).closest("tr")!).getByRole("checkbox", {
      name: `选择用例：${title}`,
    });
  vi.mocked(applyEvalCaseBatch).mockResolvedValue([
    { id: "batch-draft", title: "批量草稿", success: true },
    { id: "batch-disabled", title: "批量停用", success: false, error: "forbidden" },
  ]);
  fireEvent.click(checkbox("批量草稿"));
  fireEvent.click(checkbox("批量停用"));
  expect(screen.getByRole("button", { name: "运行（2）" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "启用" }));
  await waitFor(() =>
    expect(applyEvalCaseBatch).toHaveBeenCalledWith(
      "supply_ontology_hand",
      batchFixtures,
      "enable",
    ),
  );
  await screen.findByText("启用完成：成功 1 条，失败 1 条。");
  expect(checkbox("批量草稿")).not.toBeChecked();
  expect(checkbox("批量停用")).toBeChecked();
  expect(screen.getByText(/没有操作权限/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "启用" }));
  await waitFor(() =>
    expect(applyEvalCaseBatch).toHaveBeenLastCalledWith(
      "supply_ontology_hand",
      [batchFixtures[1]],
      "enable",
    ),
  );
}, 30000);
it("batch deletion waits for confirmation and reports per-item results", async () => {
  renderBatchCases();
  expect(screen.queryByRole("button", { name: "删除" })).toBeNull();
  await screen.findByText("批量草稿");
  vi.mocked(applyEvalCaseBatch).mockResolvedValue(
    batchFixtures.map((entry) => ({ ...entry, success: true })),
  );
  fireEvent.click(
    screen.getByLabelText("选择用例：批量草稿", { selector: 'input[type="checkbox"]' }),
  );
  fireEvent.click(
    screen.getByLabelText("选择用例：批量停用", { selector: 'input[type="checkbox"]' }),
  );
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(applyEvalCaseBatch).not.toHaveBeenCalled();
  expect(confirm.mock.calls[0][0].title).toBe("确定删除选中的 2 条用例吗？");
  await (confirm.mock.calls[0][0].onOk as () => Promise<void>)();
  await waitFor(() =>
    expect(applyEvalCaseBatch).toHaveBeenCalledWith(
      "supply_ontology_hand",
      batchFixtures,
      "delete",
    ),
  );
  await screen.findByText("删除完成：成功 2 条，失败 0 条。");
  expect(screen.queryByRole("region", { name: "用例批量操作" })).toBeNull();
  confirm.mockRestore();
}, 20000);
it("explains case-library and test-set tabs without switching tabs when help is opened", async () => {
  render(
    <EvalWorkspaceScene networkId="supply_ontology_hand" activeTab="cases" onTabChange={vi.fn()} />,
  );
  const manager = screen.getByTestId("eval-case-manager");
  const library = await within(manager).findByRole("tab", { name: /^用例库/ });
  const help = within(manager).getByRole("img", { name: "测试集说明" });
  fireEvent.click(help);
  expect(library).toHaveAttribute("aria-selected", "true");
  fireEvent.focus(help);
  expect(await screen.findByRole("tooltip", { hidden: true })).toHaveTextContent(
    "按评测场景组织已启用用例，发布后用于批量运行、配置运行计划或交由外部智能体评测。",
  );
  fireEvent.blur(help);
  const libraryHelp = within(manager).getByRole("img", { name: "用例库说明" });
  fireEvent.mouseOver(libraryHelp);
  await waitFor(() =>
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "管理和复用单条评测用例，配置评测对象、测试输入及判定标准；用例可按需加入测试集。",
    ),
  );
}, 30000);
it("shows network Case totals independently of resource filters and page counts", async () => {
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={vi.fn()} />);
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  const all = within(navigation).getByRole("button", { name: "全部资源" });
  await waitFor(() => expect(all).toHaveTextContent("全部资源1"));
  expect(
    within(all).getByTitle("当前用例范围的总用例数，不随资源类型、分页或右侧筛选变化"),
  ).toBeTruthy();
  fireEvent.mouseDown(screen.getByLabelText("按资源类型定位", { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByText("函数", { selector: ".ant-select-item-option-content" }));
  await waitFor(() =>
    expect(listEvalCaseResourceSummary).toHaveBeenCalledWith(
      "kn-1",
      "function",
      1,
      10,
      expect.any(AbortSignal),
    ),
  );
  expect(all).toHaveTextContent("全部资源1");
  expect(getEvalOverview).toHaveBeenCalledTimes(1);
});
it("keeps Case totals available when the overview read fails", async () => {
  vi.mocked(getEvalOverview).mockRejectedValue(new Error("offline"));
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={vi.fn()} />);
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  await within(navigation).findByTitle("标准交期");
  expect(within(navigation).getByRole("button", { name: "全部资源" })).toHaveTextContent(
    "全部资源1",
  );
});
it("uses navigation icons from the complete resource summary without guessing from names", async () => {
  vi.mocked(listEvalCaseResourceSummary).mockResolvedValue({
    entries: [
      { name: "同名资源", kinds: ["objectType", "function"], case_count: 2 },
      { name: "业务场景", kinds: ["scenario"], case_count: 1 },
      { name: "未提供类型的资源", kinds: ["unknown"], case_count: 1 },
    ],
    total: 3,
    case_total: 4,
    page: 1,
    limit: 10,
  });
  const definitions = [
    {
      id: "object",
      execution_spec: { target: { name: "同名资源", capability_type: "object_type" } },
    },
    {
      id: "function",
      execution_spec: {
        target: { name: "同名资源", capability_type: "function" },
        related_targets: [{ name: "同名资源", capability_type: "objectType" }],
      },
    },
    {
      id: "scenario",
      execution_spec: {
        target_kind: "business_scenario" as const,
        target: { name: "场景依赖指标", capability_type: "metric" },
      },
    },
    { id: "unknown", execution_spec: { target: { name: "未提供类型的资源" } } },
  ];
  const entries = definitions.map((entry) => ({
    ...entry,
    title: `用例 ${entry.id}`,
    enabled: false,
    created_at: "2026-10-29T00:00:00Z",
  }));
  vi.mocked(listEvalCases).mockResolvedValue({ entries, total: 4, next_cursor: null });
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={vi.fn()} />);
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  const sameName = await within(navigation).findByRole("button", { name: /同名资源/ });
  expect(sameName).toHaveAccessibleDescription("对象类、函数");
  expect(sameName.querySelectorAll(".anticon")).toHaveLength(2);
  expect(sameName.querySelector(".anticon-database")).not.toBeNull();
  expect(sameName.querySelector(".anticon-code")).not.toBeNull();
  expect(within(sameName).getByText("2")).toBeTruthy();
  const scenario = within(navigation).getByRole("button", { name: /业务场景/ });
  expect(scenario.querySelector(".anticon-deployment-unit")).not.toBeNull();
  expect(scenario.querySelector(".anticon-line-chart")).toBeNull();
  expect(within(navigation).queryByTitle("场景依赖指标")).toBeNull();
  const unknown = within(navigation).getByRole("button", { name: /未提供类型的资源/ });
  expect(unknown).toHaveAccessibleDescription("资源");
  expect(unknown.querySelector(".anticon-file-unknown")).not.toBeNull();
  expect(
    within(navigation).getByRole("button", { name: "全部资源" }).querySelector(".anticon-appstore"),
  ).not.toBeNull();
  fireEvent.click(sameName);
  await waitFor(() =>
    expect(listEvalCases).toHaveBeenCalledWith("kn-1", "", undefined, undefined, {
      name: "同名资源",
      type: undefined,
    }),
  );
}, 30000);
it.each([
  ["function", "函数", "qa_echo_tool"],
  ["api", "API", "qa_get_post"],
  ["mcp", "MCP", "tool_add"],
])(
  "finds %s resources beyond the initial 50 Cases and preserves the library total",
  async (type, label, name) => {
    const firstBatch = Array.from({ length: 50 }, (_, index) => ({
      id: `object-${index}`,
      title: `物料用例 ${index}`,
      enabled: true,
      created_at: "2026-11-01T00:00:00Z",
      execution_spec: { target: { name: "物料", capability_type: "objectType" } },
    }));
    const lateCase = {
      ...firstBatch[0],
      id: "late-case",
      title: `远端资源 ${name}`,
      execution_spec: { target: { name, capability_type: type } },
    };
    vi.mocked(listEvalCases).mockImplementation((_kn, _q, _cursor, _status, filter) =>
      Promise.resolve({
        entries: filter?.type ? [lateCase] : firstBatch,
        total: filter?.type ? 1 : 63,
        next_cursor: filter?.type ? null : "cursor-50",
      }),
    );
    vi.mocked(listEvalCaseResourceSummary).mockImplementation((_kn, kind, page, limit = 10) =>
      Promise.resolve({
        entries: kind
          ? [{ name, kinds: [type], case_count: 1 }]
          : [{ name: "物料", kinds: ["objectType"], case_count: 50 }],
        total: 1,
        case_total: 63,
        page,
        limit,
      }),
    );
    render(<EvalWorkspaceScene networkId="kn-63" activeTab="cases" onTabChange={vi.fn()} />);
    await screen.findByRole("tab", { name: /^用例库（63）/ });
    fireEvent.mouseDown(screen.getByLabelText("按资源类型定位", { selector: '[role="combobox"]' }));
    fireEvent.click(
      await screen.findByText(label, { selector: ".ant-select-item-option-content" }),
    );
    const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
    const resource = await within(navigation).findByTitle(name);
    expect(within(resource).getByText("1")).toBeTruthy();
    fireEvent.click(resource);
    await waitFor(() =>
      expect(listEvalCases).toHaveBeenLastCalledWith("kn-63", "", undefined, undefined, {
        name,
        type,
      }),
    );
    expect(await screen.findByText(`远端资源 ${name}`)).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^用例库（63）/ })).toBeTruthy();
    expect(listEvalCaseResourceSummary).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listEvalCases).mock.calls.every((call) => !call[2])).toBe(true);
  },
);
it("shows resource load failures and retries without using partial Case rows", async () => {
  vi.mocked(listEvalCaseResourceSummary).mockRejectedValueOnce(new Error("offline"));
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={vi.fn()} />);
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  expect(await within(navigation).findByRole("alert")).toHaveTextContent("无法读取资源列表");
  expect(within(navigation).queryByTitle("标准交期")).toBeNull();
  fireEvent.click(within(navigation).getByRole("button", { name: "重试" }));
  expect(await within(navigation).findByTitle("标准交期")).toBeTruthy();
  expect(listEvalCaseResourceSummary).toHaveBeenCalledTimes(2);
});
it("ignores an obsolete resource summary when the selected type changes", async () => {
  let resolveOld!: (value: Awaited<ReturnType<typeof listEvalCaseResourceSummary>>) => void;
  vi.mocked(listEvalCaseResourceSummary).mockImplementation((_kn, kind, page, limit = 10) =>
    kind === undefined
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve({
          entries: [{ name: "新函数", kinds: ["function"], case_count: 1 }],
          total: 1,
          case_total: 63,
          page,
          limit,
        }),
  );
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={vi.fn()} />);
  fireEvent.mouseDown(screen.getByLabelText("按资源类型定位", { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByText("函数", { selector: ".ant-select-item-option-content" }));
  const navigation = screen.getByLabelText("资源列表", { selector: "nav" });
  expect(await within(navigation).findByTitle("新函数")).toBeTruthy();
  resolveOld({
    entries: [{ name: "旧对象", kinds: ["objectType"], case_count: 50 }],
    total: 1,
    case_total: 50,
    page: 1,
    limit: 10,
  });
  await waitFor(() => expect(within(navigation).queryByTitle("旧对象")).toBeNull());
  expect(within(navigation).getByTitle("新函数")).toBeTruthy();
});
it("routes no-result counters with the exact server-side latest-result scope", async () => {
  const overview = await vi.mocked(getEvalOverview)("kn-1");
  vi.mocked(getEvalOverview).mockResolvedValue({
    ...overview,
    cases: { ...overview.cases, enabled: 9, evaluated: 4 },
  });
  const onTabChange = vi.fn();
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="overview" onTabChange={onTabChange} />);
  fireEvent.click(await screen.findByRole("tab", { name: "用例与运行" }));
  fireEvent.click(
    within(screen.getByTestId("eval-overview-results")).getByRole("button", {
      name: /暂无评测结果\s*5/,
    }),
  );
  expect(onTabChange).toHaveBeenCalledWith(
    "cases",
    expect.objectContaining({
      result: "no_result",
      participation: "participating",
      status: "enabled",
    }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("restores linked Case filters and uses each Case result instead of the Run verdict", async () => {
  routerMocks.search = "?tab=cases&case_result=failed&case_scope=participating&case_status=enabled";
  const page = await vi.mocked(listEvalCases)("kn-1");
  vi.mocked(listEvalCases).mockResolvedValue({
    ...page,
    entries: [
      {
        ...page.entries[0],
        id: "passed-case",
        title: "单条通过",
        latest_result: {
          status: "passed",
          run_id: "mixed-run",
          case_run_id: "cr-pass",
          execution_status: "completed",
          quality_outcome: "pass",
          assessment_scope: "runtime",
        },
      },
      {
        ...page.entries[0],
        id: "failed-case",
        title: "单条未通过",
        latest_result: {
          status: "failed",
          run_id: "mixed-run",
          case_run_id: "cr-fail",
          execution_status: "completed",
          quality_outcome: "fail",
          assessment_scope: "runtime",
        },
      },
    ],
  });
  const onTabChange = vi.fn();
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="cases" onTabChange={onTabChange} />);
  await screen.findByText("单条通过");
  expect(listEvalCases).toHaveBeenLastCalledWith("kn-1", "", undefined, "enabled", undefined, {
    result: "failed",
    participation: "participating",
  });
  const passed = screen.getByText("单条通过", { selector: "strong" }).closest("tr")!;
  expect(within(passed).getByRole("button", { name: "通过" })).toBeTruthy();
  const failed = screen.getByText("单条未通过", { selector: "strong" }).closest("tr")!;
  fireEvent.click(within(failed).getByRole("button", { name: "未通过" }));
  expect(routerMocks.navigate).toHaveBeenCalledWith(
    expect.objectContaining({ search: expect.stringContaining("run_id=") as unknown }),
    expect.anything(),
  );
  expect(screen.queryByRole("dialog", { name: /用例明细/ })).toBeNull();
});

it("restores a run page and selected evidence directly from its URL", async () => {
  routerMocks.search =
    "?tab=runs&run_id=shared-run&case_run_id=shared-case&result_tab=evidence&run_q=stock&run_page=2";
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);
  const page = await screen.findByRole("region", { name: "运行详情与结果" });
  expect(within(page).getByText("Multi Run panel · shared-run")).toBeVisible();
  expect(within(page).getByTestId("preferred-case")).toHaveTextContent("shared-case");
  expect(within(page).getByTestId("detail-tab")).toHaveTextContent("evidence");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(within(page).getByRole("button", { name: "返回" }));
  expect(screen.getByRole("complementary", { name: "运行记录" })).toBeVisible();
  expect(screen.getByRole("searchbox", { name: "搜索运行" })).toHaveValue("stock");
  const search = routerMocks.navigate.mock.calls.at(-1)![0].search;
  expect(search).toContain("run_q=stock");
  expect(search).toContain("run_page=2");
  expect(search).not.toContain("run_id");
});
it("keeps the exact run and selected Case visible beside AI repair", async () => {
  routerMocks.search = "?tab=runs&run_id=repair-run&case_run_id=repair-case";
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);
  const page = await screen.findByRole("region", { name: "运行详情与结果" });
  fireEvent.click(within(page).getByRole("button", { name: "AI 修复" }));
  const assistant = await screen.findByRole("complementary", { name: "质量评测 AI 助手" });
  expect(page).toBeVisible();
  expect(within(page).getByTestId("preferred-case")).toHaveTextContent("repair-case");
  expect(within(assistant).getByTestId("repair-request")).toHaveTextContent("repair-case");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(within(assistant).getByRole("button", { name: "关闭助手" }));
  expect(page).toBeVisible();
  expect(within(page).getByText("Multi Run panel · repair-run")).toBeVisible();
});
it("restores full run pages through browser back and forward location changes", async () => {
  routerMocks.search = "?tab=runs&run_id=history-run&case_run_id=history-case";
  const { rerender } = render(
    <EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />,
  );
  expect(await screen.findByRole("region", { name: "运行详情与结果" })).toBeVisible();
  routerMocks.search = "?tab=runs";
  rerender(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);
  expect(screen.queryByRole("region", { name: "运行详情与结果" })).toBeNull();
  routerMocks.search = "?tab=runs&run_id=history-run&case_run_id=history-case&result_tab=evidence";
  rerender(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);
  expect(await screen.findByRole("region", { name: "运行详情与结果" })).toBeVisible();
  expect(screen.getByTestId("preferred-case")).toHaveTextContent("history-case");
  expect(screen.getByTestId("detail-tab")).toHaveTextContent("evidence");
});
it("does not open a late repair response after leaving its run page", async () => {
  routerMocks.search = "?tab=runs&run_id=repair-run&case_run_id=repair-case";
  let finish!: (value: Awaited<ReturnType<typeof getEvalOverview>>) => void;
  const overview = await vi.mocked(getEvalOverview)("kn-1");
  vi.mocked(getEvalOverview).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<EvalWorkspaceScene networkId="kn-1" activeTab="runs" onTabChange={vi.fn()} />);
  const page = await screen.findByRole("region", { name: "运行详情与结果" });
  fireEvent.click(within(page).getByRole("button", { name: "AI 修复" }));
  fireEvent.click(within(page).getByRole("button", { name: "返回" }));
  finish(overview);
  await waitFor(() =>
    expect(screen.queryByRole("complementary", { name: "质量评测 AI 助手" })).toBeNull(),
  );
});

it("keeps creation with filters and only shows bulk actions after selecting Cases", async () => {
  renderBatchCases();
  const toolbar = screen.getByRole("region", { name: "用例筛选与新建" });
  expect(within(toolbar).getByRole("button", { name: "新建" })).toBeVisible();
  expect(
    within(toolbar).getByLabelText("用例状态", { selector: '[role="combobox"]' }),
  ).toBeTruthy();
  expect(
    within(toolbar).getByLabelText("最新结果", { selector: '[role="combobox"]' }),
  ).toBeTruthy();
  expect(screen.queryByRole("region", { name: "用例批量操作" })).toBeNull();
  const row = (await screen.findByText("批量草稿")).closest("tr")!;
  fireEvent.click(within(row).getByRole("checkbox"));
  const bulk = screen.getByRole("region", { name: "用例批量操作" });
  expect(within(bulk).getByRole("status")).toHaveTextContent("已选 1 条");
  expect(within(bulk).getByRole("button", { name: "启用" })).toBeVisible();
  expect(within(toolbar).queryByRole("button", { name: "启用" })).toBeNull();
  fireEvent.click(within(bulk).getByRole("button", { name: "取消选择" }));
  expect(within(row).getByRole("checkbox")).not.toBeChecked();
  expect(screen.queryByRole("region", { name: "用例批量操作" })).toBeNull();
  expect(applyEvalCaseBatch).not.toHaveBeenCalled();
  expect(createM1Run).not.toHaveBeenCalled();
});
it("prevents clearing the selected Cases while their bulk operation is pending", async () => {
  renderBatchCases();
  const row = (await screen.findByText("批量草稿")).closest("tr")!;
  fireEvent.click(within(row).getByRole("checkbox"));
  let finish!: (value: Awaited<ReturnType<typeof applyEvalCaseBatch>>) => void;
  vi.mocked(applyEvalCaseBatch).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const bulk = screen.getByRole("region", { name: "用例批量操作" });
  fireEvent.click(within(bulk).getByRole("button", { name: "启用" }));
  await waitFor(() => expect(applyEvalCaseBatch).toHaveBeenCalled());
  expect(within(bulk).getByRole("button", { name: "取消选择" })).toBeDisabled();
  await act(() =>
    Promise.resolve(finish([{ id: "batch-draft", title: "批量草稿", success: true }])),
  );
  await waitFor(() => expect(screen.queryByRole("region", { name: "用例批量操作" })).toBeNull());
});
