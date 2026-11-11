/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { EvalAgentComparisonResult } from "./EvalAgentComparisonResult";
import type { AgentComparison } from "./agent-comparison.service";
import { getRunCaseDetail, type M0CaseDetail } from "./m0-run.service";
import { evalLocales } from "./locales";
vi.mock("./m0-run.service", () => ({ getRunCaseDetail: vi.fn() }));
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
const comparison: AgentComparison = {
  suite_id: "suite",
  suite_version: 1,
  target_snapshot_compatible: true,
  data_baseline_matched: true,
  runs: ["a", "b"].map((id) => ({
    id,
    external_agent: { name: id === "a" ? "Alpha Agent" : "Beta Agent", model: "declared-model" },
    execution_status: "completed",
    phase: null,
    quality_outcome: "fail",
    progress: { planned_cases: 4, completed_cases: 4 },
    result_revision: 1,
    result_checksum: `sealed-${id}`,
    data_baseline_id: "base",
    mean_case_duration_ms: null,
    duration_case_count: 0,
  })),
  cases: ["Lead time", "Cost", "Supplier", "Inventory"].map((title, i) => ({
    case_id: `c${i + 1}`,
    case_version_id: `cv${i + 1}`,
    title,
    results: [
      {
        run_id: "a",
        case_run_id: `a-${i + 1}`,
        quality_outcome: i === 1 ? "fail" : "pass",
        duration_ms: [100, 300, null, 500][i],
      },
      {
        run_id: "b",
        case_run_id: `b-${i + 1}`,
        quality_outcome: i === 0 || i === 2 ? "fail" : "pass",
        duration_ms: [200, 400, 600, 800][i],
      },
    ],
  })),
};
function detail(runId: string, caseRunId: string): M0CaseDetail {
  const row = comparison.cases.find((item) =>
    item.results.some((cell) => cell.case_run_id === caseRunId),
  )!;
  return {
    id: caseRunId,
    case_id: row.case_id,
    case_version_id: row.case_version_id,
    case_title: row.title,
    execution_status: "completed",
    quality_outcome: row.results.find((cell) => cell.run_id === runId)!.quality_outcome,
    duration_ms: 100,
    result_revision: 1,
    result_checksum: `sealed-${runId}`,
    input_spec: { question: "Shared question", arguments: { material_code: "606-000989" } },
    observation: {
      source_kind: "external_submission",
      answer: runId === "a" ? "Alpha answer" : "Beta answer",
      normalized_output: { days: runId === "a" ? 14 : 7 },
      evidence_status: runId === "a" ? "complete" : "partial",
    },
    assertions: [
      {
        id: "expected-value",
        type: "equals",
        outcome: runId === "a" ? "pass" : "fail",
        message: "Comparison result",
      },
    ],
    findings: [],
    evidence_refs: { interaction_id: `interaction-${runId}` },
  };
}
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRunCaseDetail).mockImplementation((_kn, runId, caseRunId) =>
    Promise.resolve(detail(runId, caseRunId)),
  );
});
it("pivots metrics by run, changes the baseline and drills counts into combined Case filters", async () => {
  render(<EvalAgentComparisonResult networkId="kn" comparison={comparison} onInspect={vi.fn()} />);
  const summary = screen.getByRole("region", { name: "整体指标" });
  expect(within(summary).getByText("75%")).toBeTruthy();
  expect(within(summary).getByText("-25 个百分点")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "查看 Alpha Agent 的 Lead time 结果" }),
  ).toHaveTextContent("100 ms");
  expect(getRunCaseDetail).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择对比基准" }));
  fireEvent.click(
    await screen.findByText("2. Beta Agent", { selector: ".ant-select-item-option-content" }),
  );
  expect(within(summary).getByText("+25 个百分点")).toBeTruthy();
  const failedRow = within(summary).getByText("未通过").closest("tr")!;
  fireEvent.click(within(failedRow).getAllByRole("button")[1]);
  const matrix = screen.getByRole("region", { name: "逐题对比" });
  expect(within(matrix).getByRole("button", { name: "Lead time" })).toBeTruthy();
  expect(within(matrix).queryByRole("button", { name: "Cost" })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox", { name: "搜索用例名称或 ID" }), {
    target: { value: "Supplier" },
  });
  expect(within(matrix).queryByRole("button", { name: "Lead time" })).toBeNull();
  expect(within(matrix).getByRole("button", { name: "Supplier" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  expect(within(matrix).getByRole("button", { name: "Cost" })).toBeTruthy();
  expect(getRunCaseDetail).not.toHaveBeenCalled();
}, 30000);
it("loads only an expanded Case at frozen revisions, caches it and routes Trace into one existing drawer", async () => {
  const inspect = vi.fn();
  render(<EvalAgentComparisonResult networkId="kn" comparison={comparison} onInspect={inspect} />);
  fireEvent.click(screen.getByRole("button", { name: "Lead time" }));
  const expanded = await screen.findByRole("region", { name: "用例对照 · Lead time" });
  await within(expanded).findByText("Alpha answer");
  await within(expanded).findByText("Beta answer");
  expect(getRunCaseDetail).toHaveBeenCalledTimes(2);
  expect(getRunCaseDetail).toHaveBeenCalledWith("kn", "a", "a-1", 1, expect.any(AbortSignal));
  expect(within(expanded).getAllByText("Shared question")).toHaveLength(1);
  expect(within(expanded).getByText("部分缺失")).toBeTruthy();
  fireEvent.click(within(expanded).getAllByRole("button", { name: "查看执行证据" })[0]);
  expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), "a-1", "evidence");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lead time" }));
  fireEvent.click(screen.getByRole("button", { name: "Lead time" }));
  await screen.findByText("Alpha answer");
  expect(getRunCaseDetail).toHaveBeenCalledTimes(2);
}, 30000);
it("rejects a mismatched result version in one column, retains valid columns and retries only the failed detail", async () => {
  let attempts = 0;
  vi.mocked(getRunCaseDetail).mockImplementation((_kn, runId, caseRunId) =>
    Promise.resolve({
      ...detail(runId, caseRunId),
      result_revision: runId === "b" && attempts++ === 0 ? 2 : 1,
    }),
  );
  render(<EvalAgentComparisonResult networkId="kn" comparison={comparison} onInspect={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Lead time" }));
  await screen.findByText("Alpha answer");
  await screen.findByText("无法读取所选结果版本的详情，请重试。");
  expect(screen.queryByText("Beta answer")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText("Beta answer");
  expect(getRunCaseDetail).toHaveBeenCalledTimes(3);
}, 30000);
it("aborts expanded detail requests when changing the Case", async () => {
  vi.mocked(getRunCaseDetail).mockImplementation(() => new Promise(() => {}));
  render(<EvalAgentComparisonResult networkId="kn" comparison={comparison} onInspect={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Lead time" }));
  await waitFor(() => expect(getRunCaseDetail).toHaveBeenCalledTimes(2));
  const signals = vi.mocked(getRunCaseDetail).mock.calls.map((call) => call[4]);
  fireEvent.click(screen.getByRole("button", { name: "Cost" }));
  await waitFor(() => expect(signals.every((signal) => signal?.aborted)).toBe(true));
  expect(screen.queryByRole("region", { name: "用例对照 · Lead time" })).toBeNull();
  expect(screen.getByRole("region", { name: "用例对照 · Cost" })).toBeTruthy();
}, 30000);

it("exposes full long agent, model, client and case names without changing inspection", () => {
  const name = "Agent_".repeat(100);
  const model = "模型".repeat(100);
  const client = "client-version_".repeat(100);
  const title = "采购订单属性类型".repeat(100);
  const longComparison = {
    ...comparison,
    runs: comparison.runs.map((run, index) =>
      index
        ? run
        : {
            ...run,
            external_agent: { name, model, client_version: client },
          },
    ),
    cases: comparison.cases.map((row, index) => (index ? row : { ...row, title })),
  };
  render(
    <EvalAgentComparisonResult networkId="kn" comparison={longComparison} onInspect={vi.fn()} />,
  );
  expect(screen.getAllByTitle(`1. ${name}`).length).toBeGreaterThan(0);
  expect(screen.getAllByTitle(model).length).toBeGreaterThan(0);
  expect(screen.getAllByTitle(client).length).toBeGreaterThan(0);
  const button = screen.getByRole("button", { name: title });
  expect(button).toHaveAttribute("title", title);
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
});
