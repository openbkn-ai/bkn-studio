/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});

import { EvalRunComparisonDrawer } from "./EvalRunComparisonDrawer";

vi.mock("./EvalMultiRunPanel", () => ({
  EvalMultiRunPanel: (props: {
    runId: string;
    preferredCaseRunId?: string;
    comparedResultRevision?: number;
  }) => (
    <div
      data-testid="comparison-case-result"
      data-run={props.runId}
      data-case={props.preferredCaseRunId}
      data-revision={props.comparedResultRevision}
    >
      历史用例结果
    </div>
  ),
}));
import {
  compareEvalRuns,
  getEvalRunResultRevisionPage,
  getM0Run,
  searchM0Runs,
  type M0Run,
} from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  compareEvalRuns: vi.fn(),
  getM0Run: vi.fn(),
  searchM0Runs: vi.fn().mockResolvedValue({ entries: [], total: 0, page: 1, limit: 20 }),
  getEvalRunResultRevisionPage: vi.fn(),
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

const run = (id: string): M0Run => ({
  id,
  execution_status: "completed",
  phase: null,
  quality_outcome: "pass",
  progress: { planned_cases: 1, completed_cases: 1 },
  result_revision: 1,
});

it("compares published revisions and does not call a Case definition change an improvement", async () => {
  vi.mocked(getEvalRunResultRevisionPage).mockResolvedValue({
    entries: [
      {
        revision: 1,
        checksum: "checksum",
        quality_outcome: "pass",
        current: true,
        created_at: "2026-10-30T00:00:00Z",
      },
    ],
  });
  vi.mocked(compareEvalRuns).mockResolvedValue({
    baseline_run_id: "old",
    candidate_run_id: "new",
    baseline_result_revision: 1,
    candidate_result_revision: 1,
    baseline_result_checksum: "old-checksum",
    candidate_result_checksum: "new-checksum",
    target_snapshot_compatible: true,
    data_baseline_verified: false,
    changes: [
      {
        case_id: "case-1",
        kind: "case_version_changed",
        baseline: {
          case_id: "case-1",
          case_version_id: "v1",
          case_run_id: "cr-old",
          execution_status: "completed",
          quality_outcome: "fail",
        },
        candidate: {
          case_id: "case-1",
          case_version_id: "v2",
          case_run_id: "cr-new",
          execution_status: "completed",
          quality_outcome: "pass",
        },
      },
    ],
  });
  render(
    <EvalRunComparisonDrawer
      networkId="kn-1"
      open
      candidate={run("new")}
      runs={[run("old"), run("new")]}
      onClose={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(compareEvalRuns).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ id: "old", result_revision: 1 }),
      expect.objectContaining({ id: "new", result_revision: 1 }),
      1,
      1,
    ),
  );
  expect(await screen.findByText("用例定义已变更")).toBeTruthy();
  expect(screen.queryByText("old", { exact: true })).toBeNull();
  expect(screen.queryByText("new", { exact: true })).toBeNull();
  expect(screen.getByText(/结果仅说明两次测评的差异/)).toBeTruthy();
  expect(screen.getByText(/数据基线没有可验证的不可变修订/)).toBeTruthy();
});

it("loads the original failed Run as the preferred baseline after a retest", async () => {
  vi.mocked(getEvalRunResultRevisionPage).mockResolvedValue({
    entries: [
      {
        revision: 1,
        checksum: "checksum",
        quality_outcome: "pass",
        current: true,
        created_at: "2026-10-30T00:00:00Z",
      },
    ],
  });
  vi.mocked(getM0Run).mockResolvedValue(run("original-failure"));
  vi.mocked(compareEvalRuns).mockResolvedValue({
    baseline_run_id: "original-failure",
    candidate_run_id: "new",
    baseline_result_revision: 1,
    candidate_result_revision: 1,
    baseline_result_checksum: "old",
    candidate_result_checksum: "new",
    target_snapshot_compatible: true,
    data_baseline_verified: false,
    changes: [],
  });
  render(
    <EvalRunComparisonDrawer
      networkId="kn-1"
      open
      candidate={run("new")}
      runs={[run("another-run"), run("new")]}
      preferredBaselineId="original-failure"
      onClose={vi.fn()}
    />,
  );
  await waitFor(() => expect(getM0Run).toHaveBeenCalledWith("kn-1", "original-failure"));
  await waitFor(() =>
    expect(compareEvalRuns).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ id: "original-failure" }),
      expect.objectContaining({ id: "new" }),
      1,
      1,
    ),
  );
});

