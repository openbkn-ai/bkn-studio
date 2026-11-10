/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Modal } from "antd";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { EvalOverviewResourcesPanel } from "./EvalOverviewResourcesPanel";
import { evalLocales } from "./locales";
import {
  createM1Run,
  getM0Run,
  getM1RunCapabilities,
  getRunCaseDetail,
  getM0Evidence,
  previewM1RunSelection,
  type EvalOverview,
  type M0CaseDetail,
  type M0Run,
} from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  createM1Run: vi.fn(),
  getM0Run: vi.fn(),
  getM1RunCapabilities: vi.fn(),
  getRunCaseDetail: vi.fn(),
  getM0Evidence: vi.fn(),
  previewM1RunSelection: vi.fn(),
}));
vi.mock("./EvalCaseResult", () => ({
  EvalCaseResult: ({
    detail,
    technicalDetails,
    actions,
  }: {
    detail: M0CaseDetail;
    technicalDetails: React.ReactNode;
    actions: React.ReactNode;
  }) => (
    <div>
      <span>Frozen result {detail.id}</span>
      {actions}
      {technicalDetails}
    </div>
  ),
}));
Object.defineProperty(window, "matchMedia", {
  value: () => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
  configurable: true,
});
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getM1RunCapabilities).mockResolvedValue(true);
  vi.mocked(previewM1RunSelection).mockResolvedValue({
    case_count: 1,
    eligible: true,
    execution_mode: "platform",
    reasons: [],
  });
  vi.mocked(getM0Evidence).mockResolvedValue({ operation_status: "completed" });
  vi.mocked(getRunCaseDetail).mockImplementation((_kn, run, id) =>
    Promise.resolve({
      id,
      case_id: run === "run-a" ? "a" : "b",
      result_revision: 1,
      case_title: id,
      execution_status: "completed",
      quality_outcome: "fail",
      assertions: [],
      findings: [],
      evidence_refs: { operation_id: "operation-" + id },
    } as unknown as M0CaseDetail),
  );
  vi.mocked(getM0Run).mockImplementation((_kn, id) =>
    Promise.resolve({
      id,
      runner_type: "per_case",
      execution_status: "completed",
      result_revision: 1,
    } as M0Run),
  );
});
function data(): EvalOverview {
  const c = (id: string, run: string) => ({
    id,
    title: `Field ${id} · 类型不一致`,
    enabled: true,
    runnable: true,
    excluded: false,
    targets: [{ kind: "objectType", id: "material" }],
    target_names: ["物料"],
    status: "failed",
    latest_run_id: run,
    latest_case_run_id: `cr-${id}`,
    latest_result_revision: 1,
  });
  return {
    resource_details: [
      {
        kind: "objectType",
        id: "material",
        name: "物料",
        in_scope: true,
        status: "problem",
        case_count: 2,
        evaluated_cases: 2,
        passed_cases: 0,
        problem_cases: 2,
        review_cases: 0,
        pending_cases: 0,
        latest_run_id: "run-b",
      },
      {
        kind: "function",
        id: "leadtime",
        name: "标准交期",
        in_scope: true,
        status: "review",
        case_count: 1,
        evaluated_cases: 1,
        passed_cases: 0,
        problem_cases: 0,
        review_cases: 1,
        pending_cases: 0,
      },
    ],
    case_details: [c("a", "run-a"), c("b", "run-b")],
  } as EvalOverview;
}
const props = () => ({
  networkId: "kn-1",
  overview: data(),
  canRun: true,
  onRefresh: vi.fn(),
  onResource: vi.fn(),
  onCases: vi.fn(),
  onCreateCase: vi.fn(),
  onRepair: vi.fn(),
  onInspect: vi.fn(),
  onRunCreated: vi.fn(),
});

