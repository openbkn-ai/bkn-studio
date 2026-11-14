/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { Project } from "@/modules/bkn-project/types/project";
import type { DataSources, ProjectStatus } from "@/modules/bkn-project/types/publish";

const getProjectStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getProjectStatus: getProjectStatusMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { DATA_SOURCES_RETRY_MS, DataSourceHealth } from "./DataSourceHealth";

const project = {
  archived: false,
  catalogIds: ["c1"],
  id: "p1",
  knId: "kn1",
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
    unreviewed: 0,
  };
}

const action = (name: string, allowed = true, reason?: string) => ({
  accepts: [],
  action: name,
  allowed,
  discardsDecisions: 0,
  ...(reason ? { reason } : {}),
});

// The network's name links to it.
const routed = (node: ReactNode) => <MemoryRouter>{node}</MemoryRouter>;

function renderHealth(of: Project = project) {
  const onGoToModel = vi.fn();
  const onGoToResources = vi.fn();
  const view = renderWithoutAntdStyles(
    routed(
      <DataSourceHealth
        networkName="供应链网络"
        onGoToModel={onGoToModel}
        onGoToResources={onGoToResources}
        project={of}
      />,
    ),
  );
  return { onGoToModel, onGoToResources, view };
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
    // The network has no health: it is connected, by its name, which leads to it.
    expect(screen.getByText("已连接")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "供应链网络" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/kn1/overview",
    );
    expect(screen.queryByText("可用")).toBeNull();
    expect(screen.getAllByText("正常")).toHaveLength(2);
    expect(screen.getByText("2 个，都在")).toBeInTheDocument();
    expect(screen.getByText("11 张，都能查到数据")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    view.unmount();

    getProjectStatusMock.mockResolvedValueOnce(status(null));
    renderHealth();
    await waitFor(() => expect(getProjectStatusMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("数据来源")).toBeNull();
  });

  it("reads the tables again once the draft changes, as when the model is confirmed", async () => {
    const notBound: DataSources = {
      ...ok,
      tables: { affected: [], missing: 0, state: "not_bound", total: 0 },
    };
    getProjectStatusMock.mockResolvedValueOnce(status(notBound)).mockResolvedValueOnce(status(ok));
    const view = renderWithoutAntdStyles(
      routed(
        <DataSourceHealth
          draftVersion="ready:1"
          onGoToModel={vi.fn()}
          onGoToResources={vi.fn()}
          project={project}
        />,
      ),
    );
    expect(await screen.findByText("还没有采用的条目")).toBeInTheDocument();

    view.rerender(
      routed(
        <DataSourceHealth
          draftVersion="ready:2"
          onGoToModel={vi.fn()}
          onGoToResources={vi.fn()}
          project={project}
        />,
      ),
    );

    expect(await screen.findByText("11 张，都能查到数据")).toBeInTheDocument();
    expect(getProjectStatusMock).toHaveBeenCalledTimes(2);
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
    const { onGoToModel, onGoToResources } = renderHealth();

    expect(await screen.findByText("1 / 1 个已被删除")).toBeInTheDocument();
    // Each source states itself with the platform's tag: the network is connected, the others gone.
    expect(screen.getByText("已连接")).toBeInTheDocument();
    expect(screen.getAllByText("已失效")).toHaveLength(2);
    expect(screen.getByText("2 / 10 张查不到数据")).toBeInTheDocument();
    // One cause, one notice: the gone catalog, with the items it takes along and one thing to do.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.getByText(
        "项目选用的 1 个数据目录已不存在，用到它们的条目也查不到数据。请更换数据目录，再重新起草。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("对象类「客户」（数据表 customers）已查不到数据")).toBeInTheDocument();
    expect(
      screen.getByText("关系类「下单」（连接表 order_links）已查不到数据"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ot_customer|rt_order|catalog_missing/)).toBeNull();
    // The network is there, so archiving is not what the page suggests.

    // Catalogs are chosen with the project's other inputs, the one thing to do first.
    fireEvent.click(screen.getByRole("button", { name: "重新选择数据目录" }));
    expect(onGoToResources).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "去重新起草" })).toBeNull();
    expect(onGoToModel).not.toHaveBeenCalled();
  });

  it("lists the first few gone items, all of them on asking, and folds them back", async () => {
    const affected = Array.from({ length: 5 }, (_, index) => ({
      id: `ot${index}`,
      kind: "object_types" as const,
      name: `条目${index}`,
      table: `t${index}`,
    }));
    getProjectStatusMock.mockResolvedValue(
      status({ ...ok, tables: { affected, missing: 5, state: "missing", total: 5 } }),
    );
    renderHealth();
    expect(await screen.findByText(/「条目2」/)).toBeInTheDocument();
    expect(screen.queryByText(/「条目3」/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "展开全部（共 5 条）" }));
    expect(screen.getByText(/「条目4」/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /收\s*起/ }));
    expect(screen.queryByText(/「条目4」/)).toBeNull();
  });

  it("says a project whose network is gone can be deleted, and offers no archiving", async () => {
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
    renderHealth();

    expect(
      await screen.findByText(
        "项目的知识网络已被删除，无法再确认或发布。可以在项目列表中删除此项目。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("还没有采用的条目")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "归档项目" })).toBeNull();
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

  it("names a gone table by its business and physical names, and says what was reconnected", async () => {
    getProjectStatusMock.mockResolvedValue(
      status({
        ...ok,
        reconnected: 3,
        tables: {
          affected: [
            {
              id: "customer",
              kind: "object_types",
              name: "客户",
              sourceTable: "customer_entity",
              table: "客户",
            },
            {
              id: "order",
              kind: "object_types",
              name: "订单",
              sourceTable: "orders",
              table: "orders",
            },
          ],
          missing: 2,
          state: "missing",
          total: 10,
        },
      }),
    );
    renderHealth();
    expect(
      await screen.findByText("对象类「客户」（数据表 客户（customer_entity））已查不到数据"),
    ).toBeInTheDocument();
    // The same name is said once.
    expect(screen.getByText("对象类「订单」（数据表 orders）已查不到数据")).toBeInTheDocument();
    expect(
      screen.getByText("已按表名重新连接 3 张表：数据目录重建后找到了同名的表，已做的决定都保留。"),
    ).toBeInTheDocument();
  });

  it("says nothing was reconnected when nothing was", async () => {
    getProjectStatusMock.mockResolvedValue(status({ ...ok, reconnected: 0 }));
    renderHealth();
    expect(await screen.findByText("11 张，都能查到数据")).toBeInTheDocument();
    expect(screen.queryByText(/已按表名重新连接/)).toBeNull();
  });
});
