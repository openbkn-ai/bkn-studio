/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { EvalCaseResourceSidebar, type EvalCaseResourceFilter } from "./EvalCaseResourceSidebar";
import type { EvalCaseResourceSummaryPage } from "./m0-run.service";
vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({ t: (key: string) => key.split(".").at(-1) }),
}));
vi.mock("@/modules/knowledge-network/components/shared/KnowledgeResourceIcon", () => ({
  KnowledgeResourceIcon: ({ kind }: { kind: string }) => <span data-testid={"icon-" + kind} />,
}));
beforeAll(() => {
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
});
const summary: EvalCaseResourceSummaryPage = {
  entries: [
    { name: "Query", kinds: ["function", "api"], case_count: 3 },
    { name: "业务场景", kinds: ["scenario"], case_count: 1 },
  ],
  total: 20,
  case_total: 4,
  page: 1,
  limit: 10,
};
function fixture(overrides: Partial<Parameters<typeof EvalCaseResourceSidebar>[0]> = {}) {
  const props = {
    filter: { type: "all", name: "" } as EvalCaseResourceFilter,
    summary,
    loading: false,
    error: false,
    page: 1,
    onChange: vi.fn(),
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<EvalCaseResourceSidebar {...props} />) };
}
it("shows all resource kinds and selects a resource without changing its type filter", () => {
  const { props } = fixture({ filter: { type: "api", name: "" } });
  expect(screen.getByTestId("icon-function")).toBeInTheDocument();
  expect(screen.getByTestId("icon-api")).toBeInTheDocument();
  expect(
    within(screen.getByRole("button", { name: "全部资源" })).getByTitle("totalCases"),
  ).toHaveTextContent("4");
  fireEvent.click(screen.getByRole("button", { name: "Query3" }));
  expect(props.onChange).toHaveBeenLastCalledWith({ type: "api", name: "Query" });
});
it("uses the scenario filter and clears resource names for all resources", () => {
  const { props } = fixture({ filter: { type: "function", name: "Query" } });
  fireEvent.click(screen.getByRole("button", { name: "业务场景1" }));
  expect(props.onChange).toHaveBeenLastCalledWith({ type: "scenario", name: "" });
  fireEvent.click(screen.getByRole("button", { name: "全部资源" }));
  expect(props.onChange).toHaveBeenLastCalledWith({ type: "function", name: "" });
});
it("paginates resources independently of the selected case resource", () => {
  const { props } = fixture();
  fireEvent.click(within(screen.getByLabelText("资源分页")).getByTitle("Next Page"));
  expect(props.onPageChange).toHaveBeenCalledWith(2);
  expect(props.onChange).not.toHaveBeenCalled();
});
it("keeps a large resource catalogue on a compact read-only page counter", () => {
  fixture({ summary: { ...summary, total: 96 }, page: 10 });
  const pagination = screen.getByLabelText("资源分页");
  expect(pagination).toHaveTextContent(/10\s*\/\s*10/);
  expect(within(pagination).queryByRole("textbox")).toBeNull();
  expect(within(pagination).getByTitle("Next Page")).toHaveAttribute("aria-disabled", "true");
});
it("retries a failed resource summary without showing stale entries", () => {
  const { props } = fixture({ error: true });
  expect(screen.getByRole("alert")).toHaveTextContent("failed");
  expect(screen.queryByText("Query")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  expect(props.onRetry).toHaveBeenCalledTimes(1);
});
it("keeps empty results and loading distinct", () => {
  const { rerender, props } = fixture({ summary: { ...summary, entries: [], total: 0 } });
  expect(screen.getByText("empty")).toBeVisible();
  expect(screen.queryByLabelText("资源分页")).not.toBeInTheDocument();
  rerender(<EvalCaseResourceSidebar {...props} loading />);
  expect(screen.getByLabelText("loading")).toBeInTheDocument();
  expect(screen.queryByText("empty")).not.toBeInTheDocument();
});

it("counts all Cases rather than resource groups or just the visible resource page", () => {
  fixture({
    summary: { ...summary, case_total: 383, total: 13, entries: summary.entries.slice(0, 1) },
  });
  const count = within(screen.getByRole("button", { name: "全部资源" })).getByTitle("totalCases");
  expect(count).toHaveTextContent(/^383$/);
  expect(screen.getByRole("button", { name: "Query3" })).toBeVisible();
});
it("shows a real zero when the catalogue has no Cases", () => {
  fixture({ summary: { ...summary, case_total: 0, total: 0, entries: [] } });
  expect(
    within(screen.getByRole("button", { name: "全部资源" })).getByTitle("totalCases"),
  ).toHaveTextContent(/^0$/);
});
it("keeps unknown totals distinct from zero and hides stale counts after an error", () => {
  const { props, rerender } = fixture({ summary: null, loading: true });
  const count = () =>
    within(screen.getByRole("button", { name: "全部资源" })).getByTitle("totalCases");
  expect(count()).toHaveTextContent("—");
  rerender(<EvalCaseResourceSidebar {...props} summary={summary} loading={false} error />);
  expect(count()).toHaveTextContent("—");
  expect(count()).not.toHaveTextContent("4");
});