async function chooseAction(name: string, action: string) {
  fireEvent.click(screen.getByLabelText(`${name} 操作`, { selector: "button" }));
  const menu = await screen.findByRole("menu");
  fireEvent.click(within(menu).getByRole("menuitem", { name: action }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
}

it("hands a problem to AI repair with exact frozen failures and hides repair for read-only users", async () => {
  const p = props();
  const view = render(<EvalOverviewResourcesPanel {...p} />);
  await chooseAction("物料", "AI 修复");
  expect(p.onRepair).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "material",
      kind: "objectType",
      failures: expect.arrayContaining([
        expect.objectContaining({
          id: "a",
          latest_run_id: "run-a",
          latest_case_run_id: "cr-a",
          latest_result_revision: 1,
        }),
      ]) as unknown,
    }),
  );
  view.rerender(<EvalOverviewResourcesPanel {...p} canRun={false} />);
  fireEvent.click(screen.getByRole("button", { name: "物料 操作" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).queryByRole("menuitem", { name: "AI 修复" })).toBeNull();
});

it("always offers business scenarios and retains the selection across empty, failed and passed results", () => {
  const p = props();
  const view = render(<EvalOverviewResourcesPanel {...p} />);
  fireEvent.mouseDown(screen.getByLabelText("对象类型", { selector: '[role="combobox"]' }));
  fireEvent.click(screen.getByText("业务场景", { selector: ".ant-select-item-option-content" }));
  expect(screen.getByText("没有符合条件的资源或场景")).toBeTruthy();
  const scenario = {
    ...p.overview.case_details![0],
    id: "scenario-order",
    title: "订单支付场景",
    target_kind: "business_scenario",
    targets: [],
    target_names: [],
  };
  view.rerender(
    <EvalOverviewResourcesPanel
      {...p}
      overview={{ ...p.overview, case_details: [...p.overview.case_details!, scenario] }}
    />,
  );
  expect(screen.getByRole("button", { name: "订单支付场景" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "物料" })).toBeNull();
  view.rerender(
    <EvalOverviewResourcesPanel
      {...p}
      overview={{ ...p.overview, case_details: [{ ...scenario, status: "passed" }] }}
    />,
  );
  expect(screen.queryByRole("button", { name: "订单支付场景" })).toBeNull();
  expect(
    screen.getByLabelText("对象类型", { selector: '[role="combobox"]' }).closest(".ant-select")
      ?.textContent,
  ).toContain("业务场景");
  fireEvent.mouseDown(screen.getByLabelText("对象类型", { selector: '[role="combobox"]' }));
  expect(
    screen.getByText("业务场景", { selector: ".ant-select-item-option-content" }),
  ).toBeTruthy();
});

it("filters business scenarios, opens their frozen result and links to the case library instead of a resource", async () => {
  const p = props();
  p.overview.case_details!.push({
    ...p.overview.case_details![0],
    id: "scenario-failed",
    title: "订单支付金额一致",
    target_kind: "business_scenario",
    targets: [],
    target_names: [],
    latest_run_id: "run-scenario",
    latest_case_run_id: "cr-scenario",
    latest_result_revision: 3,
  });
  vi.mocked(getRunCaseDetail).mockResolvedValue({
    id: "cr-scenario",
    case_id: "scenario-failed",
    result_revision: 3,
    assertions: [],
    findings: [],
    evidence_refs: {},
  } as unknown as M0CaseDetail);
  render(<EvalOverviewResourcesPanel {...p} />);
  const filter = screen.getByLabelText("对象类型", { selector: '[role="combobox"]' });
  fireEvent.mouseDown(filter);
  fireEvent.click(screen.getByText("业务场景", { selector: ".ant-select-item-option-content" }));
  expect(screen.queryByRole("button", { name: "物料" })).toBeNull();
  const row = screen
    .getByText("订单支付金额一致", { selector: "button > span" })
    .closest("button")!
    .closest("tr")!;
  expect(within(row).queryByRole("button", { name: "前往资源" })).toBeNull();
  await chooseAction("订单支付金额一致", "前往用例库");
  expect(p.onCases).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "scenario", id: "scenario-failed" }),
  );
  await chooseAction("订单支付金额一致", "查看问题");
  const drawer = (await screen.findByText("订单支付金额一致 · 场景评测明细")).closest<HTMLElement>(
    '[role="dialog"]',
  )!;
  expect(within(drawer).queryByRole("button", { name: "前往资源" })).toBeNull();
  fireEvent.click(
    within(drawer).getByText("查看结果", { selector: "button > span" }).closest("button")!,
  );
  expect(await within(drawer).findByText("Frozen result cr-scenario")).toBeTruthy();
  expect(getRunCaseDetail).toHaveBeenCalledWith(
    "kn-1",
    "run-scenario",
    "cr-scenario",
    3,
    expect.any(AbortSignal),
  );
  fireEvent.click(
    within(drawer).getByText("查看完整运行", { selector: "button > span" }).closest("button")!,
  );
  expect(p.onInspect).toHaveBeenCalledWith(
    expect.objectContaining({ id: "run-scenario" }),
    "cr-scenario",
  );
  expect(p.onResource).not.toHaveBeenCalled();
}, 15_000);

