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

import { EvalMultiRunPanel } from "./EvalMultiRunPanel";
import { evalLocales } from "./locales";
import {
  getM0Evidence,
  getM0Run,
  getRunCaseDetail,
  listRunCases,
  type M0CaseDetail,
} from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  cancelM0Run: vi.fn(),
  getM0Evidence: vi.fn(),
  getM0OperationAttempt: vi.fn(),
  getM0Run: vi.fn(),
  getRunCaseDetail: vi.fn(),
  getEvalCaseDefinition: vi.fn().mockRejectedValue(new Error("definition unavailable")),
  listRunCases: vi.fn(),
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

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getM0Run).mockResolvedValue({
    id: "run-1",
    execution_status: "completed",
    phase: null,
    quality_outcome: "pass",
    progress: { planned_cases: 2, completed_cases: 2 },
  });
  vi.mocked(getM0Evidence).mockResolvedValue({
    interaction_id: "interaction-1",
    status: "completed",
  });
  vi.mocked(listRunCases).mockResolvedValue({
    entries: [
      {
        id: "case-run-1",
        case_id: "case-1",
        case_title: "物料编码唯一且必填",
        case_version_id: "case-1@1",
        execution_status: "completed",
        quality_outcome: "pass",
        duration_ms: 123,
      },
      {
        id: "case-run-2",
        case_id: "case-2",
        case_title: "采购订单必须关联供应商",
        case_version_id: "case-2@1",
        execution_status: "completed",
        quality_outcome: "fail",
        duration_ms: 234,
      },
    ],
    total: 2,
    next_cursor: null,
  });
  vi.mocked(getRunCaseDetail).mockImplementation((_networkId, _runId, caseRunId) =>
    Promise.resolve({
      id: caseRunId,
      case_id: caseRunId === "case-run-1" ? "case-1" : "case-2",
      case_title: caseRunId === "case-run-1" ? "物料编码唯一且必填" : "采购订单必须关联供应商",
      case_version_id: caseRunId === "case-run-1" ? "case-1@1" : "case-2@1",
      case_version: 1,
      execution_status: "completed",
      quality_outcome: caseRunId === "case-run-1" ? "pass" : "fail",
      duration_ms: 123,
      observation: { normalized_output: { answer: "14 天" }, evidence_status: "complete" },
      evidence_refs: {
        interaction_id: "interaction-1",
        operation_id: "operation-1",
        receipt_id: "receipt-1",
      },
      assertions: [],
      findings: [],
    }),
  );
});

it("shows a result needing human interpretation without a review action", async () => {
  vi.mocked(getM0Run).mockResolvedValue({
    id: "run-1",
    execution_status: "completed",
    phase: null,
    quality_outcome: "review_required",
    progress: { planned_cases: 1, completed_cases: 1 },
  });
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  expect(await screen.findByText("需人工判断")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "查看并判定" })).toBeNull();
});

it("keeps declaration checks separate from real execution results", async () => {
  vi.mocked(getM0Run).mockResolvedValue({
    id: "run-declaration",
    execution_status: "completed",
    phase: null,
    quality_outcome: "pass",
    assessment_scope: "declaration",
    progress: { planned_cases: 1, completed_cases: 1 },
    case_counts: {
      total: 1,
      passed: 1,
      failed: 0,
      inconclusive: 0,
      review_required: 0,
      execution_failed: 0,
      cancelled: 0,
      pending: 0,
      runtime: {
        total: 0,
        passed: 0,
        failed: 0,
        inconclusive: 0,
        review_required: 0,
        execution_failed: 0,
        cancelled: 0,
        pending: 0,
      },
      declaration: {
        total: 1,
        passed: 1,
        failed: 0,
        inconclusive: 0,
        review_required: 0,
        execution_failed: 0,
        cancelled: 0,
        pending: 0,
      },
    },
  });
  vi.mocked(listRunCases).mockResolvedValue({
    entries: [
      {
        id: "case-run-declaration",
        case_id: "case-declaration",
        case_title: "声明检查",
        case_version_id: "case-declaration@1",
        execution_status: "completed",
        quality_outcome: "pass",
        assessment_scope: "declaration",
        duration_ms: 1,
      },
    ],
    total: 1,
    next_cursor: null,
  });

  render(<EvalMultiRunPanel networkId="kn-1" runId="run-declaration" />);

  expect(
    await screen.findByText("本次结果仅验证配置声明，不代表真实能力已经执行或业务结果正确。"),
  ).toBeTruthy();
  expect(screen.getAllByText("声明检查通过").length).toBeGreaterThan(0);
  expect(screen.getByText(/声明检查通过/, { selector: "li" }).textContent).toContain("1 / 1");
  expect(screen.queryByText("真实运行通过", { selector: "li" })).toBeNull();
});

