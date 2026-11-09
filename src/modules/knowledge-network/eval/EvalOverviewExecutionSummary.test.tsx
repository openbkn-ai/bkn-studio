/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";

import { EvalOverviewExecutionSummary } from "./EvalOverviewExecutionSummary";
import { evalLocales } from "./locales";
import type { EvalOverview } from "./m0-run.service";

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});

const cases: EvalOverview["cases"] = {
  total: 64,
  enabled: 63,
  excluded: 1,
  runnable: 46,
  evaluated: 49,
  passed: 48,
  failed: 1,
  inconclusive: 0,
  review_required: 0,
  declaration_checked: 0,
  declaration_passed: 0,
  declaration_problems: 0,
  execution_failed: 0,
  in_progress: 0,
  cancelled: 0,
  not_run: 14,
};

it("shows result coverage without exposing execution-readiness categories", () => {
  const onCaseFilter = vi.fn();
  const onScope = vi.fn();
  render(
    <EvalOverviewExecutionSummary cases={cases} onCaseFilter={onCaseFilter} onScope={onScope} />,
  );
  const results = screen.getByTestId("eval-overview-results");
  expect(screen.queryByTestId("eval-overview-readiness")).toBeNull();
  expect(within(results).getByText("已有评测结果 49 / 63 · 覆盖率 77.8%")).toBeTruthy();
  expect(within(results).getByRole("button", { name: /通过\s*48/ })).toBeTruthy();
  expect(within(results).getByRole("button", { name: /未通过\s*1/ })).toBeTruthy();
  fireEvent.click(within(results).getByRole("button", { name: /暂无评测结果\s*14/ }));
  expect(onCaseFilter).toHaveBeenLastCalledWith("no_result");
  expect(within(results).queryByRole("button", { name: /执行中|执行异常|已取消/ })).toBeNull();
  expect(within(results).queryByText("声明检查通过")).toBeNull();
  expect(within(results).queryByText("声明检查异常")).toBeNull();
  expect(screen.queryByText("运行配置就绪")).toBeNull();
  expect(screen.queryByText("运行条件未满足")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "查看评测范围" }));
  expect(onScope).toHaveBeenCalledOnce();
});

it("includes all cases without business results and shows only nonzero execution states", () => {
  const onCaseFilter = vi.fn();
  render(
    <EvalOverviewExecutionSummary
      cases={{
        ...cases,
        enabled: 8,
        runnable: 2,
        evaluated: 2,
        passed: 1,
        failed: 1,
        not_run: 1,
        in_progress: 2,
        execution_failed: 1,
        cancelled: 1,
        declaration_checked: 1,
        declaration_passed: 1,
      }}
      onCaseFilter={onCaseFilter}
      onScope={vi.fn()}
    />,
  );
  const results = screen.getByTestId("eval-overview-results");
  expect(within(results).getByRole("button", { name: /暂无评测结果\s*6/ })).toBeTruthy();
  for (const [name, filter] of [
    ["执行中 2", "in_progress"],
    ["执行异常 1", "execution_failed"],
    ["已取消 1", "cancelled"],
  ]) {
    fireEvent.click(within(results).getByRole("button", { name }));
    expect(onCaseFilter).toHaveBeenLastCalledWith(filter);
  }
  fireEvent.click(
    within(results).getByRole("button", {
      name: "1 条用例仅完成声明检查，尚未完成业务评测，查看用例",
    }),
  );
  expect(onCaseFilter).toHaveBeenLastCalledWith("declaration");
  expect(within(results).getByText("已有评测结果 2 / 8 · 覆盖率 25%")).toBeTruthy();
});

it("keeps declaration checks out of business coverage and handles an empty scope", () => {
  const onCaseFilter = vi.fn();
  const props = { onCaseFilter, onScope: vi.fn() };
  const { rerender } = render(
    <EvalOverviewExecutionSummary
      {...props}
      cases={{
        ...cases,
        enabled: 1,
        runnable: 1,
        evaluated: 0,
        passed: 0,
        failed: 0,
        not_run: 0,
        excluded: 0,
        declaration_checked: 1,
        declaration_passed: 1,
      }}
    />,
  );
  expect(screen.getByText("已有评测结果 0 / 1 · 覆盖率 0%")).toBeTruthy();
  expect(screen.getByRole("button", { name: /暂无评测结果\s*1/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "查看评测范围" })).toBeNull();
  rerender(
    <EvalOverviewExecutionSummary
      {...props}
      cases={{
        ...cases,
        enabled: 0,
        runnable: 0,
        evaluated: 0,
        passed: 0,
        failed: 0,
        not_run: 0,
        excluded: 0,
      }}
    />,
  );
  expect(screen.getByText("已有评测结果 0 / 0 · 覆盖率 0%")).toBeTruthy();
  expect(screen.getByTestId("eval-overview-results").textContent).not.toMatch(/NaN|Infinity/);
  expect(screen.queryByRole("button", { name: /通过|暂无评测结果|运行条件未满足/ })).toBeNull();
});