it("defaults to issues and provides three categories without an all or passed category", async () => {
  const p = props();
  p.overview.resource_details?.push(
    {
      ...p.overview.resource_details[0],
      id: "passed",
      name: "已通过资源",
      status: "passed",
      problem_cases: 0,
    },
    {
      ...p.overview.resource_details[0],
      id: "pending",
      name: "待执行资源",
      status: "uncovered",
      problem_cases: 0,
    },
    { ...p.overview.resource_details[0], id: "excluded", name: "已排除资源", in_scope: false },
  );
  render(<EvalOverviewResourcesPanel {...p} />);
  expect(screen.getByRole("button", { name: "物料" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "标准交期" })).toBeNull();
  expect(screen.queryByRole("button", { name: "待执行资源" })).toBeNull();
  for (const name of ["已通过资源", "已排除资源"]) {
    expect(screen.queryByRole("button", { name })).toBeNull();
  }
  const categories = screen.getByRole("group", { name: "筛选资源评测结果" });
  expect(within(categories).getAllByRole("button")).toHaveLength(3);
  expect(within(categories).getByRole("button", { name: /存在问题\s*1/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(within(categories).queryByRole("button", { name: /检查通过/ })).toBeNull();
  expect(within(categories).queryByRole("button", { name: /全部/ })).toBeNull();
  expect(
    screen
      .getAllByRole("columnheader")
      .slice(0, 3)
      .map((cell) => cell.textContent),
  ).toEqual(["评测对象", "操作", "对象类型"]);
  await chooseAction("物料", "前往资源");
  expect(p.onResource).toHaveBeenCalledWith(expect.objectContaining({ id: "material" }));
  fireEvent.click(screen.getByRole("button", { name: "刷新资源评测结果" }));
  expect(p.onRefresh).toHaveBeenCalledOnce();
});

function pendingResourceProps() {
  const p = props();
  p.overview.resource_details = [
    {
      ...p.overview.resource_details![0],
      id: "supplier",
      name: "供应商",
      status: "uncovered",
      case_count: 0,
      evaluated_cases: 0,
      problem_cases: 0,
    },
    {
      ...p.overview.resource_details![0],
      id: "order",
      name: "订单",
      status: "not_run",
      case_count: 1,
      evaluated_cases: 0,
      problem_cases: 0,
    },
  ];
  p.overview.case_details = [];
  return p;
}

it("offers case creation for an uncovered resource", async () => {
  const p = pendingResourceProps();
  render(<EvalOverviewResourcesPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /未完成评测\s*2/ }));
  const supplier = screen.getByRole("button", { name: "供应商" }).closest("tr")!;
  expect(within(supplier).getByText("未配置用例")).toBeTruthy();
  expect(within(supplier).queryByRole("button", { name: "查看结果" })).toBeNull();
  expect(within(supplier).queryByRole("button", { name: "前往用例库" })).toBeNull();
  expect(within(supplier).queryByText("0", { exact: true })).toBeNull();
  await chooseAction("供应商", "新建用例");
  expect(p.onCreateCase).toHaveBeenCalledWith(expect.objectContaining({ id: "supplier" }));
});

it("offers case lookup before the first result without opening a result drawer", async () => {
  const p = pendingResourceProps();
  render(<EvalOverviewResourcesPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /未完成评测\s*2/ }));
  const order = screen.getByRole("button", { name: "订单" }).closest("tr")!;
  expect(within(order).queryByRole("button", { name: "查看结果" })).toBeNull();
  await chooseAction("订单", "查看用例");
  expect(p.onCases).toHaveBeenCalledWith(expect.objectContaining({ id: "order" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("removes case creation when resource access changes to read-only", async () => {
  const p = pendingResourceProps();
  const view = render(<EvalOverviewResourcesPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /未完成评测\s*2/ }));
  view.rerender(<EvalOverviewResourcesPanel {...p} canRun={false} />);
  fireEvent.click(screen.getByRole("button", { name: "供应商 操作" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).queryByRole("menuitem", { name: "新建用例" })).toBeNull();
  expect(within(menu).getByRole("menuitem", { name: "前往资源" })).toBeTruthy();
});

it("filters the original result categories without bringing back passed resources", () => {
  const p = props();
  p.overview.resource_details?.push(
    {
      ...p.overview.resource_details[0],
      id: "pending",
      name: "待执行资源",
      status: "uncovered",
      problem_cases: 0,
    },
    {
      ...p.overview.resource_details[0],
      id: "passed",
      name: "已通过资源",
      status: "passed",
      problem_cases: 0,
    },
  );
  render(<EvalOverviewResourcesPanel {...p} />);
  const categories = screen.getByRole("group", { name: "筛选资源评测结果" });
  for (const [category, name] of [
    ["存在问题", "物料"],
    ["待核查", "标准交期"],
    ["未完成评测", "待执行资源"],
  ]) {
    const button = within(categories).getByRole("button", { name: new RegExp(`${category}\\s*1`) });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name })).toBeTruthy();
    for (const other of ["物料", "标准交期", "待执行资源"].filter((value) => value !== name)) {
      expect(screen.queryByRole("button", { name: other })).toBeNull();
    }
    expect(screen.queryByRole("button", { name: "已通过资源" })).toBeNull();
  }
  expect(within(categories).queryByRole("button", { name: /全部/ })).toBeNull();
  fireEvent.click(within(categories).getByRole("button", { name: /存在问题\s*1/ }));
  expect(screen.getByRole("button", { name: "物料" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "已通过资源" })).toBeNull();
});