it("lets a business user identify and inspect each Case by its approved title", async () => {
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  expect(screen.getByRole("button", { name: "刷新结果" })).toBeTruthy();
  expect(screen.getByText("运行摘要")).toBeTruthy();
  expect(await screen.findByRole("button", { name: "物料编码唯一且必填" })).toBeTruthy();
  expect(screen.queryByText("运行 ID", { exact: true })).toBeNull();
  expect(screen.queryByText("run-1", { exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "采购订单必须关联供应商" }));
  await waitFor(() => expect(screen.getByText("用例详情 · 采购订单必须关联供应商")).toBeTruthy());
  expect(getRunCaseDetail).toHaveBeenCalledWith(
    "kn-1",
    "run-1",
    "case-run-2",
    undefined,
    expect.any(AbortSignal),
  );
});

it("opens the specific CaseRun from a Finding evidence link", async () => {
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" preferredCaseRunId="case-run-2" />);
  expect(await screen.findByText("用例详情 · 采购订单必须关联供应商")).toBeTruthy();
  expect(getRunCaseDetail).toHaveBeenCalledWith(
    "kn-1",
    "run-1",
    "case-run-2",
    undefined,
    expect.any(AbortSignal),
  );
});

it("shows business execution details and loads technical records only when expanded", async () => {
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  expect(getM0Evidence).not.toHaveBeenCalled();
  expect(screen.getByText("执行详情")).toBeTruthy();
  expect(screen.getByText("14 天")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "本次操作" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "执行详情" }));
  await waitFor(() => expect(getM0Evidence).toHaveBeenCalledWith("operation", "operation-1"));
  const region = screen.getByRole("region", { name: "执行证据" });
  expect((await within(region).findAllByText(/已完成/)).length).toBeGreaterThan(0);
  expect(screen.queryByText("interaction-1")).toBeNull();
  expect(screen.queryByText("operation-1")).toBeNull();
  expect(within(region).queryByText("Trace 引用与标识")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /原始材料/ }));
  const raw = screen.getByRole("region", { name: "原始材料" });
  expect(within(raw).getByRole("region", { name: "Trace 引用与标识" })).toHaveTextContent(
    "operation-1",
  );
  fireEvent.click(within(region).getByText("原始证据 JSON"));
  expect(await within(region).findByText(/"status": "completed"/)).toBeTruthy();
});

it("reads receipts and interactions on demand inside technical details", async () => {
  vi.mocked(getM0Evidence).mockImplementation((kind) =>
    Promise.resolve(
      kind === "receipt"
        ? { receipt_status: "completed", evidence_durability: "durable", required: true }
        : { status: "completed", tool_name: "query_object_instance" },
    ),
  );
  render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      preferredCaseRunId="case-run-1"
      initialDetailTab="evidence"
    />,
  );
  await waitFor(() => expect(getM0Evidence).toHaveBeenCalledTimes(1));
  const region = screen.getByLabelText("执行证据", { selector: "section" });
  fireEvent.click(within(region).getByText("调用回执", { exact: true }));
  expect(await within(region).findByText("已持久化")).toBeTruthy();
  expect(getM0Evidence).toHaveBeenLastCalledWith("receipt", "receipt-1");
  fireEvent.click(within(region).getByText("执行会话", { exact: true }));
  await waitFor(() =>
    expect(getM0Evidence).toHaveBeenLastCalledWith("interaction", "interaction-1"),
  );
  expect(getM0Evidence).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole("button", { name: "执行凭据" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "评测结果" }));
  expect(screen.getByText("14 天")).toBeTruthy();
});

