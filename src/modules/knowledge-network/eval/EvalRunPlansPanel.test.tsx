/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});

import { EvalRunPlansPanel } from "./EvalRunPlansPanel";
import {
  beginEvalRunPlanAuthorization,
  completeEvalRunPlanAuthorization,
  setEvalRunPlanEnabled,
  createEvalRunPlan,
  listEvalRunPlans,
  listEvalSuiteVersions,
  previewM1RunSelection,
  listEvalSuites,
  runEvalRunPlanNow,
  updateEvalRunPlan,
  type EvalRunPlan,
  type EvalSuiteVersion,
  type M0Run,
} from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  beginEvalRunPlanAuthorization: vi.fn(),
  completeEvalRunPlanAuthorization: vi.fn(),
  createEvalRunPlan: vi.fn(),
  previewM1RunSelection: vi.fn(),
  deleteEvalRunPlan: vi.fn(),
  listEvalRunPlans: vi.fn(),
  listEvalSuiteVersions: vi.fn(),
  listEvalSuites: vi.fn(),
  runEvalRunPlanNow: vi.fn(),
  setEvalRunPlanEnabled: vi.fn(),
  updateEvalRunPlan: vi.fn(),
}));

import { authorizeInOAuthPopup } from "@/framework/auth/oauth-popup";
vi.mock("@/framework/auth/oauth-popup", () => ({
  authorizeInOAuthPopup: vi.fn(),
  reserveOAuthPopup: vi.fn(() => ({ close: vi.fn() })),
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

const suite: EvalSuiteVersion = {
  id: "suite-version-2",
  suite_id: "suite-1",
  name: "供应链核心回归集",
  description: "验证供应链核心流程",
  tags: ["核心", "回归"],
  version: 2,
  status: "published",
  members: ["case-1"],
  checksum: "a".repeat(64),
};

const plan: EvalRunPlan = {
  id: "plan-1",
  kn_id: "kn-1",
  name: "每日供应链回归",
  suite_id: "suite-1",
  suite_name: "供应链核心回归集",
  version_policy: "latest",
  schedule: { kind: "daily", time_of_day: "09:00", timezone: "Asia/Shanghai" },
  overlap_policy: "skip",
  enabled: true,
  next_run_at: "2026-11-03T01:00:00Z",
  revision: 1,
  created_by: "user:alice",
  updated_by: "user:alice",
  created_at: "2026-11-02T08:00:00Z",
  updated_at: "2026-11-02T08:00:00Z",
};

const run: M0Run = {
  id: "run-1",
  execution_status: "queued",
  phase: "resolving",
  quality_outcome: null,
  progress: { planned_cases: 1, completed_cases: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(beginEvalRunPlanAuthorization).mockResolvedValue({
    state: "state",
    code_challenge: "challenge",
  });
  vi.mocked(completeEvalRunPlanAuthorization).mockResolvedValue();
  vi.mocked(setEvalRunPlanEnabled).mockResolvedValue(plan);
  vi.mocked(authorizeInOAuthPopup).mockImplementation(async (begin) => {
    await begin();
    return { state: "state", code: "code" };
  });
  vi.mocked(previewM1RunSelection).mockResolvedValue({
    case_count: 1,
    eligible: true,
    execution_mode: "scheduled",
    reasons: [],
  });
  vi.mocked(listEvalRunPlans).mockResolvedValue({
    entries: [plan],
    total: 1,
    page: 1,
    limit: 20,
  });
  vi.mocked(listEvalSuites).mockResolvedValue({
    entries: [suite],
    total: 1,
    page: 1,
    limit: 20,
  });
  vi.mocked(listEvalSuiteVersions).mockResolvedValue([suite]);
  vi.mocked(runEvalRunPlanNow).mockResolvedValue(run);
  vi.mocked(createEvalRunPlan).mockResolvedValue(plan);
  vi.mocked(updateEvalRunPlan).mockResolvedValue(plan);
});

it("shows blocked scheduling without a next trigger when delegation is unavailable", async () => {
  const onCountChange = vi.fn();
  render(
    <EvalRunPlansPanel
      networkId="kn-1"
      available
      canManage
      onCountChange={onCountChange}
      onRunCreated={vi.fn()}
    />,
  );

  expect(await screen.findByText("每日供应链回归")).toBeTruthy();
  expect(screen.getByText("每天 09:00（Asia/Shanghai）")).toBeTruthy();
  expect(screen.getByText("每次取最新发布版")).toBeTruthy();
  expect(screen.getByText("自动运行受阻")).toBeTruthy();
  expect(screen.queryByText("已启用")).toBeNull();
  expect(screen.queryByText(new Date(plan.next_run_at!).toLocaleString())).toBeNull();
  expect(onCountChange).toHaveBeenCalledWith(1);
  expect(screen.getAllByRole("columnheader").map((element) => element.textContent)).toEqual([
    "计划名称",
    "操作",
    "测试集",
    "版本",
    "执行周期",
    "状态",
    "下次运行",
    "最近触发",
  ]);
  const create = screen.getByRole("button", { name: /^新\s*建$/ });
  expect(create.closest("section")?.querySelector('input[aria-label="搜索运行计划"]')).toBeTruthy();
});

it("filters across plan pages while retaining the total tab count", async () => {
  const onCountChange = vi.fn();
  vi.mocked(listEvalRunPlans).mockImplementation((_networkId, page, filters) =>
    Promise.resolve({
      entries: filters?.q ? [] : [plan],
      total: filters?.q ? 0 : 21,
      total_all: 21,
      page: page ?? 1,
      limit: 20,
    }),
  );
  render(
    <EvalRunPlansPanel
      networkId="kn-1"
      available
      canManage
      onCountChange={onCountChange}
      onRunCreated={vi.fn()}
    />,
  );
  await screen.findByText("每日供应链回归");
  fireEvent.click(screen.getByRole("listitem", { name: "2" }));
  await waitFor(() =>
    expect(listEvalRunPlans).toHaveBeenLastCalledWith("kn-1", 2, expect.any(Object)),
  );
  fireEvent.change(screen.getByPlaceholderText("搜索计划名称、测试集或 ID"), {
    target: { value: "missing" },
  });
  await waitFor(() =>
    expect(listEvalRunPlans).toHaveBeenLastCalledWith(
      "kn-1",
      1,
      expect.objectContaining({ q: "missing" }),
    ),
  );
  expect(await screen.findByText("暂无符合条件的运行计划")).toBeTruthy();
  expect(onCountChange).toHaveBeenLastCalledWith(21);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "计划状态筛选" }));
  fireEvent.click(
    await screen.findByText("未启用", { selector: ".ant-select-item-option-content" }),
  );
  await waitFor(() =>
    expect(listEvalRunPlans).toHaveBeenLastCalledWith(
      "kn-1",
      1,
      expect.objectContaining({ q: "missing", state: "paused" }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  expect(await screen.findByText("每日供应链回归")).toBeTruthy();
  await waitFor(() =>
    expect(listEvalRunPlans).toHaveBeenLastCalledWith("kn-1", 1, {
      q: undefined,
      state: undefined,
      schedule_kind: undefined,
      version_policy: undefined,
    }),
  );
});

it("runs a plan immediately and returns the created Run", async () => {
  const onRunCreated = vi.fn();
  render(
    <EvalRunPlansPanel
      networkId="kn-1"
      available
      canManage
      onCountChange={vi.fn()}
      onRunCreated={onRunCreated}
    />,
  );

  fireEvent.click(await screen.findByRole("button", { name: "运行计划操作：每日供应链回归" }));
  fireEvent.click(
    await screen.findByText("运行", { selector: ".ant-dropdown-menu-title-content" }),
  );

  await waitFor(() => expect(runEvalRunPlanNow).toHaveBeenCalledWith("kn-1", "plan-1"));
  expect(onRunCreated).toHaveBeenCalledWith(run);
});

it("creates a paused daily plan until user delegation is connected", async () => {
  vi.mocked(previewM1RunSelection).mockRejectedValue(new Error("runner unavailable"));
  render(
    <EvalRunPlansPanel
      networkId="kn-1"
      available
      canManage
      onCountChange={vi.fn()}
      onRunCreated={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /^新\s*建$/ }));
  fireEvent.change(screen.getByPlaceholderText("例如：每日标准交期回归"), {
    target: { value: "每日供应链回归" },
  });
  fireEvent.mouseDown(screen.getByText("选择已发布测试集"));
  fireEvent.click(
    await screen.findByText("供应链核心回归集", { selector: ".ant-select-item-option-content" }),
  );
  const drawer = screen.getByRole("dialog", { name: "新建运行计划" });
  expect(
    within(drawer).getByText(
      "测试集版本固定成员集合和标签；成员用例使用运行开始时的当前内容，每次运行保存独立快照。",
    ),
  ).toBeTruthy();
  const confirm = screen.getByRole("button", { name: /确\s*定/ });
  expect(drawer.querySelector(".ant-drawer-footer")?.contains(confirm)).toBe(true);
  expect(drawer.querySelector(".ant-drawer-extra")).toBeNull();
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);

  await waitFor(() =>
    expect(createEvalRunPlan).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({
        name: "每日供应链回归",
        suite_id: "suite-1",
        version_policy: "latest",
        overlap_policy: "skip",
        enabled: false,
      }),
    ),
  );
  expect(previewM1RunSelection).not.toHaveBeenCalled();
  expect(vi.mocked(createEvalRunPlan).mock.calls.at(-1)?.[1].schedule).toMatchObject({
    kind: "daily",
    time_of_day: "09:00",
  });
});