it("switches to the problem category when navigating from the problem metric", () => {
  const p = props();
  const view = render(<EvalOverviewResourcesPanel {...p} problemFocus={0} />);
  fireEvent.click(screen.getByRole("button", { name: /待核查\s*1/ }));
  expect(screen.getByRole("button", { name: "标准交期" })).toBeTruthy();
  view.rerender(<EvalOverviewResourcesPanel {...p} problemFocus={1} />);
  expect(screen.getByRole("button", { name: /存在问题\s*1/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.queryByRole("button", { name: "标准交期" })).toBeNull();
});

it("searches review resources and issue fields while keeping passed resources hidden", () => {
  const p = props();
  p.overview.resource_details?.push({
    ...p.overview.resource_details[0],
    id: "passed",
    name: "已通过资源",
    status: "passed",
    problem_cases: 0,
  });
  render(<EvalOverviewResourcesPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /待核查\s*1/ }));
  const search = screen.getByPlaceholderText("搜索资源、场景名称或问题字段");
  fireEvent.change(search, { target: { value: "标准交期" } });
  expect(screen.getByRole("button", { name: "标准交期" })).toBeTruthy();
  fireEvent.change(search, { target: { value: "已通过资源" } });
  expect(screen.getByText("没有符合条件的资源或场景")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "已通过资源" })).toBeNull();
  fireEvent.change(search, { target: { value: "Field a" } });
  fireEvent.click(screen.getByRole("button", { name: /存在问题\s*1/ }));
  expect(screen.getByRole("button", { name: "物料" })).toBeTruthy();
});