it("does not request Trace records when none exist and still shows the business output", async () => {
  const original = await vi.mocked(getRunCaseDetail).getMockImplementation()!(
    "kn-1",
    "run-1",
    "case-run-1",
  );
  vi.mocked(getRunCaseDetail).mockResolvedValue({ ...original, evidence_refs: {} });
  render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      preferredCaseRunId="case-run-1"
      initialDetailTab="evidence"
    />,
  );
  expect(await screen.findByText("本次没有可读取的 Trace 引用。")).toBeTruthy();
  expect(getM0Evidence).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "评测结果" }));
  expect(screen.getByText("14 天")).toBeTruthy();
});

it("ignores a stale technical response after selecting another case", async () => {
  let resolveOld!: (value: unknown) => void;
  vi.mocked(getM0Evidence).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    }),
  );
  render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      preferredCaseRunId="case-run-1"
      initialDetailTab="evidence"
    />,
  );
  await waitFor(() => expect(getM0Evidence).toHaveBeenCalledWith("operation", "operation-1"));
  fireEvent.click(screen.getByRole("button", { name: /采购订单必须关联供应商/ }));
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  expect(screen.getByRole("tab", { name: "执行详情" })).toHaveAttribute("aria-selected", "false");
  await act(() => {
    resolveOld({ tool_name: "stale-tool-from-first-case" });

    return Promise.resolve();
  });
  fireEvent.click(screen.getByRole("tab", { name: "执行详情" }));
  await waitFor(() => expect(getM0Evidence).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("stale-tool-from-first-case")).toBeNull();
});

it("filters failed Cases on the server and preserves the filter across cursor pages", async () => {
  const fixture = await vi.mocked(listRunCases)("kn-1", "run-1");
  vi.mocked(listRunCases).mockImplementation((_kn, _run, cursor, outcome) =>
    Promise.resolve({
      entries: outcome === "fail" ? [fixture.entries[1]] : fixture.entries,
      total: outcome === "fail" ? 22 : 25,
      next_cursor: cursor ? null : "failure-cursor",
    }),
  );
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" initialOutcome="fail" />);
  expect(await screen.findByText("用例详情 · 采购订单必须关联供应商")).toBeTruthy();
  expect(listRunCases).toHaveBeenCalledWith(
    "kn-1",
    "run-1",
    undefined,
    "fail",
    expect.any(AbortSignal),
    undefined,
  );
  expect(screen.queryByRole("button", { name: "物料编码唯一且必填" })).toBeNull();
  fireEvent.click(screen.getByTitle(/Next Page|下一页/));
  await waitFor(() =>
    expect(listRunCases).toHaveBeenCalledWith(
      "kn-1",
      "run-1",
      "failure-cursor",
      "fail",
      expect.any(AbortSignal),
      undefined,
    ),
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "用例评测结果筛选" }));
  fireEvent.click(
    await screen.findByText("全部结果", { selector: ".ant-select-item-option-content" }),
  );
  await waitFor(() =>
    expect(listRunCases).toHaveBeenLastCalledWith(
      "kn-1",
      "run-1",
      undefined,
      undefined,
      expect.any(AbortSignal),
      undefined,
    ),
  );
  expect(await screen.findByText("用例详情 · 物料编码唯一且必填")).toBeTruthy();
});

it("reruns the selected failed Case from its diagnostic detail", async () => {
  const onRerun = vi.fn();
  const onViewCase = vi.fn();
  render(
    <EvalMultiRunPanel networkId="kn-1" runId="run-1" onRerun={onRerun} onViewCase={onViewCase} />,
  );
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  fireEvent.click(screen.getByRole("button", { name: "采购订单必须关联供应商" }));
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  const actions = screen
    .getByText("查看当前用例")
    .closest(".ant-tabs-extra-content") as HTMLElement;
  expect(actions).not.toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "执行详情" }));
  fireEvent.click(within(actions).getByText("查看当前用例"));
  expect(onViewCase).toHaveBeenCalledWith(expect.objectContaining({ case_id: "case-2" }));
  fireEvent.click(within(actions).getByText("重新运行"));
  expect(onRerun).toHaveBeenCalledWith(
    expect.objectContaining({ case_id: "case-2", case_version: 1 }),
  );
});