it("loads only plan rows until a plan editor needs published suite options", async () => {
  render(
    <EvalRunPlansPanel
      networkId="kn-1"
      available
      canManage
      onCountChange={vi.fn()}
      onRunCreated={vi.fn()}
    />,
  );
  await screen.findByText("每日供应链回归");
  expect(listEvalSuites).not.toHaveBeenCalled();
  expect(listEvalSuiteVersions).not.toHaveBeenCalled();
  expect(screen.queryByText(/暂无包含用例的已发布测试集/)).toBeNull();
  fireEvent.change(screen.getByRole("searchbox", { name: "搜索运行计划" }), {
    target: { value: "供应链" },
  });
  await waitFor(() =>
    expect(listEvalRunPlans).toHaveBeenLastCalledWith(
      "kn-1",
      1,
      expect.objectContaining({ q: "供应链" }),
    ),
  );
  expect(listEvalSuites).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^新\s*建$/ }));
  await waitFor(() => expect(listEvalSuiteVersions).toHaveBeenCalledWith("kn-1", "suite-1"));
});

const emptyWarning = "暂无包含用例的已发布测试集，请先在“测试集管理”中发布测试集。";

const panelProps = () => ({
  networkId: "kn-1",
  available: true,
  canManage: true,
  onCountChange: vi.fn(),
  onRunCreated: vi.fn(),
});

