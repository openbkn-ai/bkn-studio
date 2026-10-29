/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type {
  UnderstandingCatalog,
  UnderstandingStatus,
} from "@/modules/bkn-project/types/publish";

const getUnderstandingMock = vi.hoisted(() => vi.fn());
const understandCatalogsMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getUnderstanding: getUnderstandingMock,
  understandCatalogs: understandCatalogsMock,
}));

import { UNDERSTANDING_POLL_MS } from "@/modules/bkn-project/services/publish.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { UnderstandingBar } from "./UnderstandingBar";

function catalog(statuses: UnderstandingStatus[], catalogId = "cat-1"): UnderstandingCatalog {
  const counts: UnderstandingCatalog["counts"] = {};
  statuses.forEach((status) => {
    counts[status] = (counts[status] ?? 0) + 1;
  });
  return {
    catalogId,
    counts,
    tables: statuses.map((status, at) => ({
      applied: status === "completed",
      finishTime: status === "completed" ? 1 : null,
      name: `table_${at}`,
      resourceId: `r${at}`,
      status,
    })),
    visible: true,
  };
}

const onRedraft = vi.fn();

function renderBar(props: Partial<Parameters<typeof UnderstandingBar>[0]> = {}) {
  return renderWithoutAntdStyles(
    <UnderstandingBar
      archived={false}
      catalogNames={{ "cat-1": "供应链", "cat-2": "财务" }}
      hasDraft
      onRedraft={onRedraft}
      ownerIsCaller
      projectId="p1"
      redraftDisabled={false}
      {...props}
    />,
  );
}

describe("UnderstandingBar", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks what to understand and reports what was started and skipped", async () => {
    getUnderstandingMock.mockResolvedValue([catalog(["not_started", "not_started"])]);
    understandCatalogsMock.mockResolvedValue([
      { catalogId: "cat-1", permitted: true, tables: 2 },
      { catalogId: "cat-2", permitted: false, tables: 0 },
    ]);
    renderBar();

    expect(await screen.findByText("还没有运行过语义理解")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "语义理解" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("radio", { name: /只补充空缺/ })).toBeChecked();
    fireEvent.click(dialog.getByText("覆盖已有的名称和说明"));
    fireEvent.click(dialog.getByRole("button", { name: /开\s*始/ }));

    await waitFor(() =>
      expect(understandCatalogsMock).toHaveBeenCalledWith("p1", {
        all: false,
        applyMode: "force",
      }),
    );
    await waitFor(() => expect(messageMock.success).toHaveBeenCalledWith("已开始理解 2 张表"));
    expect(messageMock.warning).toHaveBeenCalledWith(
      "你在数据目录 财务 没有运行任务的权限，已跳过。请联系目录管理员开通后再试。",
    );
    expect(getUnderstandingMock).toHaveBeenCalledTimes(2);
  });

  it("says when nothing needed understanding", async () => {
    getUnderstandingMock.mockResolvedValue([catalog(["completed"])]);
    understandCatalogsMock.mockResolvedValue([{ catalogId: "cat-1", permitted: true, tables: 0 }]);
    renderBar();

    fireEvent.click(await screen.findByRole("button", { name: "语义理解" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: /开\s*始/ }));

    await waitFor(() =>
      expect(messageMock.info).toHaveBeenCalledWith(
        "没有需要理解的表。如需重新理解，请勾选“重新理解所有表”。",
      ),
    );
  });

  it("explains a refusal instead of showing the server's text", async () => {
    getUnderstandingMock.mockResolvedValue([catalog(["not_started"])]);
    understandCatalogsMock.mockRejectedValue(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "raw", error_code: "BknProject.Understand.NoCatalogs" },
        status: 409,
      } as AxiosResponse),
    );
    renderBar();

    fireEvent.click(await screen.findByRole("button", { name: "语义理解" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: /开\s*始/ }),
    );

    await waitFor(() => expect(messageMock.error).toHaveBeenCalledWith("项目还没有选择数据目录"));
  });

  it("shows the progress, estimates minutes for two tables or more, and stops polling when done", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getUnderstandingMock
      .mockResolvedValueOnce([catalog(["completed", "running", "pending", "pending"])])
      .mockResolvedValueOnce([catalog(["completed", "completed", "completed", "running"])])
      .mockResolvedValue([catalog(["completed", "completed", "completed", "completed"])]);
    renderBar();

    expect(await screen.findByText("语义理解：已完成 1 / 4 张表")).toBeInTheDocument();
    expect(screen.getByText("预计还需约 2 分钟")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(UNDERSTANDING_POLL_MS));
    expect(await screen.findByText("语义理解：已完成 3 / 4 张表")).toBeInTheDocument();
    // One table left: no estimate.
    expect(screen.queryByText(/预计还需/)).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(UNDERSTANDING_POLL_MS));
    expect(await screen.findByText("语义理解已完成")).toBeInTheDocument();
    // What finished during the visit changed the names drafting uses.
    fireEvent.click(screen.getByRole("button", { name: /重新起草/ }));
    expect(onRedraft).toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(UNDERSTANDING_POLL_MS * 3));
    expect(getUnderstandingMock).toHaveBeenCalledTimes(3);
  });

  it("does not offer drafting again while a draft is being drafted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getUnderstandingMock
      .mockResolvedValueOnce([catalog(["completed", "running"])])
      .mockResolvedValue([catalog(["completed", "completed"])]);
    renderBar({ redraftDisabled: true });

    expect(await screen.findByText("语义理解：已完成 1 / 2 张表")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(UNDERSTANDING_POLL_MS));
    expect(await screen.findByRole("button", { name: /重新起草/ })).toBeDisabled();
  });

  it("lists each table's status and the catalogs whose progress cannot be seen", async () => {
    getUnderstandingMock.mockResolvedValue([
      catalog(["completed", "failed"]),
      { catalogId: "cat-2", counts: {}, tables: [], visible: false },
    ]);
    renderBar();

    expect(await screen.findByText("1 张表没有完成理解")).toBeInTheDocument();
    expect(
      screen.getByText("无法查看数据目录 财务 的理解进度：你没有该目录运行任务的权限。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看各表" }));
    expect(screen.getByText("table_1")).toBeInTheDocument();
    expect(screen.getByText("未完成")).toBeInTheDocument();
    // A finished visit without anything running shows no hint to draft again.
    expect(screen.queryByRole("button", { name: /重新起草/ })).toBeNull();
  });

  it("offers nothing to run for others, an archived project, or when progress cannot be read", async () => {
    getUnderstandingMock.mockResolvedValue([catalog(["completed"])]);
    const { unmount } = renderBar({ ownerIsCaller: false });
    expect(await screen.findByText("语义理解已完成")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "语义理解" })).toBeNull();
    unmount();

    renderBar({ archived: true });
    expect(await screen.findByText("语义理解已完成")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "语义理解" })).toBeNull();
  });

  it("says when the progress cannot be read, and reads it again", async () => {
    getUnderstandingMock
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue([catalog(["completed"])]);
    renderBar();

    expect(await screen.findByText("语义理解进度暂时读取不到")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
    expect(await screen.findByText("语义理解已完成")).toBeInTheDocument();
  });
});