it("reads historical run metadata once and only loads detail when selecting another Case", async () => {
  const onSettled = vi.fn();
  const { rerender } = render(
    <EvalMultiRunPanel networkId="kn-1" runId="run-1" onSettled={onSettled} />,
  );
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  expect(getM0Run).toHaveBeenCalledTimes(1);
  expect(listRunCases).toHaveBeenCalledTimes(1);
  rerender(<EvalMultiRunPanel networkId="kn-1" runId="run-1" onSettled={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "采购订单必须关联供应商" }));
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  fireEvent.click(screen.getByRole("button", { name: "采购订单必须关联供应商" }));
  expect(getM0Run).toHaveBeenCalledTimes(1);
  expect(listRunCases).toHaveBeenCalledTimes(1);
  expect(getRunCaseDetail).toHaveBeenCalledTimes(2);
  expect(onSettled).not.toHaveBeenCalled();
});

it("notifies completion only after an observed running state", async () => {
  const done = await vi.mocked(getM0Run)("kn-1", "run-1");
  let completed = false;
  vi.mocked(getM0Run)
    .mockClear()
    .mockImplementation(() =>
      Promise.resolve(
        completed ? done : { ...done, execution_status: "running", quality_outcome: null },
      ),
    );
  const onSettled = vi.fn();
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" onSettled={onSettled} />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  expect(onSettled).not.toHaveBeenCalled();
  completed = true;
  fireEvent.click(screen.getByRole("button", { name: "刷新结果" }));
  await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
  const reads = vi.mocked(getM0Run).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "刷新结果" }));
  await waitFor(() => expect(getM0Run).toHaveBeenCalledTimes(reads + 1));
  expect(onSettled).toHaveBeenCalledTimes(1);
});

it("cancels a stale Case detail when the selection changes", async () => {
  const first = await vi.mocked(getRunCaseDetail)("kn-1", "run-1", "case-run-1");
  let resolveFirst: (value: M0CaseDetail) => void = () => {};
  vi.mocked(getRunCaseDetail)
    .mockClear()
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  await waitFor(() => expect(getRunCaseDetail).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(getRunCaseDetail).mock.calls[0][4];
  fireEvent.click(await screen.findByRole("button", { name: "采购订单必须关联供应商" }));
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    resolveFirst(first);
    await Promise.resolve();
  });
  expect(screen.queryByText("用例详情 · 物料编码唯一且必填")).toBeNull();
  expect(getM0Run).toHaveBeenCalledTimes(1);
});

it("keeps the outcome filter for one Case and uses refreshed counts in the compact summary", async () => {
  const run = await vi.mocked(getM0Run)("kn-1", "run-1");
  const cases = await vi.mocked(listRunCases)("kn-1", "run-1");
  const counts = {
    total: 1,
    passed: 1,
    failed: 0,
    inconclusive: 0,
    review_required: 0,
    execution_failed: 0,
    cancelled: 0,
    pending: 0,
  };
  vi.mocked(getM0Run).mockResolvedValue({
    ...run,
    progress: { planned_cases: 1, completed_cases: 1 },
    case_counts: counts,
  });
  vi.mocked(listRunCases).mockResolvedValue({ ...cases, entries: [cases.entries[0]], total: 1 });
  render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      initialOutcome="pass"
      caseCounts={{ ...counts, total: 2, passed: 0, failed: 2 }}
    />,
  );
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  expect(screen.getByRole("combobox", { name: "用例评测结果筛选" })).toBeTruthy();
  const summary = screen.getByRole("region", { name: "运行摘要" });
  expect(within(summary).getByRole("list", { name: "用例统计" })).toHaveTextContent("通过 1 / 1");
  expect(within(summary).getByRole("list", { name: "用例统计" })).toHaveTextContent("未通过 0");
});