it("does not treat an unrequested or loading Suite catalogue as empty", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof listEvalSuites>>) => void;
  vi.mocked(listEvalSuites).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<EvalRunPlansPanel {...panelProps()} />);
  await screen.findByText("每日供应链回归");
  expect(screen.queryByText(emptyWarning)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^新\s*建$/ }));
  const drawer = screen.getByRole("dialog", { name: "新建运行计划" });
  expect(within(drawer).queryByText(emptyWarning)).toBeNull();
  expect(within(drawer).getByRole("button", { name: /确\s*定/ })).toBeDisabled();
  await act(async () => {
    resolve({ entries: [suite], total: 1, page: 1, limit: 20 });
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(within(drawer).getByRole("button", { name: /确\s*定/ })).not.toBeDisabled(),
  );
  expect(screen.queryByText(emptyWarning)).toBeNull();
});

it("shows a confirmed empty catalogue only inside the editor and clears it on reopening", async () => {
  vi.mocked(listEvalSuites).mockResolvedValueOnce({ entries: [], total: 0, page: 1, limit: 20 });
  render(<EvalRunPlansPanel {...panelProps()} />);
  await screen.findByText("每日供应链回归");
  expect(screen.queryByText(emptyWarning)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^新\s*建$/ }));
  const drawer = screen.getByRole("dialog", { name: "新建运行计划" });
  expect(await within(drawer).findByText(emptyWarning)).toBeTruthy();
  expect(within(drawer).getByRole("button", { name: /确\s*定/ })).toBeDisabled();
  fireEvent.click(within(drawer).getByRole("button", { name: /取\s*消/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByText(emptyWarning)).toBeNull();
  let resolve!: (value: Awaited<ReturnType<typeof listEvalSuites>>) => void;
  vi.mocked(listEvalSuites).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: /^新\s*建$/ }));
  const reopened = screen.getByRole("dialog", { name: "新建运行计划" });
  expect(within(reopened).queryByText(emptyWarning)).toBeNull();
  await act(async () => {
    resolve({ entries: [suite], total: 1, page: 1, limit: 20 });
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(within(reopened).getByRole("button", { name: /确\s*定/ })).not.toBeDisabled(),
  );
});

