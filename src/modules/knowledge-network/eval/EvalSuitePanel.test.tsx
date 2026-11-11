/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "antd";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
import { EvalSuitePanel } from "./EvalSuitePanel";
import {
  createM1Run,
  getEvalSuite,
  getEvalSuiteCaseDetail,
  getM1RunCapabilities,
  listEvalSuites,
  listEvalSuiteVersions,
  listM0Runs,
  searchM0Runs,
  previewM1RunSelection,
  type EvalSuiteVersion,
  type M0Run,
} from "./m0-run.service";
vi.mock("./m0-run.service", () => ({
  CASE_LIST_BATCH_SIZE: 50,
  createEvalSuite: vi.fn(),
  createM1Run: vi.fn(),
  deleteEvalSuite: vi.fn(),
  getEvalSuite: vi.fn(),
  getEvalSuiteCaseDetail: vi.fn(),
  getM1RunCapabilities: vi.fn(),
  listEvalCases: vi.fn(),
  listEvalSuites: vi.fn(),
  listEvalSuiteVersions: vi.fn(),
  listM0Runs: vi.fn(),
  searchM0Runs: vi.fn(),
  previewM1RunSelection: vi.fn(),
  replaceEvalSuite: vi.fn(),
}));
const renderPanel = (node: ReactNode) => render(<App>{node}</App>);
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
const suite: EvalSuiteVersion = {
  id: "suite-v1",
  suite_id: "suite-1",
  name: "供应链核心回归集",
  description: "验证供应链核心流程和关键风险",
  tags: ["核心", "回归"],
  version: 1,
  status: "published",
  members: ["case-1", "case-2"],
  checksum: "a".repeat(64),
};
const run: M0Run = {
  id: "run-1",
  scope: { kind: "suite", suite_id: "suite-1", version: 1 },
  execution_status: "completed",
  phase: null,
  quality_outcome: "pass",
  progress: { planned_cases: 2, completed_cases: 2 },
  created_at: "2026-11-02T08:00:00Z",
};
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listEvalSuites).mockResolvedValue({
    entries: [{ ...suite, latest_run: run }],
    total: 1,
    page: 1,
    limit: 20,
  });
  vi.mocked(listM0Runs).mockResolvedValue([run]);
  vi.mocked(searchM0Runs).mockImplementation((_networkId, query) =>
    Promise.resolve({
      entries: query.suite_version === 1 ? [run] : [],
      total: query.suite_version === 1 ? 1 : 0,
      page: 1,
      limit: 1,
    }),
  );
  vi.mocked(listEvalSuiteVersions).mockResolvedValue([suite]);
  vi.mocked(getEvalSuite).mockResolvedValue({
    ...suite,
    member_summaries: [
      { case_id: "case-1", title: "交期校验" },
      { case_id: "case-2", title: "库存校验" },
    ],
  });
  vi.mocked(getM1RunCapabilities).mockResolvedValue(true);
  vi.mocked(getEvalSuiteCaseDetail).mockResolvedValue({
    case_id: "case-1",
    archived: false,
    gold_visible: true,
    source: { type: "manual" },
    definition: {
      title: "交期校验",
      category: "fact",
      risk_level: "medium",
      input_spec: { question: "物料A的标准交期是多少？", arguments: { material_code: "A" } },
      execution_spec: { target: { name: "标准交期" } },
      assertions: [{ id: "leadtime", type: "equals", path: "$.days" }],
      expected_spec: { days: 14 },
      expected_source: { kind: "business_expert", evidence_refs: ["业务确认单-001"] },
      diagnostic_spec: { note: "按工作日计算" },
    },
  });
  vi.mocked(previewM1RunSelection).mockResolvedValue({
    case_count: 2,
    eligible: true,
    execution_mode: "platform",
    reasons: [],
  });
  vi.mocked(createM1Run).mockResolvedValue({ ...run, id: "run-2" });
});
it("shows reusable test sets separately from the case library", async () => {
  const onCountChange = vi.fn();
  renderPanel(
    <EvalSuitePanel
      networkId="kn-1"
      canManage
      onCountChange={onCountChange}
      onRunCreated={vi.fn()}
    />,
  );
  expect(await screen.findByText("供应链核心回归集")).toBeTruthy();
  expect(screen.getByText("验证供应链核心流程和关键风险")).toBeTruthy();
  expect(
    screen
      .getAllByRole("columnheader")
      .slice(0, 4)
      .map((header) => header.textContent),
  ).toEqual(["测试集名称", "操作", "标签", "描述"]);
  expect(screen.getByText("2 条")).toBeTruthy();
  expect(screen.getByText("v1")).toBeTruthy();
  expect(screen.getByText("已发布")).toBeTruthy();
  expect(screen.getByText("通过")).toBeTruthy();
  expect(onCountChange).toHaveBeenCalledWith(1);
});
it("switches historical versions inside details without a separate version-record entry", async () => {
  const currentSuite = {
    ...suite,
    id: "suite-v2",
    version: 2,
    description: "当前说明",
    tags: ["当前标签"],
    members: ["case-new"],
    published_at: "2026-11-04T08:00:00Z",
  };
  const historicalSuite = {
    ...suite,
    members: ["case-old"],
    description: "历史说明",
    tags: ["历史标签"],
    published_at: "2026-11-01T08:00:00Z",
  };
  vi.mocked(listEvalSuites).mockResolvedValue({
    entries: [currentSuite],
    total: 1,
    page: 1,
    limit: 20,
  });
  vi.mocked(listEvalSuiteVersions).mockResolvedValue([currentSuite, historicalSuite]);
  vi.mocked(getEvalSuite).mockImplementation((_networkId, _suiteId, version) =>
    Promise.resolve({
      ...(version === 1 ? historicalSuite : currentSuite),
      member_summaries: [
        {
          case_id: version === 1 ? "case-old" : "case-new",
          title: version === 1 ? "历史交期校验" : "当前库存校验",
        },
      ],
    }),
  );
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  expect(screen.queryByRole("menuitem", { name: "版本记录" })).toBeNull();
  fireEvent.click(await screen.findByText("详情"));
  const drawer = await screen.findByRole("dialog", { name: "测试集详情" });
  expect(await within(drawer).findByText("当前库存校验")).toBeTruthy();
  expect(within(drawer).queryByText("通过")).toBeNull();
  await waitFor(() => expect(listEvalSuiteVersions).toHaveBeenCalledWith("kn-1", "suite-1"));
  fireEvent.mouseDown(
    within(drawer).getByLabelText("测试集版本", { selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("v1", { selector: ".ant-select-item-option-content" }));
  expect(await within(drawer).findByText("历史交期校验")).toBeTruthy();
  expect(within(drawer).getByText("历史说明")).toBeTruthy();
  expect(within(drawer).getByText("历史标签")).toBeTruthy();
  expect(await within(drawer).findByText("通过")).toBeTruthy();
  expect(within(drawer).queryByText("当前库存校验")).toBeNull();
  expect(getEvalSuite).toHaveBeenCalledWith("kn-1", "suite-1", 1);
  expect(searchM0Runs).toHaveBeenCalledWith("kn-1", {
    suite_id: "suite-1",
    suite_version: 1,
    page: 1,
    limit: 1,
  });
  fireEvent.click(within(drawer).getByText("历史交期校验").closest("button")!);
  await waitFor(() =>
    expect(getEvalSuiteCaseDetail).toHaveBeenCalledWith("kn-1", "suite-1", 1, "case-old"),
  );
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});
it("filters regression-tagged test sets on the server and keeps the unfiltered tab count", async () => {
  vi.mocked(listEvalSuites).mockImplementation((_networkId, page = 1, filters = {}) =>
    Promise.resolve({
      entries: filters.q ? [] : [suite],
      total: filters.q ? 0 : filters.tag ? 21 : 42,
      total_all: 42,
      available_tags: ["核心", "回归"],
      page,
      limit: 20,
    }),
  );
  const onCountChange = vi.fn();
  renderPanel(
    <EvalSuitePanel
      networkId="kn-1"
      canManage
      onCountChange={onCountChange}
      onRunCreated={vi.fn()}
    />,
  );
  await screen.findByText("供应链核心回归集");
  fireEvent.click(screen.getByRole("listitem", { name: "2" }));
  await waitFor(() =>
    expect(listEvalSuites).toHaveBeenLastCalledWith("kn-1", 2, { q: undefined, tag: undefined }),
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "测试集标签筛选" }));
  fireEvent.click(await screen.findByText("回归", { selector: ".ant-select-item-option-content" }));
  await waitFor(() =>
    expect(listEvalSuites).toHaveBeenLastCalledWith("kn-1", 1, { q: undefined, tag: "回归" }),
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "搜索测试集" }), {
    target: { value: "missing" },
  });
  expect(await screen.findByText("没有符合条件的测试集")).toBeTruthy();
  expect(listEvalSuites).toHaveBeenLastCalledWith("kn-1", 1, { q: "missing", tag: "回归" });
  expect(onCountChange).toHaveBeenCalledWith(42);
  expect(onCountChange).not.toHaveBeenCalledWith(0);
  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  await waitFor(() =>
    expect(listEvalSuites).toHaveBeenLastCalledWith("kn-1", 1, { q: undefined, tag: undefined }),
  );
});
it("validates the published capabilities without starting an external client", async () => {
  const onRunCreated = vi.fn();
  renderPanel(
    <EvalSuitePanel
      networkId="kn-1"
      canManage
      onCountChange={vi.fn()}
      onRunCreated={onRunCreated}
    />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByText("校验能力"));
  await waitFor(() =>
    expect(previewM1RunSelection).toHaveBeenCalledWith("kn-1", {
      kind: "suite",
      suite_id: "suite-1",
      version: 1,
    }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "确定运行测试集“供应链核心回归集”吗？",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: /运\s*行/ }));
  await waitFor(() =>
    expect(onRunCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "run-2" })),
  );
});
it("opens manual MCP instructions pinned to the suite version without creating a platform run", async () => {
  const onRunCreated = vi.fn();
  renderPanel(
    <EvalSuitePanel
      networkId="kn-1"
      canManage
      onCountChange={vi.fn()}
      onRunCreated={onRunCreated}
    />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByText("运行"));
  const drawer = await screen.findByRole("dialog", { name: "外部智能体评测" });
  expect(within(drawer).getByText(/知识网络 kn-1 的测试集 suite-1（固定版本 1）/)).toBeTruthy();
  expect(within(drawer).getByText(/\/api\/agent-retrieval\/v1\/mcp\//)).toBeTruthy();
  expect(createM1Run).not.toHaveBeenCalled();
  expect(previewM1RunSelection).toHaveBeenCalledWith(
    "kn-1",
    { kind: "suite", suite_id: "suite-1", version: 1 },
    "external",
  );
  expect(onRunCreated).not.toHaveBeenCalled();
});
it("opens test set details from the action menu", async () => {
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByText("详情"));
  const drawer = await screen.findByRole("dialog", { name: "测试集详情" });
  expect(drawer.textContent).toContain("供应链核心回归集");
  expect(drawer.textContent).toContain("验证供应链核心流程和关键风险");
  expect(drawer.textContent).not.toContain("suite-1");
  expect(drawer.textContent).toContain("包含用例（2）");
  expect(await within(drawer).findByText("交期校验")).toBeTruthy();
  expect(within(drawer).getByText("库存校验")).toBeTruthy();
  expect(getEvalSuite).toHaveBeenCalledWith("kn-1", "suite-1", 1);
  expect(getEvalSuiteCaseDetail).not.toHaveBeenCalled();
});
it("opens the current referenced case on demand and returns to the unchanged test set", async () => {
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByText("详情"));
  const suiteDrawer = await screen.findByRole("dialog", { name: "测试集详情" });
  fireEvent.click(await within(suiteDrawer).findByText("交期校验"));
  const caseDrawer = (await screen.findByText("用例详情")).closest<HTMLElement>('[role="dialog"]')!;
  expect(await within(caseDrawer).findByText("物料A的标准交期是多少？")).toBeTruthy();
  expect(within(caseDrawer).getByText("标准交期")).toBeTruthy();
  expect(within(caseDrawer).getByText(/"days":14/)).toBeTruthy();
  expect(within(caseDrawer).getByText("业务确认单-001")).toBeTruthy();
  expect(within(caseDrawer).getByText("按工作日计算")).toBeTruthy();
  expect(getEvalSuiteCaseDetail).toHaveBeenCalledWith("kn-1", "suite-1", 1, "case-1");
  expect(caseDrawer).toBe(suiteDrawer);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(caseDrawer).queryByRole("button", { name: "确定" })).toBeNull();
  fireEvent.click(within(caseDrawer).getByLabelText("返回测试集", { selector: "button" }));
  await waitFor(() => expect(screen.queryByText("用例详情")).toBeNull());
  expect(within(suiteDrawer).getByText("库存校验")).toBeTruthy();
  expect(createM1Run).not.toHaveBeenCalled();
});
it("keeps the suite open when member details fail and supports retry", async () => {
  const successful = vi.mocked(getEvalSuiteCaseDetail).getMockImplementation()!;
  vi.mocked(getEvalSuiteCaseDetail).mockRejectedValueOnce(new Error("network unavailable"));
  renderPanel(
    <EvalSuitePanel
      networkId="kn-1"
      canManage={false}
      onCountChange={vi.fn()}
      onRunCreated={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByText("详情"));
  const suiteDrawer = await screen.findByRole("dialog", { name: "测试集详情" });
  fireEvent.click(await within(suiteDrawer).findByText("交期校验"));
  const caseDrawer = (await screen.findByText("用例详情")).closest<HTMLElement>('[role="dialog"]')!;
  expect(await within(caseDrawer).findByText("无法读取用例详情，请稍后重试。")).toBeTruthy();
  vi.mocked(getEvalSuiteCaseDetail).mockImplementation(async (...args) => ({
    ...(await successful(...args)),
    gold_visible: false,
    definition: { ...(await successful(...args)).definition, expected_spec: null },
  }));
  fireEvent.click(
    within(caseDrawer)
      .getByText(/重\s*试/, { selector: "button > span" })
      .closest("button")!,
  );
  expect(
    await within(caseDrawer).findByText("预期结果受权限保护，需用例管理权限才能查看。"),
  ).toBeTruthy();
  expect(within(caseDrawer).queryByText(/"days": 14/)).toBeNull();
  expect(within(suiteDrawer).queryByRole("combobox", { name: "测试集版本" })).toBeNull();
  fireEvent.click(within(caseDrawer).getByLabelText("返回测试集", { selector: "button" }));
  expect(within(suiteDrawer).getByText("库存校验")).toBeTruthy();
  expect(within(suiteDrawer).getByRole("combobox", { name: "测试集版本" })).toBeTruthy();
});
it("shows test sets while recent run metadata is still pending and reuses it during search", async () => {
  vi.mocked(listM0Runs).mockReturnValue(new Promise(() => {}));
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  await screen.findByText("供应链核心回归集");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "核心" } });
  await waitFor(() =>
    expect(listEvalSuites).toHaveBeenLastCalledWith(
      "kn-1",
      1,
      expect.objectContaining({ q: "核心" }),
    ),
  );
  expect(listM0Runs).not.toHaveBeenCalled();
});
it("paginates large member lists and preserves their immutable version when inspecting a later page", async () => {
  const listing = await vi.mocked(listEvalSuites)("kn-1");
  const largeSuite = {
    ...suite,
    members: Array.from({ length: 12 }, (_, index) => `case-${index + 1}`),
  };
  vi.mocked(listEvalSuites).mockResolvedValue({ ...listing, entries: [largeSuite] });
  vi.mocked(getEvalSuite).mockResolvedValue({
    ...largeSuite,
    member_summaries: largeSuite.members.map((id, index) => ({
      case_id: id,
      title: `分页用例 ${index + 1}`,
    })),
  });
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByText("详情"));
  const suiteDrawer = await screen.findByRole("dialog", { name: "测试集详情" });
  await within(suiteDrawer).findByText("分页用例 1");
  expect(within(suiteDrawer).queryByText("分页用例 11")).toBeNull();
  fireEvent.click(within(suiteDrawer).getByRole("listitem", { name: "2" }));
  const suitePane = (await within(suiteDrawer).findByText("分页用例 11")).closest<HTMLElement>(
    ".ant-space",
  )!.parentElement!;
  suitePane.scrollTop = 240;
  fireEvent.click(await within(suiteDrawer).findByText("分页用例 11"));
  const caseDrawer = (await screen.findByText("用例详情")).closest<HTMLElement>('[role="dialog"]')!;
  await within(caseDrawer).findByText("物料A的标准交期是多少？");
  expect(getEvalSuiteCaseDetail).toHaveBeenCalledWith("kn-1", "suite-1", 1, "case-11");
  fireEvent.click(within(caseDrawer).getByLabelText("返回测试集", { selector: "button" }));
  await waitFor(() => expect(screen.queryByText("用例详情")).toBeNull());
  expect(within(suiteDrawer).getByText("分页用例 11")).toBeTruthy();
  expect(within(suiteDrawer).queryByText("分页用例 1")).toBeNull();
  expect(suitePane.scrollTop).toBe(240);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
}, 30000);
it("keeps list tags compact and exposes every remaining tag in a popover", async () => {
  vi.mocked(listEvalSuites).mockResolvedValue({
    entries: [{ ...suite, tags: ["核心", "回归", "系统验收", "较长的业务场景标签"] }],
    total: 1,
    page: 1,
    limit: 20,
  });
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  const row = (await screen.findByText("供应链核心回归集")).closest("tr")!;
  expect(within(row).getByText("核心")).toBeTruthy();
  expect(within(row).getByText("回归")).toBeTruthy();
  expect(within(row).queryByText("系统验收")).toBeNull();
  const more = within(row).getByRole("button", { name: "查看全部 4 个标签" });
  expect(more.textContent).toBe("+2");
  fireEvent.click(more);
  const popover = await screen.findByRole("tooltip");
  expect(within(popover).getByText("系统验收")).toBeTruthy();
  expect(within(popover).getByText("较长的业务场景标签")).toBeTruthy();
});
it("retains the selected version when a previous detail request finishes late", async () => {
  const current = { ...suite, id: "suite-v2", version: 2, members: ["case-new"] };
  const older = { ...suite, members: ["case-old"] };
  let finishCurrent!: (suite: EvalSuiteVersion) => void;
  vi.mocked(listEvalSuites).mockResolvedValue({ entries: [current], total: 1, page: 1, limit: 20 });
  vi.mocked(listEvalSuiteVersions).mockResolvedValue([current, older]);
  vi.mocked(getEvalSuite).mockImplementation((_kn, _id, version) =>
    version === 2
      ? new Promise((resolve) => {
          finishCurrent = resolve;
        })
      : Promise.resolve({
          ...older,
          member_summaries: [{ case_id: "case-old", title: "历史成员" }],
        }),
  );
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: /^详情$/ }));
  const drawer = await screen.findByRole("dialog", { name: "测试集详情" });
  await waitFor(() => expect(getEvalSuite).toHaveBeenCalledWith("kn-1", "suite-1", 2));
  fireEvent.mouseDown(
    within(drawer).getByLabelText("测试集版本", { selector: '[role="combobox"]' }),
  );
  fireEvent.click(await screen.findByText("v1", { selector: ".ant-select-item-option-content" }));
  expect(await within(drawer).findByText("历史成员")).toBeTruthy();
  await act(() =>
    Promise.resolve(
      finishCurrent({
        ...current,
        member_summaries: [{ case_id: "case-new", title: "迟到的新版本成员" }],
      }),
    ),
  );
  expect(within(drawer).getByText("历史成员")).toBeTruthy();
  expect(within(drawer).queryByText("迟到的新版本成员")).toBeNull();
});
it("retries version and detail reads without reporting unavailable members as deleted", async () => {
  vi.mocked(listEvalSuiteVersions).mockRejectedValueOnce(new Error("offline"));
  vi.mocked(getEvalSuite).mockRejectedValueOnce(new Error("offline"));
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: /^详情$/ }));
  const drawer = await screen.findByRole("dialog", { name: "测试集详情" });
  expect(await within(drawer).findByText("无法读取版本列表，请重试。")).toBeTruthy();
  expect(await within(drawer).findByText("无法读取此版本详情，请重试。")).toBeTruthy();
  expect(within(drawer).queryByText("用例已删除或当前无权查看")).toBeNull();
  fireEvent.click(within(drawer).getByRole("button", { name: "重试读取版本" }));
  await waitFor(() => expect(listEvalSuiteVersions).toHaveBeenCalledTimes(2));
  fireEvent.click(within(drawer).getByRole("button", { name: "重试读取详情" }));
  expect(await within(drawer).findByText("交期校验")).toBeTruthy();
  expect(within(drawer).queryByText("无法读取此版本详情，请重试。")).toBeNull();
});