it("keeps a way to clear a filter that hides the only Case", async () => {
  const run = await vi.mocked(getM0Run)("kn-1", "run-1");
  const cases = await vi.mocked(listRunCases)("kn-1", "run-1");
  vi.mocked(getM0Run).mockResolvedValue({
    ...run,
    progress: { planned_cases: 1, completed_cases: 1 },
  });
  vi.mocked(listRunCases).mockImplementation((_kn, _run, _cursor, outcome) =>
    Promise.resolve({
      entries: outcome ? [] : [cases.entries[0]],
      total: outcome ? 0 : 1,
      next_cursor: null,
    }),
  );
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" initialOutcome="fail" />);
  fireEvent.mouseDown(await screen.findByRole("combobox", { name: "用例评测结果筛选" }));
  fireEvent.click(
    await screen.findByText("全部结果", { selector: ".ant-select-item-option-content" }),
  );
  expect(await screen.findByText("用例详情 · 物料编码唯一且必填")).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "用例评测结果筛选" })).toBeTruthy();
});

it("shows an actionable conclusion before checks and keeps technical data collapsed", async () => {
  const fixture = await vi.mocked(getRunCaseDetail)("kn-1", "run-1", "case-run-1");
  vi.mocked(getRunCaseDetail).mockResolvedValue({
    ...fixture,
    quality_outcome: "inconclusive",
    input_spec: { question: "物料交期是多少？", arguments: { material_code: "606-000989" } },
    observation: { ...fixture.observation, failure_class: "EVIDENCE" },
    assertions: [
      { id: "schema", type: "json_schema", outcome: "pass" },
      {
        id: "evidence",
        type: "evidence_complete",
        outcome: "inconclusive",
        message: "complete evidence is unavailable",
      },
    ],
    findings: [{ id: "finding-1", category: "EVIDENCE", title: "EVAL_INCONCLUSIVE" }],
  });
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  const section = await screen.findByRole(
    "region",
    { name: "用例详情 · 物料编码唯一且必填" },
    { timeout: 10000 },
  );
  const conclusion = within(section).getByRole("region", { name: "本次用例结论" });
  const checks = within(section).getByRole("region", { name: "判定明细" });
  expect(
    conclusion.compareDocumentPosition(checks) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(within(conclusion).getByText("缺少完整执行证据，无法确认本次执行过程。")).toBeTruthy();
  expect(within(checks).getAllByRole("row")[1]).toHaveTextContent("执行证据完整性");
  expect(within(section).queryByText("EVAL_INCONCLUSIVE")).toBeNull();
  expect(within(section).getByText("物料交期是多少？")).toBeTruthy();
  fireEvent.click(within(section).getByRole("tab", { name: "执行详情" }));
  expect(within(section).getAllByText("物料交期是多少？").length).toBeGreaterThan(0);
  fireEvent.click(within(section).getByRole("button", { name: /原始材料/ }));
  expect(within(section).getByText(/"material_code": "606-000989"/)).toBeTruthy();
  expect(within(section).getByText(/"answer": "14 天"/)).toBeTruthy();
});

it("preserves the external participant final answer alongside deterministic results", async () => {
  const original = vi.mocked(getRunCaseDetail).getMockImplementation()!;
  vi.mocked(getRunCaseDetail).mockImplementation(async (...args) => {
    const detail = await original(...args);
    return {
      ...detail,
      observation: {
        ...detail.observation,
        source_kind: "external_submission",
        answer: "毛利率为 20%，计算过程为 (100 - 80) / 100。",
      },
    };
  });
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  expect(await screen.findByText("智能体最终回答")).toBeTruthy();
  expect(screen.getByText("毛利率为 20%，计算过程为 (100 - 80) / 100。")).toBeTruthy();
});

it("opens a comparison Case outside the initial page without fetching every page", async () => {
  render(
    <EvalMultiRunPanel networkId="kn-1" runId="run-1" preferredCaseRunId="case-run-off-page" />,
  );
  await waitFor(() =>
    expect(getRunCaseDetail).toHaveBeenCalledWith(
      "kn-1",
      "run-1",
      "case-run-off-page",
      undefined,
      expect.any(AbortSignal),
    ),
  );
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  expect(listRunCases).toHaveBeenCalledTimes(1);
});

it("warns when a matrix revision differs from the current Run detail", async () => {
  vi.mocked(getM0Run).mockResolvedValue({
    id: "run-1",
    result_revision: 2,
    execution_status: "completed",
    phase: null,
    quality_outcome: "pass",
    progress: { planned_cases: 2, completed_cases: 2 },
  });
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" comparedResultRevision={1} />);
  expect(await screen.findByText(/运行详情已有新结果（v2），与矩阵固定的 v1 不同/)).toBeTruthy();
});

it("opens technical details directly from a comparison evidence link", async () => {
  render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      preferredCaseRunId="case-run-1"
      initialDetailTab="evidence"
    />,
  );
  await screen.findByText("Trace 证据完整");
  expect(screen.getByRole("tab", { name: "执行详情" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: "执行证据" })).toBeNull();
  expect(screen.getByRole("tab", { name: "评测结果" })).toHaveAttribute("aria-selected", "false");
  await waitFor(() => expect(getM0Evidence).toHaveBeenCalledWith("operation", "operation-1"));
});

