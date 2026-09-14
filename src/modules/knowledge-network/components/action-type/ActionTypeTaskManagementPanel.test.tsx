/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionTypeTaskManagementPanel } from "@/modules/knowledge-network/components/action-type/ActionTypeTaskManagementPanel";
import type {
  ActionTypeExecutionLogDetail,
  ActionTypeExecutionLogResultItem,
  ActionTypeExecutionResultQuery,
} from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  detail: vi.fn(),
  list: vi.fn(),
  results: vi.fn(),
  // A stable services object, as the app context provides.
  services: {
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => mocks.services,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  cancelKnowledgeNetworkActionTypeExecution: mocks.cancel,
  getKnowledgeNetworkActionTypeExecutionLogDetail: mocks.detail,
  listKnowledgeNetworkActionTypeExecutionLogs: mocks.list,
  listKnowledgeNetworkActionTypeExecutionResults: mocks.results,
}));

const log = {
  actionTypeId: "action-1",
  actionTypeName: "Check totals",
  durationMs: 1200,
  failedCount: 1,
  id: "exec-1",
  startTime: "2026-09-13 10:00:00",
  status: "completed" as const,
  successCount: 44,
  totalCount: 45,
  triggerType: "manual",
};

const detail: ActionTypeExecutionLogDetail = {
  ...log,
  endTime: "2026-09-13 10:00:02",
  executorName: "Admin",
  results: [
    { displayName: "embedded-1", status: "success" },
    { displayName: "embedded-2", status: "failed" },
  ],
};

function rows(total: number, status: ActionTypeExecutionLogResultItem["status"] = "success") {
  return Array.from({ length: total }, (_, index) => ({ displayName: `result-${index}`, durationMs: 5, status }));
}

// Serves pages of `all` the way the backend does: filtered by status, then sliced.
function serveResults(all: ActionTypeExecutionLogResultItem[], totalOverride?: number) {
  mocks.results.mockImplementation(
    (_networkId: string, _logId: string, query: ActionTypeExecutionResultQuery) => {
      const matched = all.filter((item) => !query.status || item.status === query.status);
      return Promise.resolve({
        entries: matched.slice(query.offset, query.offset + query.limit),
        totalCount: totalOverride ?? matched.length,
      });
    },
  );
}

async function openDetail() {
  render(<ActionTypeTaskManagementPanel actionTypeId="action-1" networkId="network-1" />);
  fireEvent.click(await screen.findByRole("button", { name: "common.actions" }));
  fireEvent.click(await screen.findByText("common.detail"));
  await screen.findByText("knowledgeNetwork.actionTypeExecutionResultTitle");
}

function resultTable() {
  const title = screen.getByText("knowledgeNetwork.actionTypeExecutionResultTitle");
  const table = title.closest("[class*=drawerBody]")?.querySelector(".ant-table-wrapper");
  expect(table).toBeTruthy();
  return table as HTMLElement;
}

function lastResultsQuery() {
  return mocks.results.mock.calls.at(-1)?.[2] as ActionTypeExecutionResultQuery | undefined;
}

