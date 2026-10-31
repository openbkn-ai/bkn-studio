/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { Project } from "@/modules/bkn-project/types/project";
import type { DataSources, ProjectStatus } from "@/modules/bkn-project/types/publish";

const getProjectStatusMock = vi.hoisted(() => vi.fn());
const setProjectArchivedMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: confirmMock } }),
}));

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getProjectStatus: getProjectStatusMock,
}));

vi.mock("@/modules/bkn-project/services/project.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/project.service")>()),
  setProjectArchived: setProjectArchivedMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { DATA_SOURCES_RETRY_MS, DataSourceHealth } from "./DataSourceHealth";

const project = {
  archived: false,
  catalogIds: ["c1"],
  id: "p1",
  name: "供应链",
} as Project;

const ok: DataSources = {
  catalogs: { missing: 0, state: "ok", total: 2 },
  network: { missing: 0, state: "ok", total: 1 },
  tables: { affected: [], missing: 0, state: "ok", total: 11 },
};

function status(
  dataSources: DataSources | null,
  nextActions: ProjectStatus["nextActions"] = [],
): ProjectStatus {
  return {
    blockers: [],
    check: null,
    confirmation: null,
    dataSources,
    draft: null,
    hints: [],
    nextActions,
    release: null,
    stage: "deciding",
    stale: [],
    undecided: 0,
    unresolvedConflicts: 0,
  };
}

const action = (name: string, allowed = true, reason?: string) => ({
  accepts: [],
  action: name,
  allowed,
  discardsDecisions: 0,
  ...(reason ? { reason } : {}),
});

function renderHealth(of: Project = project) {
  const onGoToModel = vi.fn();
  const onProjectChange = vi.fn();
  const view = renderWithoutAntdStyles(
    <DataSourceHealth onGoToModel={onGoToModel} onProjectChange={onProjectChange} project={of} />,
  );
  return { onGoToModel, onProjectChange, view };
}

describe("DataSourceHealth", () => {
  beforeAll(() => {
    // Ant Design reads breakpoints, which jsdom lacks.
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

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
  });

  afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("zh-CN");
  });

  it("says every source is there, and nothing while the first draft is made", async () => {
    getProjectStatusMock.mockResolvedValueOnce(status(ok));
    const { view } = renderHealth();
    expect(await screen.findByText("数据来源")).toBeInTheDocument();
    expect(screen.getByText("可用")).toBeInTheDocument();
    expect(screen.getByText("2 个，都在")).toBeInTheDocument();
    expect(screen.getByText("11 张，都能查到数据")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    view.unmount();

    getProjectStatusMock.mockResolvedValueOnce(status(null));
    renderHealth();
    await waitFor(() => expect(getProjectStatusMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("数据来源")).toBeNull();
  });

  it("names the items whose tables are gone by their names, and leads the owner on", async () => {
    getProjectStatusMock.mockResolvedValue(
      status(
        {
          catalogs: { missing: 1, state: "missing", total: 1 },
          network: { missing: 0, state: "ok", total: 1 },
          tables: {
            affected: [
              { id: "ot_customer", kind: "object_types", name: "客户", table: "customers" },
              { id: "rt_order", kind: "relation_types", name: "下单", table: "order_links" },
            ],
            missing: 2,
            state: "missing",
            total: 10,
          },
        },
        [action("set_catalogs"), action("archive")],
      ),
    );
    const { onGoToModel } = renderHealth();

    expect(await screen.findByText("1 / 1 个已被删除")).toBeInTheDocument();
    expect(screen.getByText("2 / 10 张查不到数据")).toBeInTheDocument();
    expect(
      screen.getByText("项目选用的 1 个数据目录已被删除。请重新选择数据目录，再重新起草。"),
    ).toBeInTheDocument();
    expect(screen.getByText("对象类「客户」（数据表 customers）已查不到数据")).toBeInTheDocument();
    expect(
      screen.getByText("关系类「下单」（连接表 order_links）已查不到数据"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ot_customer|rt_order|catalog_missing/)).toBeNull();
    // The network is there, so archiving is not what the page suggests.
    expect(screen.queryByRole("button", { name: "归档项目" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "重新选择数据目录" }));
    fireEvent.click(screen.getByRole("button", { name: "去重新起草" }));
    expect(onGoToModel).toHaveBeenCalledTimes(2);
  });

  it("offers to archive a project whose network is gone, after asking", async () => {
    getProjectStatusMock.mockResolvedValue(
      status(
        {
          catalogs: { missing: 0, state: "ok", total: 1 },
          network: { missing: 1, state: "missing", total: 1 },
          tables: { affected: [], missing: 0, state: "not_bound", total: 0 },
        },
        [action("archive")],
      ),
    );
    setProjectArchivedMock.mockResolvedValue({ ...project, archived: true });
    const { onProjectChange } = renderHealth();

    expect(
      await screen.findByText("项目的知识网络已被删除，无法再确认或发布。可以归档此项目。"),
    ).toBeInTheDocument();
    expect(screen.getByText("还没有采用的条目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    const [{ onOk }] = confirmMock.mock.calls[0] as [{ onOk: () => Promise<unknown> }];
    await onOk();
    expect(setProjectArchivedMock).toHaveBeenCalledWith("p1", true);
    expect(onProjectChange).toHaveBeenCalledWith({ ...project, archived: true });
  });

  it("offers no change on an archived project, and asks others to contact the owner", async () => {
    const gone = status(
      {
        catalogs: { missing: 1, state: "missing", total: 1 },
        network: { missing: 0, state: "ok", total: 1 },
        tables: { affected: [], missing: 10, state: "missing", total: 10 },
      },
      [action("set_catalogs", false, "not_owner")],
    );
    getProjectStatusMock.mockResolvedValue(gone);
    const { view } = renderHealth({ ...project, archived: true });
    expect(
      await screen.findByText("项目已归档，恢复后才能重新选择数据目录或重新起草。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    view.unmount();

    renderHealth();
    expect(await screen.findByText("请联系项目负责人更换数据目录。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新选择数据目录" })).toBeNull();
    expect(screen.queryByRole("button", { name: "去重新起草" })).toBeNull();
  });

  it("says what could not be checked, and asks again later", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getProjectStatusMock
      .mockResolvedValueOnce(
        status({
          ...ok,
          catalogs: { missing: 0, state: "unreachable", total: 1 },
          tables: { affected: [], missing: 0, state: "unreachable", total: 10 },
        }),
      )
      .mockResolvedValue(status(ok));
    renderHealth();
    expect(
      await screen.findByText("暂时无法确认数据目录、数据表是否还在，稍后会自动重试"),
    ).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(DATA_SOURCES_RETRY_MS));
    expect(await screen.findByText("2 个，都在")).toBeInTheDocument();
  });

  it("says it in English, a long name included", async () => {
    await i18n.changeLanguage("en-US");
    const name = "Quarterly purchase order line items with supplier confirmation history";
    getProjectStatusMock.mockResolvedValue(
      status({
        ...ok,
        tables: {
          affected: [{ id: "ot1", kind: "object_types", name, table: "po_line_items_v2" }],
          missing: 1,
          state: "missing",
          total: 40,
        },
      }),
    );
    renderHealth();
    expect(await screen.findByText("1 of 40 return no data")).toBeInTheDocument();
    expect(
      screen.getByText(`Object type "${name}" (table po_line_items_v2) returns no data`),
    ).toBeInTheDocument();
    expect(screen.getByText(/^The table behind 1 item was deleted/)).toBeInTheDocument();
  });
});