it("shows sample coverage without claiming a full-data result", async () => {
  const original = await vi.mocked(getRunCaseDetail).getMockImplementation()!(
    "kn-1",
    "run-1",
    "case-run-1",
  );
  vi.mocked(getRunCaseDetail).mockResolvedValue({
    ...original,
    observation: {
      normalized_output: { violations: 0 },
      query_summary: {
        scope: { mode: "sample", limit: 100 },
        checked_rows: 100,
        total_count: 5000,
        violations: 0,
      },
      evidence_status: "complete",
    },
  });
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  expect(await screen.findByText("采样检查通过")).toBeTruthy();
  expect(screen.getByText("5000")).toBeTruthy();
  expect(screen.getByText("结论仅适用于本次样本，不代表全量数据通过。")).toBeTruthy();
});

it("provides a suite-version-pinned manual guide instead of rerunning an external case on the platform", async () => {
  const run = await vi.mocked(getM0Run)("kn-1", "run-1");
  vi.mocked(getM0Run).mockResolvedValue({
    ...run,
    runner_type: "external_agent",
    external_agent: { name: "Codex" },
    scope: { kind: "suite", suite_id: "suite-original", version: 3 },
  });
  const rerun = vi.fn();
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" onRerun={rerun} />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  expect(screen.queryByRole("button", { name: "重新运行" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重新发起指引" }));
  expect(await screen.findByText(/固定版本 3/)).toHaveTextContent("suite-original");
  expect(screen.getByText(/范围为整个测试集/)).toBeTruthy();
  expect(rerun).not.toHaveBeenCalled();
});

it("retries an evidence read explicitly without replacing case results", async () => {
  vi.mocked(getM0Evidence).mockRejectedValueOnce(new Error("denied"));
  render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      initialDetailTab="evidence"
      preferredCaseRunId="case-run-1"
    />,
  );
  fireEvent.click(await screen.findByText("重试读取", {}, { timeout: 10000 }));
  await waitFor(() => expect(getM0Evidence).toHaveBeenCalledTimes(2));
  expect(
    (
      await within(screen.getByRole("region", { name: "执行证据" })).findAllByText(
        /已完成/,
        {},
        { timeout: 10000 },
      )
    )[0],
  ).toBeTruthy();
});