it.each(["catalogue", "versions"])(
  "shows and retries a %s failure without claiming there are no published Suites",
  async (failure) => {
    if (failure === "catalogue")
      vi.mocked(listEvalSuites).mockRejectedValueOnce(new Error("unavailable"));
    else vi.mocked(listEvalSuiteVersions).mockRejectedValueOnce(new Error("unavailable"));
    render(<EvalRunPlansPanel {...panelProps()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^新\s*建$/ }));
    const drawer = screen.getByRole("dialog", { name: "新建运行计划" });
    expect(await within(drawer).findByText("无法读取已发布测试集，请重试。")).toBeTruthy();
    expect(screen.queryByText(emptyWarning)).toBeNull();
    expect(within(drawer).getByRole("button", { name: /确\s*定/ })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole("button", { name: /重\s*试/ }));
    await waitFor(() =>
      expect(within(drawer).getByRole("button", { name: /确\s*定/ })).not.toBeDisabled(),
    );
    expect(within(drawer).queryByText("无法读取已发布测试集，请重试。")).toBeNull();
    expect(screen.queryByText(emptyWarning)).toBeNull();
    expect(createEvalRunPlan).not.toHaveBeenCalled();
  },
);

it("checks later Suite pages before deciding that no usable published version exists", async () => {
  const first = Array.from({ length: 20 }, (_, index) => ({
    ...suite,
    suite_id: `empty-${index}`,
    members: [],
  }));
  vi.mocked(listEvalSuites).mockImplementation((_kn, page) =>
    Promise.resolve({
      entries: page === 1 ? first : [suite],
      total: 21,
      page: page ?? 1,
      limit: 20,
    }),
  );
  vi.mocked(listEvalSuiteVersions).mockImplementation((_kn, id) =>
    Promise.resolve(id === suite.suite_id ? [suite] : [{ ...suite, suite_id: id, members: [] }]),
  );
  render(<EvalRunPlansPanel {...panelProps()} />);
  fireEvent.click(await screen.findByRole("button", { name: /^新\s*建$/ }));
  const drawer = screen.getByRole("dialog", { name: "新建运行计划" });
  await waitFor(() =>
    expect(within(drawer).getByRole("button", { name: /确\s*定/ })).not.toBeDisabled(),
  );
  expect(listEvalSuites).toHaveBeenCalledWith("kn-1", 2);
  expect(listEvalSuiteVersions).toHaveBeenCalledWith("kn-1", "suite-1");
  expect(screen.queryByText(emptyWarning)).toBeNull();
});

it("rejects incomplete catalogue reads instead of showing an empty warning", async () => {
  vi.mocked(listEvalSuites).mockResolvedValue({ entries: [], total: 21, page: 1, limit: 20 });
  render(<EvalRunPlansPanel {...panelProps()} />);
  fireEvent.click(await screen.findByRole("button", { name: /^新\s*建$/ }));
  expect(await screen.findByText("无法读取已发布测试集，请重试。")).toBeTruthy();
  expect(screen.queryByText(emptyWarning)).toBeNull();
});

it("ignores Suite options from a previous network when an editor remains open", async () => {
  let resolveOld!: (value: Awaited<ReturnType<typeof listEvalSuites>>) => void;
  vi.mocked(listEvalSuites).mockImplementation((kn) =>
    kn === "kn-1"
      ? new Promise((done) => {
          resolveOld = done;
        })
      : Promise.resolve({ entries: [], total: 0, page: 1, limit: 20 }),
  );
  const props = panelProps();
  const { rerender } = render(<EvalRunPlansPanel {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: /^新\s*建$/ }));
  await waitFor(() => expect(listEvalSuites).toHaveBeenCalledWith("kn-1", 1));
  rerender(<EvalRunPlansPanel {...props} networkId="kn-2" />);
  const drawer = screen.getByRole("dialog", { name: "新建运行计划" });
  expect(await within(drawer).findByText(emptyWarning)).toBeTruthy();
  await act(async () => {
    resolveOld({ entries: [suite], total: 1, page: 1, limit: 20 });
    await Promise.resolve();
  });
  expect(within(drawer).getByText(emptyWarning)).toBeTruthy();
  expect(within(drawer).getByRole("button", { name: /确\s*定/ })).toBeDisabled();
  expect(listEvalSuiteVersions).not.toHaveBeenCalledWith("kn-1", "suite-1");
});

