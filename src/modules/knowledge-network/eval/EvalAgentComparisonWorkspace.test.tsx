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
import { EvalAgentComparisonWorkspace } from "./EvalAgentComparisonWorkspace";
import { compareAgentRuns } from "./agent-comparison.service";
import {
  listEvalSuites,
  listEvalSuiteVersions,
  searchM0Runs,
  type M0Run,
  type EvalSuiteVersion,
} from "./m0-run.service";
import { evalLocales } from "./locales";

vi.mock("./agent-comparison.service", () => ({
  MAX_AGENT_COMPARISON_RUNS: 6,
  compareAgentRuns: vi.fn(),
}));
vi.mock("./m0-run.service", () => ({
  listEvalSuites: vi.fn(),
  listEvalSuiteVersions: vi.fn(),
  searchM0Runs: vi.fn(),
}));
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
const suite: EvalSuiteVersion = {
  id: "sv1",
  suite_id: "suite",
  name: "Published Suite",
  description: "Compare agent quality",
  tags: [],
  version: 1,
  status: "published",
  members: ["cv1"],
  checksum: "sealed",
};
const run = (id: string): M0Run => ({
  id,
  scope: { kind: "suite", suite_id: "suite", version: 1 },
  execution_status: "completed",
  phase: null,
  quality_outcome: id === "b" ? "fail" : "pass",
  result_revision: 1,
  runner_type: "external_agent",
  external_agent: { name: "Same Agent", model: id === "b" ? "model-b" : "model-a" },
  progress: { planned_cases: 1, completed_cases: 1 },
  case_counts: {
    total: 1,
    passed: id === "b" ? 0 : 1,
    failed: id === "b" ? 1 : 0,
    inconclusive: 0,
    review_required: 0,
    execution_failed: 0,
    cancelled: 0,
    pending: 0,
  },
  created_at: "2026-11-04T00:00:00Z",
});
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listEvalSuites).mockResolvedValue({ entries: [suite], total: 1, page: 1, limit: 20 });
  vi.mocked(listEvalSuiteVersions).mockResolvedValue([suite]);
  vi.mocked(searchM0Runs).mockImplementation((_kn, filter) =>
    Promise.resolve({
      entries: filter.page === 1 ? [run("a")] : [run("b")],
      total: 11,
      page: filter.page,
      limit: 10,
    }),
  );
  vi.mocked(compareAgentRuns).mockResolvedValue({
    suite_id: "suite",
    suite_version: 1,
    target_snapshot_compatible: false,
    data_baseline_matched: false,
    runs: [run("a"), run("b")].map((item) => ({
      ...item,
      data_baseline_id: "",
      mean_case_duration_ms: null,
      duration_case_count: 0,
    })),
    cases: [
      {
        case_id: "case",
        case_version_id: "cv1",
        title: "Case title",
        results: [
          { run_id: "a", case_run_id: "cr-a", quality_outcome: "pass", duration_ms: null },
          { run_id: "b", case_run_id: "cr-b", quality_outcome: "fail", duration_ms: 123 },
        ],
      },
    ],
  });
});
async function chooseSuite() {
  await waitFor(() => expect(listEvalSuites).toHaveBeenCalled());
  fireEvent.mouseDown(screen.getByLabelText("测试集", { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByText("Published Suite"));
  await waitFor(() => expect(searchM0Runs).toHaveBeenCalled());
  await screen.findByText("Same Agent");
}
it("preserves selections across pages, compares same-name agents with different models, and opens the selected Case", async () => {
  const inspect = vi.fn();
  const back = vi.fn();
  render(<EvalAgentComparisonWorkspace networkId="kn" onBack={back} onInspect={inspect} />);
  await chooseSuite();
  expect(searchM0Runs).toHaveBeenCalledWith(
    "kn",
    expect.objectContaining({
      suite_id: "suite",
      suite_version: 1,
      runner_type: "external_agent",
      status: "completed",
      comparable: true,
    }),
    expect.any(AbortSignal),
  );
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "生成对比" })).toBeDisabled();
  fireEvent.click(screen.getByTitle(/Next Page|下一页/));
  await screen.findByText("model-b");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "生成对比" }));
  await screen.findByText("整体指标");
  expect(compareAgentRuns).toHaveBeenCalledWith(
    "kn",
    "suite",
    1,
    [run("a"), run("b")],
    expect.any(AbortSignal),
  );
  expect(screen.getByText("评测条件存在差异")).toBeTruthy();
  expect(screen.getByText(/参评名称、模型和客户端版本由客户端声明/)).toBeTruthy();
  const cells = screen.getAllByRole("button", { name: "查看 Same Agent 的 Case title 结果" });
  fireEvent.click(cells[1]);
  expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }), "cr-b");
  fireEvent.click(screen.getByRole("button", { name: "重新选择运行" }));
  expect(screen.getByText("已选 2 / 6 次运行")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回运行记录" }));
  expect(back).toHaveBeenCalled();
}, 30000);
it("limits selection to six completed external runs and clears it when the Suite version changes", async () => {
  vi.mocked(listEvalSuiteVersions).mockResolvedValue([{ ...suite, version: 2 }, suite]);
  const valid = Array.from({ length: 7 }, (_, i) => ({
    ...run(`run-${i}`),
    scope: { kind: "suite" as const, suite_id: "suite", version: 2 },
    external_agent: { name: `Agent ${i}` },
  }));
  vi.mocked(searchM0Runs).mockResolvedValue({
    entries: [...valid, { ...valid[0], id: "cancelled", execution_status: "cancelled" }],
    total: 8,
    page: 1,
    limit: 10,
  });
  render(<EvalAgentComparisonWorkspace networkId="kn" onBack={vi.fn()} onInspect={vi.fn()} />);
  await waitFor(() => expect(listEvalSuites).toHaveBeenCalled());
  fireEvent.mouseDown(screen.getByLabelText("测试集", { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByText("Published Suite"));
  await screen.findByText("Agent 6");
  const table = screen.getByRole("table");
  const boxes = within(table).getAllByRole("checkbox");
  expect(boxes[7]).toBeDisabled();
  boxes.slice(0, 6).forEach((box) => fireEvent.click(box));
  expect(boxes[6]).toBeDisabled();
  expect(screen.getByText("已选 6 / 6 次运行")).toBeTruthy();
  fireEvent.mouseDown(screen.getByLabelText("测试集版本", { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByText("v1 · 1 条用例"));
  await waitFor(() => expect(screen.getByText("已选 0 / 6 次运行")).toBeTruthy());
  expect(
    screen.getByText("生成对比", { selector: "button > span" }).closest("button"),
  ).toBeDisabled();
  expect(table.querySelector('input[type="checkbox"]')).toBeDisabled();
}, 15_000);

it("keeps the complete selected agent label discoverable and removable", async () => {
  const name = "Agent_".repeat(100);
  const model = "model_".repeat(100);
  vi.mocked(searchM0Runs).mockResolvedValue({
    entries: [{ ...run("a"), external_agent: { name, model } }],
    total: 1,
    page: 1,
    limit: 10,
  });
  render(<EvalAgentComparisonWorkspace networkId="kn" onBack={vi.fn()} onInspect={vi.fn()} />);
  await waitFor(() => expect(listEvalSuites).toHaveBeenCalled());
  fireEvent.mouseDown(screen.getByLabelText("测试集", { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByText("Published Suite"));
  await screen.findByText(name);
  expect(screen.getByTitle(name)).toBeTruthy();
  expect(screen.getByTitle(model)).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox"));
  const label = screen.getByTitle(new RegExp(`^${name} · ${model}`));
  expect(label.textContent).toContain(name);
  const tag = label.closest(".ant-tag")!;
  fireEvent.click(within(tag as HTMLElement).getByRole("img", { name: /close/i }));
  expect(screen.queryByTitle(new RegExp(`^${name} · ${model}`))).toBeNull();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