it("keeps case selection beside the result and resets only the result scroll on selection", async () => {
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  const left = screen.getByTestId("case-selection-pane");
  const right = screen.getByTestId("case-detail-pane");
  expect(left.parentElement).toBe(right.parentElement);
  const list = screen.getByTestId("case-selection-list");
  list.scrollTop = 180;
  right.scrollTop = 500;
  fireEvent.click(within(left).getByRole("button", { name: "采购订单必须关联供应商" }));
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  expect(right.scrollTop).toBe(0);
  expect(list.scrollTop).toBe(180);
  expect(within(left).getByRole("button", { name: "采购订单必须关联供应商" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("keeps the same case list, search and outcome filter for a single-case run", async () => {
  const run = await vi.mocked(getM0Run)("kn-1", "run-1");
  const page = await vi.mocked(listRunCases)("kn-1", "run-1");
  vi.mocked(getM0Run).mockResolvedValue({
    ...run,
    progress: { planned_cases: 1, completed_cases: 1 },
  });
  vi.mocked(listRunCases).mockImplementation((_kn, _run, _cursor, _outcome, _signal, query) =>
    Promise.resolve({
      entries: query ? [] : [page.entries[0]],
      total: query ? 0 : 1,
      next_cursor: null,
    }),
  );
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  const left = screen.getByTestId("case-selection-pane");
  expect(left.parentElement).toBe(screen.getByTestId("case-detail-pane").parentElement);
  expect(within(left).getByRole("button", { name: "物料编码唯一且必填" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(within(left).getByRole("combobox", { name: "用例评测结果筛选" })).toBeTruthy();
  const input = within(left).getByRole("searchbox", { name: "搜索用例名称或 ID" });
  fireEvent.change(input, { target: { value: "not-found" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });
  await within(left).findByText("未找到匹配的用例");
  expect(within(left).getByRole("combobox", { name: "用例评测结果筛选" })).toBeTruthy();
  fireEvent.click(within(left).getByRole("button", { name: "close-circle" }));
  await within(left).findByRole("button", { name: "物料编码唯一且必填" });
});

it("collapses the narrow-screen selector after choosing a case", async () => {
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  const toggle = screen.getByRole("button", { name: /选择用例/ });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "采购订单必须关联供应商" }));
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});

it("replaces the case count heading with full-run search and resets paging while retaining outcome", async () => {
  const base = await vi.mocked(listRunCases)("kn-1", "run-1");
  vi.mocked(listRunCases)
    .mockClear()
    .mockImplementation((_kn, _run, cursor, _outcome, _signal, query) =>
      Promise.resolve({
        entries: query ? [base.entries[1]] : base.entries,
        total: query ? 1 : 40,
        next_cursor: query || cursor ? null : "page-two",
      }),
    );
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" initialOutcome="fail" />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  expect(screen.queryByRole("heading", { name: "用例结果" })).toBeNull();
  fireEvent.click(screen.getByTitle(/Next Page|下一页/));
  await waitFor(() =>
    expect(listRunCases).toHaveBeenLastCalledWith(
      "kn-1",
      "run-1",
      "page-two",
      "fail",
      expect.any(AbortSignal),
      undefined,
    ),
  );
  const input = screen.getByRole("searchbox", { name: "搜索用例名称或 ID" });
  fireEvent.change(input, { target: { value: "  case-2  " } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });
  await screen.findByText("用例详情 · 采购订单必须关联供应商");
  expect(listRunCases).toHaveBeenLastCalledWith(
    "kn-1",
    "run-1",
    undefined,
    "fail",
    expect.any(AbortSignal),
    "case-2",
  );
  expect(input).toHaveValue("case-2");
  expect(screen.queryByRole("button", { name: "物料编码唯一且必填" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "close-circle" }));
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  expect(listRunCases).toHaveBeenLastCalledWith(
    "kn-1",
    "run-1",
    undefined,
    "fail",
    expect.any(AbortSignal),
    undefined,
  );
});

it("shows no matches and prevents late search responses replacing newer results", async () => {
  const base = await vi.mocked(listRunCases)("kn-1", "run-1");
  let finish!: (value: typeof base) => void;
  vi.mocked(listRunCases)
    .mockClear()
    .mockImplementation((_kn, _run, _cursor, _outcome, _signal, query) => {
      if (query === "slow")
        return new Promise((resolve) => {
          finish = resolve;
        });
      return Promise.resolve(query ? { entries: [], total: 0, next_cursor: null } : base);
    });
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  const input = screen.getByRole("searchbox", { name: "搜索用例名称或 ID" });
  fireEvent.change(input, { target: { value: "slow" } });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 13 });
  fireEvent.keyUp(input, { key: "Enter", keyCode: 13 });
  await waitFor(() =>
    expect(listRunCases).toHaveBeenLastCalledWith(
      "kn-1",
      "run-1",
      undefined,
      undefined,
      expect.any(AbortSignal),
      "slow",
    ),
  );
  const staleSignal = vi.mocked(listRunCases).mock.calls.at(-1)?.[4];
  fireEvent.change(input, { target: { value: "not-found" } });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 13 });
  fireEvent.keyUp(input, { key: "Enter", keyCode: 13 });
  await screen.findByText("未找到匹配的用例");
  expect(staleSignal?.aborted).toBe(true);
  await act(() => {
    finish(base);

    return Promise.resolve();
  });
  expect(screen.getByText("未找到匹配的用例")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "物料编码唯一且必填" })).toBeNull();
});