it("shows and filters monthly plans using their calendar date", async () => {
  vi.mocked(listEvalRunPlans).mockResolvedValue({
    entries: [
      {
        ...plan,
        schedule: {
          kind: "monthly",
          day_of_month: 31,
          time_of_day: "09:00",
          timezone: "Asia/Shanghai",
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  });
  render(<EvalRunPlansPanel {...panelProps()} />);
  expect(await screen.findByText("每月 31 日 09:00（Asia/Shanghai）")).toBeTruthy();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "执行周期筛选" }));
  fireEvent.click(await screen.findByText("每月", { selector: ".ant-select-item-option-content" }));
  await waitFor(() =>
    expect(listEvalRunPlans).toHaveBeenLastCalledWith(
      "kn-1",
      1,
      expect.objectContaining({ schedule_kind: "monthly" }),
    ),
  );
});

it("requires a monthly date and creates a month-end plan without a weekly day", async () => {
  render(<EvalRunPlansPanel {...panelProps()} />);
  fireEvent.click(await screen.findByRole("button", { name: /^新\s*建$/ }));
  const drawer = screen.getByRole("dialog", { name: "新建运行计划" });
  fireEvent.change(within(drawer).getByPlaceholderText("例如：每日标准交期回归"), {
    target: { value: "每月月底回归" },
  });
  fireEvent.mouseDown(within(drawer).getByText("选择已发布测试集"));
  fireEvent.click(
    await screen.findByText("供应链核心回归集", { selector: ".ant-select-item-option-content" }),
  );
  fireEvent.mouseDown(within(drawer).getByRole("combobox", { name: "执行周期" }));
  fireEvent.click(await screen.findByText("每月", { selector: ".ant-select-item-option-content" }));
  expect(within(drawer).getByText("当月没有所选日期时，将在当月最后一天执行。")).toBeTruthy();
  expect(within(drawer).queryByRole("combobox", { name: "星期" })).toBeNull();
  const dateSelect = within(drawer).getByRole("combobox", { name: "每月日期" });
  expect(dateSelect).toHaveAttribute("aria-required", "true");
  fireEvent.mouseDown(dateSelect);
  await screen.findByText("1日", { selector: ".ant-select-item-option-content" });
  fireEvent.keyDown(dateSelect, { key: "ArrowUp", keyCode: 38, which: 38 });
  fireEvent.keyDown(dateSelect, { key: "Enter", keyCode: 13, which: 13 });
  expect(within(drawer).getByText("31日", { selector: ".ant-select-selection-item" })).toBeTruthy();
  fireEvent.click(within(drawer).getByRole("button", { name: /确\s*定/ }));
  await waitFor(() => expect(createEvalRunPlan).toHaveBeenCalled());
  expect(vi.mocked(createEvalRunPlan).mock.lastCall?.[0]).toBe("kn-1");
  expect(vi.mocked(createEvalRunPlan).mock.lastCall?.[1].name).toBe("每月月底回归");
  expect(vi.mocked(createEvalRunPlan).mock.lastCall?.[1].schedule).toMatchObject({
    kind: "monthly",
    day_of_month: 31,
    weekday: undefined,
  });
}, 30000);

it.each(["daily", "weekly"] as const)(
  "loads a monthly date for editing and clears it when switching to %s",
  async (kind) => {
    const monthly = {
      ...plan,
      schedule: {
        kind: "monthly" as const,
        day_of_month: 31,
        time_of_day: "09:00",
        timezone: "Asia/Shanghai",
      },
    };
    vi.mocked(listEvalRunPlans).mockResolvedValue({
      entries: [monthly],
      total: 1,
      page: 1,
      limit: 20,
    });
    render(<EvalRunPlansPanel {...panelProps()} />);
    fireEvent.click(await screen.findByRole("button", { name: "运行计划操作：每日供应链回归" }));
    fireEvent.click(
      await screen.findByText("编辑", { selector: ".ant-dropdown-menu-title-content" }),
    );
    const drawer = screen.getByRole("dialog", { name: "编辑运行计划" });
    expect(
      within(drawer).getByText("31日", { selector: ".ant-select-selection-item" }),
    ).toBeTruthy();
    fireEvent.mouseDown(within(drawer).getByRole("combobox", { name: "执行周期" }));
    fireEvent.click(
      await screen.findByText(kind === "daily" ? "每天" : "每周", {
        selector: ".ant-select-item-option-content",
      }),
    );
    if (kind === "weekly") {
      fireEvent.mouseDown(within(drawer).getByRole("combobox", { name: "星期" }));
      fireEvent.click(
        await screen.findByText("周一", { selector: ".ant-select-item-option-content" }),
      );
    }
    await waitFor(() =>
      expect(within(drawer).getByRole("button", { name: /确\s*定/ })).not.toBeDisabled(),
    );
    fireEvent.click(within(drawer).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(updateEvalRunPlan).toHaveBeenCalled());
    expect(vi.mocked(updateEvalRunPlan).mock.lastCall?.slice(0, 2)).toEqual(["kn-1", "plan-1"]);
    expect(vi.mocked(updateEvalRunPlan).mock.lastCall?.[2].schedule).toMatchObject({
      kind,
      day_of_month: undefined,
      weekday: kind === "weekly" ? 1 : undefined,
    });
  },
  30000,
);