it("keeps the category switcher available when the selected category has no resources", () => {
  const p = props();
  p.overview.resource_details = p.overview.resource_details?.filter((row) => row.id === "material");
  render(<EvalOverviewResourcesPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /待核查\s*0/ }));
  expect(screen.getByText("该分类下暂无资源或场景")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /存在问题\s*1/ }));
  expect(screen.getByRole("button", { name: "物料" })).toBeTruthy();
});

it("shows an empty state once all resources pass", () => {
  const p = props();
  const view = render(<EvalOverviewResourcesPanel {...p} />);
  view.rerender(
    <EvalOverviewResourcesPanel
      {...p}
      overview={{
        ...p.overview,
        resource_details: p.overview.resource_details?.map((row) => ({
          ...row,
          problem_cases: 0,
          review_cases: 0,
          status: "passed" as const,
        })),
        case_details: p.overview.case_details?.map((row) => ({
          ...row,
          status: "passed" as const,
        })),
      }}
    />,
  );
  expect(screen.getByText("暂无需要关注的资源或场景")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "查看全部资源" })).toBeNull();
  expect(screen.queryByRole("button", { name: "物料" })).toBeNull();
});

it("shows issues across different runs and loads only the selected case with its frozen revision", async () => {
  const p = props();
  render(<EvalOverviewResourcesPanel {...p} />);
  await chooseAction("物料", "查看问题");
  const drawer = await screen.findByRole("dialog", { name: "物料 · 资源评测明细" });
  expect(within(drawer).getByText("Field a · 类型不一致")).toBeTruthy();
  expect(within(drawer).getByText("Field b · 类型不一致")).toBeTruthy();
  expect(getRunCaseDetail).not.toHaveBeenCalled();
  fireEvent.click(within(drawer).getAllByRole("button", { name: "查看结果" })[0]);
  expect(await within(drawer).findByText("Frozen result cr-a")).toBeTruthy();
  expect(getRunCaseDetail).toHaveBeenCalledWith(
    "kn-1",
    "run-a",
    "cr-a",
    1,
    expect.any(AbortSignal),
  );
  expect(getM0Evidence).not.toHaveBeenCalled();
  fireEvent.click(within(drawer).getByText("工具调用记录", { exact: true }));
  await waitFor(() => expect(getM0Evidence).toHaveBeenCalledWith("operation", "operation-cr-a"));
  fireEvent.click(within(drawer).getByRole("button", { name: "查看完整运行" }));
  expect(p.onInspect).toHaveBeenCalledWith(expect.objectContaining({ id: "run-a" }), "cr-a");
});

it("previews only selected current cases and waits for confirmation before creating a reassessment", async () => {
  const p = props();
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  vi.mocked(createM1Run).mockResolvedValue({ id: "new-run" } as M0Run);
  render(<EvalOverviewResourcesPanel {...p} />);
  await chooseAction("物料", "查看问题");
  const d = await screen.findByRole("dialog", { name: "物料 · 资源评测明细" });
  const boxes = within(d).getAllByRole("checkbox");
  fireEvent.click(boxes[2]);
  fireEvent.click(within(d).getByRole("button", { name: /重新评测（1）/ }));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(previewM1RunSelection).toHaveBeenCalledWith("kn-1", { kind: "cases", case_ids: ["a"] });
  expect(createM1Run).not.toHaveBeenCalled();
  await confirm.mock.calls[0][0].onOk?.();
  expect(createM1Run).toHaveBeenCalledWith(
    "kn-1",
    { kind: "cases", case_ids: ["a"] },
    expect.any(String),
  );
  expect(p.onRunCreated).toHaveBeenCalledWith({ id: "new-run" });
  confirm.mockRestore();
});