it("lets the reviewer pin a historical baseline result revision", async () => {
  vi.mocked(compareEvalRuns).mockClear();
  vi.mocked(getEvalRunResultRevisionPage).mockImplementation((_networkId, runId) =>
    Promise.resolve(
      runId === "old"
        ? {
            entries: [
              {
                revision: 2,
                checksum: "newer",
                quality_outcome: "pass",
                current: true,
                created_at: "2026-10-30T00:00:00Z",
              },
              {
                revision: 1,
                checksum: "older",
                quality_outcome: "fail",
                current: false,
                created_at: "2026-10-29T00:00:00Z",
              },
            ],
          }
        : {
            entries: [
              {
                revision: 1,
                checksum: "candidate",
                quality_outcome: "pass",
                current: true,
                created_at: "2026-10-30T00:00:00Z",
              },
            ],
          },
    ),
  );
  vi.mocked(compareEvalRuns).mockResolvedValue({
    baseline_run_id: "old",
    candidate_run_id: "new",
    baseline_result_revision: 1,
    candidate_result_revision: 1,
    baseline_result_checksum: "older",
    candidate_result_checksum: "candidate",
    target_snapshot_compatible: true,
    data_baseline_verified: false,
    changes: [],
  });
  render(
    <EvalRunComparisonDrawer
      networkId="kn-1"
      open
      candidate={run("new")}
      runs={[{ ...run("old"), result_revision: 2 }, run("new")]}
      onClose={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(compareEvalRuns).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ id: "old" }),
      expect.objectContaining({ id: "new" }),
      2,
      1,
    ),
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择基线结果版本" }));
  fireEvent.click(
    screen
      .getAllByText("v1")
      .find((element) => element.classList.contains("ant-select-item-option-content"))!,
  );
  await waitFor(() =>
    expect(compareEvalRuns).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ id: "old" }),
      expect.objectContaining({ id: "new" }),
      1,
      1,
    ),
  );
});

it("loads older baseline versions only when requested", async () => {
  vi.mocked(getEvalRunResultRevisionPage).mockImplementation((_networkId, runId, before) => {
    if (runId === "new")
      return Promise.resolve({
        entries: [
          {
            revision: 1,
            checksum: "candidate",
            quality_outcome: "pass",
            current: true,
            created_at: "2026-10-30T00:00:00Z",
          },
        ],
      });
    if (before === 2)
      return Promise.resolve({
        entries: [
          {
            revision: 1,
            checksum: "older",
            quality_outcome: "fail",
            current: false,
            created_at: "2026-10-29T00:00:00Z",
          },
        ],
      });
    return Promise.resolve({
      entries: [
        {
          revision: 101,
          checksum: "newer",
          quality_outcome: "pass",
          current: true,
          created_at: "2026-10-30T00:00:00Z",
        },
        {
          revision: 2,
          checksum: "middle",
          quality_outcome: "pass",
          current: false,
          created_at: "2026-10-29T12:00:00Z",
        },
      ],
      next_before: 2,
    });
  });
  vi.mocked(compareEvalRuns).mockResolvedValue({
    baseline_run_id: "old",
    candidate_run_id: "new",
    baseline_result_revision: 101,
    candidate_result_revision: 1,
    baseline_result_checksum: "newer",
    candidate_result_checksum: "candidate",
    target_snapshot_compatible: true,
    data_baseline_verified: false,
    changes: [],
  });
  render(
    <EvalRunComparisonDrawer
      networkId="kn-1"
      open
      candidate={run("new")}
      runs={[{ ...run("old"), result_revision: 101 }, run("new")]}
      onClose={vi.fn()}
    />,
  );
  expect(await screen.findByRole("button", { name: "加载更早的基线版本" })).toBeTruthy();
  expect(getEvalRunResultRevisionPage).not.toHaveBeenCalledWith("kn-1", "old", 2);
  fireEvent.click(screen.getByRole("button", { name: "加载更早的基线版本" }));
  await waitFor(() => expect(getEvalRunResultRevisionPage).toHaveBeenCalledWith("kn-1", "old", 2));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "加载更早的基线版本" })).toBeNull(),
  );
});

it("loads historical Suite runs outside the current page, including a different Suite version", async () => {
  const candidate = {
    ...run("current-suite"),
    scope: { kind: "suite" as const, suite_id: "suite", version: 2 },
  };
  const old = {
    ...run("older-page"),
    scope: { kind: "suite" as const, suite_id: "suite", version: 1 },
  };
  vi.mocked(searchM0Runs)
    .mockResolvedValueOnce({ entries: [candidate], total: 21, page: 1, limit: 20 })
    .mockResolvedValueOnce({ entries: [old], total: 21, page: 2, limit: 20 });
  vi.mocked(getEvalRunResultRevisionPage).mockResolvedValue({
    entries: [
      {
        revision: 1,
        checksum: "sealed",
        quality_outcome: "pass",
        current: true,
        created_at: "2026-11-04T00:00:00Z",
      },
    ],
  });
  vi.mocked(compareEvalRuns).mockResolvedValue({
    baseline_run_id: old.id,
    candidate_run_id: candidate.id,
    baseline_result_revision: 1,
    candidate_result_revision: 1,
    baseline_result_checksum: "a",
    candidate_result_checksum: "b",
    target_snapshot_compatible: true,
    data_baseline_verified: false,
    changes: [],
  });
  render(
    <EvalRunComparisonDrawer
      networkId="kn"
      open
      candidate={candidate}
      runs={[candidate]}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "加载更多历史运行" }));
  await waitFor(() => expect(compareEvalRuns).toHaveBeenCalledWith("kn", old, candidate, 1, 1));
  expect(searchM0Runs).toHaveBeenCalledWith(
    "kn",
    expect.objectContaining({ suite_id: "suite", page: 2 }),
    expect.any(AbortSignal),
  );
  expect(screen.getByText(/当前运行：测试集 v2；基线：测试集 v1/)).toBeTruthy();
});