it("edits a paused plan while the execution service is unavailable", async () => {
  vi.mocked(previewM1RunSelection).mockRejectedValue(new Error("runner unavailable"));
  vi.mocked(listEvalRunPlans).mockResolvedValue({
    entries: [{ ...plan, enabled: false, next_run_at: undefined }],
    total: 1,
    page: 1,
    limit: 20,
  });
  render(
    <EvalRunPlansPanel
      networkId="kn-1"
      available
      canManage
      onCountChange={vi.fn()}
      onRunCreated={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "运行计划操作：每日供应链回归" }));
  fireEvent.click(
    await screen.findByText("编辑", { selector: ".ant-dropdown-menu-title-content" }),
  );
  const drawer = await screen.findByRole("dialog", { name: "编辑运行计划" });
  fireEvent.change(within(drawer).getByLabelText("计划名称"), {
    target: { value: "修改后的暂停计划" },
  });
  const confirm = within(drawer).getByRole("button", { name: /确\s*定/ });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(updateEvalRunPlan).toHaveBeenCalledWith(
      "kn-1",
      "plan-1",
      expect.objectContaining({ name: "修改后的暂停计划", enabled: false, revision: 1 }),
    ),
  );
  expect(previewM1RunSelection).not.toHaveBeenCalled();
  expect(runEvalRunPlanNow).not.toHaveBeenCalled();
});

it("shows the next trigger only when automatic execution is actually available and enabled", async () => {
  render(
    <EvalRunPlansPanel
      networkId="kn-1"
      available
      canManage
      automaticAvailable
      onCountChange={vi.fn()}
      onRunCreated={vi.fn()}
    />,
  );
  expect(await screen.findByText("每日供应链回归")).toBeTruthy();
  expect(screen.getByText("已启用")).toBeTruthy();
  expect(screen.queryByText("自动运行受阻")).toBeNull();
  expect(screen.getByText(new Date(plan.next_run_at!).toLocaleString())).toBeTruthy();
});

it("authorizes a paused plan as a separate user session before enabling it", async () => {
  vi.mocked(listEvalRunPlans).mockResolvedValue({
    entries: [{ ...plan, enabled: false }],
    total: 1,
    page: 1,
    limit: 20,
  });
  let finish!: () => void;
  vi.mocked(completeEvalRunPlanAuthorization).mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  render(<EvalRunPlansPanel {...panelProps()} automaticAvailable />);
  fireEvent.click(await screen.findByRole("button", { name: "运行计划操作：每日供应链回归" }));
  fireEvent.click(
    await screen.findByText("启用", { selector: ".ant-dropdown-menu-title-content" }),
  );
  await waitFor(() =>
    expect(completeEvalRunPlanAuthorization).toHaveBeenCalledWith("kn-1", "plan-1", {
      state: "state",
      code: "code",
    }),
  );
  expect(setEvalRunPlanEnabled).not.toHaveBeenCalled();
  await act(() => Promise.resolve(finish()));
  await waitFor(() =>
    expect(setEvalRunPlanEnabled).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ id: "plan-1" }),
      true,
    ),
  );
});

it("keeps a plan paused when its creator cancels authorization", async () => {
  vi.mocked(listEvalRunPlans).mockResolvedValue({
    entries: [{ ...plan, enabled: false }],
    total: 1,
    page: 1,
    limit: 20,
  });
  vi.mocked(authorizeInOAuthPopup).mockRejectedValueOnce(new Error("cancelled"));
  render(<EvalRunPlansPanel {...panelProps()} automaticAvailable />);
  fireEvent.click(await screen.findByRole("button", { name: "运行计划操作：每日供应链回归" }));
  fireEvent.click(
    await screen.findByText("启用", { selector: ".ant-dropdown-menu-title-content" }),
  );
  await waitFor(() => expect(authorizeInOAuthPopup).toHaveBeenCalled());
  expect(completeEvalRunPlanAuthorization).not.toHaveBeenCalled();
  expect(setEvalRunPlanEnabled).not.toHaveBeenCalled();
});
