/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { IndexItem, ProjectIndex } from "@/modules/bkn-project/types/publish";

const getOntologyIndexMock = vi.hoisted(() => vi.fn());
const buildOntologyIndexMock = vi.hoisted(() => vi.fn());
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
  buildOntologyIndex: buildOntologyIndexMock,
  getOntologyIndex: getOntologyIndexMock,
}));

import { INDEX_POLL_MS } from "@/modules/bkn-project/services/publish.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { IndexReadiness } from "./IndexReadiness";

const item = (id: string, overrides: Partial<IndexItem> = {}): IndexItem => ({
  build: { outcome: "created", time: 1 },
  id,
  missing: [],
  name: `${id} name`,
  state: "ready",
  table: { catalogId: "c", name: `${id}_table`, resourceId: `r-${id}` },
  task: null,
  ...overrides,
});

function readiness(items: IndexItem[], tasksVisible = true): ProjectIndex {
  const counts: Record<string, number> = {};
  items.forEach((entry) => {
    counts[entry.state] = (counts[entry.state] ?? 0) + 1;
  });
  return { counts, objectTypes: items, tasksVisible };
}

const section = () => within(screen.getByRole("region", { name: "本地索引" }));

function renderIndex(canRun = true) {
  return renderWithoutAntdStyles(<IndexReadiness canRun={canRun} projectId="p1" />);
}

describe("IndexReadiness", () => {
  beforeAll(() => {
    // Ant Design's table reads breakpoints, which jsdom lacks.
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
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("shows each table's index and what its last build did, in plain words", async () => {
    getOntologyIndexMock.mockResolvedValue(
      readiness([
        item("customers"),
        item("orders", { state: "ready", task: { id: "t", status: "running" } }),
        item("lots", {
          build: { outcome: "not_configurable", reason: "primary_key_fields", time: 1 },
          missing: ["primary_key_fields"],
          state: "not_configured",
        }),
        item("bom", { build: { outcome: "no_permission", time: 1 }, state: "not_built" }),
        item("parts", {
          build: { outcome: "failed", reason: "vega: 500 boom", time: 1 },
          state: "stale",
        }),
      ]),
    );
    renderIndex();

    expect(await screen.findByText("2 / 5 张表的索引可用")).toBeInTheDocument();
    expect(section().getByText("customers name")).toBeInTheDocument();
    expect(section().getByText("customers_table")).toBeInTheDocument();
    expect(section().getByText("可用，正在重建")).toBeInTheDocument();
    expect(section().getByText("缺少构建设置")).toBeInTheDocument();
    expect(section().getByText("缺少：唯一标识字段")).toBeInTheDocument();
    expect(
      section().getByText("唯一标识字段的类型不能用来建索引（需要是数字或文字）。"),
    ).toBeInTheDocument();
    expect(
      section().getByText("确认人没有在这个数据目录构建索引的权限，开通后可以重新构建。"),
    ).toBeInTheDocument();
    expect(section().getByText("需要重建")).toBeInTheDocument();
    expect(section().getByText("没能开始构建，可以稍后重新构建。")).toBeInTheDocument();
    expect(section().queryByText(/vega|boom/)).toBeNull();
  });

  it("warns when build tasks cannot be seen, and says when nothing is adopted", async () => {
    getOntologyIndexMock.mockResolvedValueOnce(readiness([item("customers")], false));
    const view = renderIndex();
    expect(
      await screen.findByText(
        "你没有查看这个数据目录构建任务的权限，正在构建的索引可能显示为未构建。",
      ),
    ).toBeInTheDocument();
    view.unmount();

    getOntologyIndexMock.mockResolvedValueOnce(null);
    renderIndex();
    expect(await screen.findByText("还没有采纳的对象类")).toBeInTheDocument();
  });

  it("lets the owner build again what is not built, and follows the builds until they end", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getOntologyIndexMock
      .mockResolvedValueOnce(readiness([item("customers", { build: null, state: "not_built" })]))
      .mockResolvedValue(readiness([item("customers")]));
    buildOntologyIndexMock.mockResolvedValue(
      readiness([item("customers", { state: "building", task: { id: "t", status: "running" } })]),
    );
    renderIndex();

    fireEvent.click(await screen.findByRole("button", { name: "重新构建" }));
    await waitFor(() => expect(buildOntologyIndexMock).toHaveBeenCalledWith("p1"));
    expect(messageMock.success).toHaveBeenCalledWith("已重新发起构建");
    expect(await section().findByText("构建中")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(INDEX_POLL_MS));
    expect(await section().findByText("可用")).toBeInTheDocument();
    const reads = getOntologyIndexMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(INDEX_POLL_MS * 3));
    expect(getOntologyIndexMock.mock.calls.length).toBe(reads);
    // Every index is ready: nothing is left to build.
    expect(screen.getByRole("button", { name: "重新构建" })).toBeDisabled();
  });

  it("says when building again started no table, the rows saying why", async () => {
    getOntologyIndexMock.mockResolvedValue(
      readiness([
        item("lots", { build: null, missing: ["primary_key_fields"], state: "not_configured" }),
      ]),
    );
    buildOntologyIndexMock.mockResolvedValue(
      readiness([
        item("lots", {
          build: { outcome: "not_configurable", reason: "primary_key_fields", time: 2 },
          missing: ["primary_key_fields"],
          state: "not_configured",
        }),
      ]),
    );
    renderIndex();

    fireEvent.click(await screen.findByRole("button", { name: "重新构建" }));
    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith("没有表开始构建，原因见各表的“上次构建”。"),
    );
    expect(messageMock.success).not.toHaveBeenCalled();
    expect(
      section().getByText("唯一标识字段的类型不能用来建索引（需要是数字或文字）。"),
    ).toBeInTheDocument();
  });

  it("explains a refused build, and offers nothing to others", async () => {
    getOntologyIndexMock.mockResolvedValue(
      readiness([item("customers", { build: null, state: "stale" })]),
    );
    buildOntologyIndexMock.mockRejectedValue(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "raw", error_code: "BknProject.Index.ConfirmAgain" },
        status: 409,
      } as AxiosResponse),
    );
    const view = renderIndex();

    fireEvent.click(await screen.findByRole("button", { name: "重新构建" }));
    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith("确认之后草稿又改过，请先重新确认"),
    );
    view.unmount();

    renderIndex(false);
    expect(await screen.findByText("需要重建")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新构建" })).toBeNull();
  });

  it("offers to read the indexes again when they cannot be read", async () => {
    getOntologyIndexMock
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(readiness([item("customers")]));
    renderIndex();

    expect(await screen.findByText("本地索引暂时读取不到")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
    expect(await screen.findByText("1 / 1 张表的索引可用")).toBeInTheDocument();
  });
});