it("does not open a confirmation or create a run when the resource drawer closes during preflight", async () => {
  let resolve!: (value: import("./m0-run.service").M1RunPreview) => void;
  vi.mocked(previewM1RunSelection).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  const view = render(<EvalOverviewResourcesPanel {...props()} />);
  await chooseAction("物料", "查看问题");
  const drawer = await screen.findByRole("dialog", { name: "物料 · 资源评测明细" });
  fireEvent.click(within(drawer).getByRole("button", { name: /重新评测（2）/ }));
  await waitFor(() => expect(previewM1RunSelection).toHaveBeenCalled());
  view.unmount();
  resolve({ case_count: 2, eligible: true, execution_mode: "platform", reasons: [] });
  await new Promise((r) => setTimeout(r, 0));
  expect(confirm).not.toHaveBeenCalled();
  expect(createM1Run).not.toHaveBeenCalled();
  confirm.mockRestore();
});

it("retries a failed result read without opening another drawer", async () => {
  vi.mocked(getRunCaseDetail).mockRejectedValueOnce(new Error("dependency unavailable"));
  render(<EvalOverviewResourcesPanel {...props()} />);
  await chooseAction("物料", "查看问题");
  const drawer = await screen.findByRole("dialog", { name: "物料 · 资源评测明细" });
  fireEvent.click(within(drawer).getAllByRole("button", { name: "查看结果" })[0]);
  const retry = await within(drawer).findByRole("button", { name: /重\s*试/ });
  fireEvent.click(retry);
  expect(await within(drawer).findByText("Frozen result cr-a")).toBeTruthy();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

it("opens AI repair from the detail footer using only selected failed cases and closes the drawer", async () => {
  const p = props();
  render(<EvalOverviewResourcesPanel {...p} />);
  await chooseAction("物料", "查看问题");
  const drawer = await screen.findByRole("dialog", { name: "物料 · 资源评测明细" });
  fireEvent.click(within(drawer).getAllByRole("checkbox")[2]);
  fireEvent.click(within(drawer).getByRole("button", { name: "AI 修复" }));
  expect(p.onRepair).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "material",
      kind: "objectType",
      failures: [
        expect.objectContaining({
          id: "a",
          latest_run_id: "run-a",
          latest_case_run_id: "cr-a",
          latest_result_revision: 1,
        }),
      ],
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "物料 · 资源评测明细" })).toBeNull(),
  );
  expect(createM1Run).not.toHaveBeenCalled();
});

it("disables footer AI repair when no failed case is selected", async () => {
  const p = props();
  render(<EvalOverviewResourcesPanel {...p} />);
  await chooseAction("物料", "查看问题");
  const drawer = (await screen.findByText("物料 · 资源评测明细")).closest<HTMLElement>(
    '[role="dialog"]',
  )!;
  fireEvent.click(within(drawer).getAllByRole("checkbox")[0]);
  expect(
    within(drawer).getByText("AI 修复", { selector: "button > span" }).closest("button"),
  ).toBeDisabled();
  expect(p.onRepair).not.toHaveBeenCalled();
});

it("hides footer AI repair without permission", async () => {
  const p = props();
  render(<EvalOverviewResourcesPanel {...p} canRun={false} />);
  await chooseAction("物料", "查看问题");
  const drawer = (await screen.findByText("物料 · 资源评测明细")).closest<HTMLElement>(
    '[role="dialog"]',
  )!;
  expect(within(drawer).queryByRole("button", { name: "AI 修复" })).toBeNull();
  expect(p.onRepair).not.toHaveBeenCalled();
});

it("explains missing readonly authorization instead of only asking for a new case", () => {
  const p = props();
  p.overview.resource_details = [
    {
      kind: "action",
      id: "message",
      name: "消息推送",
      in_scope: true,
      status: "uncovered",
      case_count: 0,
      evaluated_cases: 0,
      passed_cases: 0,
      problem_cases: 0,
      pending_cases: 0,
      uncovered_reason: "未获得只读执行授权；请先配置隔离接收方。",
    },
  ];
  p.overview.case_details = [];
  render(<EvalOverviewResourcesPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /未完成评测\s*1/ }));
  expect(screen.getByText("未获得只读执行授权；请先配置隔离接收方。")).toBeTruthy();
});