it("uses names rather than internal IDs in the suite list and member selection links", async () => {
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  const button = await screen.findByRole("button", { name: "供应链核心回归集" });
  expect(button.textContent).not.toContain("suite-1");
  fireEvent.click(button);
  const drawer = await screen.findByRole("dialog", { name: "测试集详情" });
  expect(await within(drawer).findByRole("button", { name: "交期校验" })).toBeTruthy();
  expect(within(drawer).queryByRole("columnheader", { name: "用例 ID" })).toBeNull();
});

async function openMemberDetails() {
  const definition = await vi.mocked(getEvalSuiteCaseDetail)("kn-1", "suite-1", 1, "case-1");
  vi.mocked(getEvalSuiteCaseDetail).mockImplementation((_network, _suite, _version, caseId) =>
    Promise.resolve({
      ...definition,
      case_id: caseId,
      definition: {
        ...definition.definition,
        title: caseId === "case-1" ? "交期用例当前定义" : "库存用例当前定义",
      },
    }),
  );
  renderPanel(
    <EvalSuitePanel networkId="kn-1" canManage onCountChange={vi.fn()} onRunCreated={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByLabelText("测试集操作：供应链核心回归集", { selector: "button" }),
  );
  fireEvent.click(await screen.findByText("详情"));
  const drawer = await screen.findByRole("dialog", { name: "测试集详情" });
  const header = within(drawer.querySelector<HTMLElement>(".ant-drawer-header")!);
  expect(within(drawer).queryByText("确定", { selector: "button span" })).toBeNull();
  fireEvent.click(await within(drawer).findByText("交期校验"));
  await within(drawer).findByText("交期用例当前定义");
  return { drawer, header };
}

it("navigates members back and forth within one drawer", async () => {
  const { drawer, header } = await openMemberDetails();
  expect(header.getByRole("button", { name: "上一条" })).toBeDisabled();
  fireEvent.click(header.getByRole("button", { name: "下一条" }));
  await within(drawer).findByText("库存用例当前定义");
  expect(within(drawer).queryByText("交期用例当前定义")).toBeNull();
  expect(within(drawer).getByText("2 / 2")).toBeTruthy();
  expect(header.getByRole("button", { name: "下一条" })).toBeDisabled();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(getEvalSuiteCaseDetail).toHaveBeenLastCalledWith("kn-1", "suite-1", 1, "case-2");
  fireEvent.click(header.getByRole("button", { name: "上一条" }));
  await within(drawer).findByText("交期用例当前定义");
});

it("closes the complete member detail flow and reopens at the test suite", async () => {
  const { header } = await openMemberDetails();
  fireEvent.click(header.getByLabelText("Close", { selector: "button" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByLabelText("测试集操作：供应链核心回归集", { selector: "button" }));
  fireEvent.click(await screen.findByText("详情"));
  const reopened = await screen.findByRole("dialog", { name: "测试集详情" });
  expect(await within(reopened).findByText("交期校验", { selector: "button span" })).toBeTruthy();
  expect(within(reopened).queryByLabelText("返回测试集", { selector: "button" })).toBeNull();
});