it("keeps long case names available in full and selectable after truncation", async () => {
  const page = await vi.mocked(listRunCases)("kn-1", "run-1");
  const title = "供应链E2E · 采购订单 / srcbillentryid · 属性值类型一致".repeat(20);
  vi.mocked(listRunCases).mockResolvedValue({
    ...page,
    entries: page.entries.map((entry, index) =>
      index === 1 ? { ...entry, case_title: title } : entry,
    ),
  });
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  const button = await screen.findByRole("button", { name: title }, { timeout: 10000 });
  expect(within(button).getByText(title)).toHaveAttribute("title", title);
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
  expect(getRunCaseDetail).toHaveBeenCalledWith(
    "kn-1",
    "run-1",
    "case-run-2",
    undefined,
    expect.any(AbortSignal),
  );
});

it("opens the shared AI repair flow from the selected failed case with its exact run snapshot", async () => {
  const onRepair = vi.fn();
  render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      preferredCaseRunId="case-run-2"
      onRepair={onRepair}
    />,
  );
  await screen.findByRole("button", { name: "AI 修复" });
  expect(screen.queryByRole("tab", { name: "AI 修复" })).toBeNull();
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "评测结果",
    "执行详情",
  ]);
  expect(screen.getByRole("tab", { name: "评测结果" })).toHaveAttribute("aria-selected", "true");
  expect(onRepair).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "AI 修复" }));
  await waitFor(() =>
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ id: "run-1" }),
      expect.objectContaining({
        id: "case-run-2",
        case_id: "case-2",
        case_title: "采购订单必须关联供应商",
        quality_outcome: "fail",
      }),
    ),
  );
});

it("reports selected Cases and evidence tabs without refetching the run list", async () => {
  const onSelectionChange = vi.fn();
  const onRunLoaded = vi.fn();
  const { rerender } = render(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      onSelectionChange={onSelectionChange}
      onRunLoaded={onRunLoaded}
    />,
  );
  await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith("case-run-1", "result"));
  expect(onRunLoaded).toHaveBeenCalledWith(expect.objectContaining({ id: "run-1" }));
  const reads = vi.mocked(listRunCases).mock.calls.length;
  fireEvent.click(screen.getByTestId("case-selection-list").querySelectorAll("button")[1]);
  await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith("case-run-2", "result"));
  rerender(
    <EvalMultiRunPanel
      networkId="kn-1"
      runId="run-1"
      preferredCaseRunId="case-run-2"
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(listRunCases).toHaveBeenCalledTimes(reads);
  fireEvent.click(screen.getByRole("tab", { name: "执行详情" }));
  await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith("case-run-2", "evidence"));
  expect(listRunCases).toHaveBeenCalledTimes(reads);
});
it("allows the Case selector to collapse without losing the selected result", async () => {
  render(<EvalMultiRunPanel networkId="kn-1" runId="run-1" />);
  await screen.findByText("用例详情 · 物料编码唯一且必填");
  fireEvent.click(screen.getByRole("button", { name: "收起用例列表" }));
  expect(screen.getByRole("button", { name: "展开用例列表" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(screen.getByText("用例详情 · 物料编码唯一且必填")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "展开用例列表" }));
  expect(screen.getByRole("button", { name: "收起用例列表" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});