describe("ActionTypeTaskManagementPanel execution results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // antd's responsive pagination queries media; jsdom does not implement matchMedia.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
    mocks.list.mockResolvedValue({ entries: [log], totalCount: 1 });
    mocks.detail.mockResolvedValue(detail);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pages results through the results endpoint", async () => {
    serveResults(rows(45));

    await openDetail();

    await within(resultTable()).findByText("result-0");
    expect(mocks.results).toHaveBeenCalledWith("network-1", "exec-1", { limit: 20, offset: 0, status: "" });

    fireEvent.click(within(resultTable()).getByTitle("2"));

    await within(resultTable()).findByText("result-20");
    expect(lastResultsQuery()).toEqual({ limit: 20, offset: 20, status: "" });
    expect(within(resultTable()).getByTitle("3")).toBeTruthy();
  }, 15_000);

  it("filters results by status and returns to the first page", async () => {
    serveResults([...rows(30), ...rows(3, "failed").map((item, index) => ({ ...item, displayName: `failed-${index}` }))]);

    await openDetail();
    await within(resultTable()).findByText("result-0");
    fireEvent.click(within(resultTable()).getByTitle("2"));
    await waitFor(() => expect(lastResultsQuery()?.offset).toBe(20));

    const filter = screen.getByRole("combobox", { name: "knowledgeNetwork.actionTypeExecutionResultStatusFilter" });
    fireEvent.mouseDown(filter.closest(".ant-select")!.querySelector(".ant-select-selector")!);
    fireEvent.click(await screen.findByTitle("knowledgeNetwork.actionTypeExecutionResultFailed"));

    await within(resultTable()).findByText("failed-0");
    expect(lastResultsQuery()).toEqual({ limit: 20, offset: 0, status: "failed" });
  }, 15_000);

  it("falls back to the results embedded in the detail when the endpoint is missing", async () => {
    mocks.results.mockResolvedValue(null);

    await openDetail();

    await within(resultTable()).findByText("embedded-1");
    expect(within(resultTable()).getByText("embedded-2")).toBeTruthy();
    expect(mocks.results).toHaveBeenCalledTimes(1);
    // Every result the execution has is embedded, so nothing is out of reach.
    expect(screen.queryByText("knowledgeNetwork.actionTypeExecutionResultWindowHint")).toBeNull();
  }, 15_000);

  it("says only the embedded first page can be browsed when the endpoint is missing", async () => {
    mocks.results.mockResolvedValue(null);
    mocks.detail.mockResolvedValue({ ...detail, resultsTotal: 250 });

    await openDetail();

    await within(resultTable()).findByText("embedded-1");
    expect(screen.getByText("knowledgeNetwork.actionTypeExecutionResultWindowHint")).toBeTruthy();
    // Paging still covers only what can be fetched: the two embedded rows fit on one page.
    expect(within(resultTable()).queryByTitle("2")).toBeNull();
  }, 15_000);

  it("labels cancelled and pending results instead of reporting them as failed", async () => {
    serveResults([
      { displayName: "was-cancelled", status: "cancelled" },
      { displayName: "not-started", status: "pending" },
    ]);

    await openDetail();

    const table = resultTable();
    await within(table).findByText("was-cancelled");
    expect(within(table).getByText("knowledgeNetwork.actionTypeExecutionStatusCancelled")).toBeTruthy();
    expect(within(table).getByText("knowledgeNetwork.actionTypeExecutionStatusPending")).toBeTruthy();
    expect(within(table).queryByText("knowledgeNetwork.actionTypeExecutionResultFailed")).toBeNull();
  }, 15_000);

  it("keeps paging within the endpoint's 10,000-result window", async () => {
    serveResults(rows(20), 12_000);

    await openDetail();

    await within(resultTable()).findByText("result-0");
    expect(screen.getByText("knowledgeNetwork.actionTypeExecutionResultWindowHint")).toBeTruthy();
    expect(within(resultTable()).getByTitle("500")).toBeTruthy();
    expect(within(resultTable()).queryByTitle("600")).toBeNull();
  }, 15_000);

  it("returns to the first page when the page size changes", async () => {
    serveResults(rows(120));

    await openDetail();
    await within(resultTable()).findByText("result-0");
    fireEvent.click(within(resultTable()).getByTitle("2"));
    await waitFor(() => expect(lastResultsQuery()?.offset).toBe(20));

    fireEvent.mouseDown(resultTable().querySelector(".ant-pagination-options .ant-select-selector")!);
    fireEvent.click(await screen.findByTitle("50 / page"));

    await waitFor(() => expect(lastResultsQuery()).toEqual({ limit: 50, offset: 0, status: "" }));
    expect(await within(resultTable()).findByText("result-49")).toBeTruthy();
    expect(within(resultTable()).getByTitle("3")).toBeTruthy();
    expect(within(resultTable()).queryByTitle("4")).toBeNull();
  }, 15_000);

  it("starts from the first page and every status when another execution is opened", async () => {
    const second = { ...log, id: "exec-2", startTime: "2026-09-13 11:00:00" };
    mocks.list.mockResolvedValue({ entries: [log, second], totalCount: 2 });
    mocks.detail.mockImplementation((_networkId: string, logId: string) =>
      Promise.resolve({ ...detail, id: logId }),
    );
    serveResults([...rows(30), ...rows(25, "failed").map((item, index) => ({ ...item, displayName: `failed-${index}` }))]);

    render(<ActionTypeTaskManagementPanel actionTypeId="action-1" networkId="network-1" />);
    const actionButtons = await screen.findAllByRole("button", { name: "common.actions" });
    fireEvent.click(actionButtons[0]);
    fireEvent.click(await screen.findByText("common.detail"));
    await within(await waitFor(() => resultTable())).findByText("result-0");

    const filter = screen.getByRole("combobox", { name: "knowledgeNetwork.actionTypeExecutionResultStatusFilter" });
    fireEvent.mouseDown(filter.closest(".ant-select")!.querySelector(".ant-select-selector")!);
    fireEvent.click(await screen.findByTitle("knowledgeNetwork.actionTypeExecutionResultFailed"));
    await within(resultTable()).findByText("failed-0");
    fireEvent.click(within(resultTable()).getByTitle("2"));
    await waitFor(() => expect(lastResultsQuery()).toEqual({ limit: 20, offset: 20, status: "failed" }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(actionButtons[1]);
    fireEvent.click((await screen.findAllByText("common.detail")).at(-1)!);

    await waitFor(() =>
      expect(mocks.results.mock.calls.at(-1)).toEqual([
        "network-1",
        "exec-2",
        { limit: 20, offset: 0, status: "" },
      ]),
    );
    expect(await within(resultTable()).findByText("result-0")).toBeTruthy();
  }, 20_000);

  it("ignores a slower response for a page the user has already left", async () => {
    let releaseFirstPage: (() => void) | undefined;
    mocks.results.mockImplementation(
      (_networkId: string, _logId: string, query: ActionTypeExecutionResultQuery) => {
        const all = rows(60);
        const page = {
          entries: all.slice(query.offset, query.offset + query.limit),
          totalCount: all.length,
        };
        if (query.offset === 20) {
          // The page-2 response arrives only after the user has moved on to page 3.
          return new Promise((resolve) => {
            releaseFirstPage = () => resolve(page);
          });
        }
        return Promise.resolve(page);
      },
    );

    await openDetail();
    await within(resultTable()).findByText("result-0");
    fireEvent.click(within(resultTable()).getByTitle("2"));
    await waitFor(() => expect(releaseFirstPage).toBeDefined());
    fireEvent.click(within(resultTable()).getByTitle("3"));
    await within(resultTable()).findByText("result-40");

    releaseFirstPage?.();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(within(resultTable()).getByText("result-40")).toBeTruthy();
    expect(within(resultTable()).queryByText("result-20")).toBeNull();
  }, 15_000);
});