it("shows frozen names instead of UUIDs and opens the exact historical result on either side", async () => {
  const inspect = vi.fn();
  vi.mocked(getEvalRunResultRevisionPage).mockResolvedValue({
    entries: [
      {
        revision: 1,
        checksum: "sealed",
        quality_outcome: "pass",
        current: true,
        created_at: "2026-11-05T00:00:00Z",
      },
    ],
  });
  vi.mocked(compareEvalRuns).mockResolvedValue({
    baseline_run_id: "old",
    candidate_run_id: "new",
    baseline_result_revision: 1,
    candidate_result_revision: 1,
    baseline_result_checksum: "sealed-old",
    candidate_result_checksum: "sealed-new",
    target_snapshot_compatible: true,
    data_baseline_verified: false,
    changes: [
      {
        case_id: "081fac6c-5602-4df6-b08b-b319d53d735e",
        case_title: "优惠券模板主键检查",
        baseline_case_title: "优惠券模板唯一性",
        candidate_case_title: "优惠券模板主键检查",
        kind: "case_version_changed",
        baseline: {
          case_id: "081fac6c-5602-4df6-b08b-b319d53d735e",
          case_version_id: "v1",
          case_run_id: "old-case-run",
          execution_status: "completed",
          quality_outcome: "fail",
        },
        candidate: {
          case_id: "081fac6c-5602-4df6-b08b-b319d53d735e",
          case_version_id: "v2",
          case_run_id: "new-case-run",
          execution_status: "completed",
          quality_outcome: "pass",
        },
      },
    ],
  });
  render(
    <EvalRunComparisonDrawer
      networkId="kn"
      open
      candidate={run("new")}
      runs={[run("old"), run("new")]}
      onClose={vi.fn()}
      onInspect={inspect}
    />,
  );
  const name = await screen.findByRole("button", { name: "优惠券模板主键检查" });
  expect(screen.queryByRole("columnheader", { name: "用例 ID" })).toBeNull();
  expect(screen.getByRole("columnheader", { name: "用例" })).toBeTruthy();
  expect(screen.queryByText("081fac6c-5602-4df6-b08b-b319d53d735e")).toBeNull();
  fireEvent.click(name);
  expect(inspect).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: "new", result_revision: 1 }),
    "new-case-run",
    "result",
  );
  fireEvent.click(screen.getByRole("button", { name: "查看基线结果 · 优惠券模板主键检查" }));
  expect(inspect).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: "old", result_revision: 1 }),
    "old-case-run",
    "result",
  );
});

it("uses baseline names for removed cases and keeps unknown names explicit", async () => {
  vi.mocked(getEvalRunResultRevisionPage).mockResolvedValue({
    entries: [
      {
        revision: 1,
        checksum: "sealed",
        quality_outcome: "pass",
        current: true,
        created_at: "2026-11-05T00:00:00Z",
      },
    ],
  });
  vi.mocked(compareEvalRuns).mockResolvedValue({
    baseline_run_id: "old",
    candidate_run_id: "new",
    baseline_result_revision: 1,
    candidate_result_revision: 1,
    baseline_result_checksum: "old",
    candidate_result_checksum: "new",
    target_snapshot_compatible: true,
    data_baseline_verified: false,
    changes: [
      {
        case_id: "removed-id",
        baseline_case_title: "已移除的用户唯一性检查",
        kind: "removed",
        baseline: {
          case_id: "removed-id",
          case_run_id: "removed-run",
          case_version_id: "v1",
          execution_status: "completed",
          quality_outcome: "pass",
        },
      },
      {
        case_id: "unknown-id",
        kind: "added",
        candidate: {
          case_id: "unknown-id",
          case_run_id: "unknown-run",
          case_version_id: "v2",
          execution_status: "completed",
          quality_outcome: "pass",
        },
      },
    ],
  });
  render(
    <EvalRunComparisonDrawer
      networkId="kn"
      open
      candidate={run("new")}
      runs={[run("old"), run("new")]}
      onClose={vi.fn()}
    />,
  );
  expect(await screen.findByRole("button", { name: "已移除的用户唯一性检查" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "未记录用例名称" })).toBeTruthy();
  expect(screen.getAllByText("无此用例")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "已移除的用户唯一性检查" }));
  const detail = screen.getByTestId("comparison-case-result");
  expect(detail).toHaveAttribute("data-run", "old");
  expect(detail).toHaveAttribute("data-case", "removed-run");
  expect(detail).toHaveAttribute("data-revision", "1");
  fireEvent.click(screen.getByRole("button", { name: "返回历史对比" }));
  expect(await screen.findByRole("button", { name: "已移除的用户唯一性检查" })).toBeTruthy();
});
