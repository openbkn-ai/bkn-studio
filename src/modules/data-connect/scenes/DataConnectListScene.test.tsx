/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { dataConnectEnUS } from "@/modules/data-connect/locales/en-US";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogDeletionImpact } from "@/shared/catalog";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

const deletionI18n = createInstance();
void deletionI18n.init({
  lng: "en-US",
  resources: { "en-US": { translation: dataConnectEnUS } },
  initImmediate: false,
});

const previewCatalogDeletionMock = vi.hoisted(() => vi.fn());
const dangerOpenMock = vi.hoisted(() => vi.fn());
const warningMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/catalog")>()),
  previewCatalogDeletion: previewCatalogDeletionMock,
}));

const listDataConnectConnectorTypesMock = vi.hoisted(() => vi.fn());
const listDataConnectRecordsMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.startsWith("dataConnect.dangerDelete.") ? deletionI18n.t(key, values ?? {}) : key,
  }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Dropdown: ({
      children,
      menu,
    }: {
      children: ReactNode;
      menu: {
        items?: Array<{ key?: string | number; label?: ReactNode } | null>;
        onClick?: (info: { domEvent: { stopPropagation: () => void }; key: string }) => void;
      };
    }) => (
      <div>
        {children}
        {menu.items?.map((item) =>
          item ? (
            <button
              key={item.key}
              onClick={() =>
                menu.onClick?.({
                  domEvent: { stopPropagation: vi.fn() },
                  key: String(item.key),
                })
              }
              type="button"
            >
              {item.label}
            </button>
          ) : null,
        )}
      </div>
    ),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn(), warning: warningMock },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/safety/DangerDeleteModal", () => ({
  DeleteImpactAlert: ({ detail, warning }: { detail: ReactNode; warning?: ReactNode }) => (
    <div>
      {detail}
      {warning}
    </div>
  ),
  useDangerDelete: () => ({ node: null, open: dangerOpenMock }),
}));

vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({
    columns,
    dataSource,
  }: {
    columns: Array<{
      key?: string;
      render?: (value: unknown, record: DataConnectRecord) => ReactNode;
    }>;
    dataSource: DataConnectRecord[];
  }) => {
    const actionColumn = columns.find((column) => column.key === "actions");
    return (
      <div>
        {dataSource.map((record) => (
          <section data-testid={`record-${record.id}`} key={record.id}>
            {actionColumn?.render?.(undefined, record)}
          </section>
        ))}
      </div>
    );
  },
}));

vi.mock("@/framework/ui/common/TablePaginationBar", () => ({
  TablePaginationBar: () => null,
}));

vi.mock("@/framework/ui/common/TableSurface", () => ({
  TableSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/modules/data-connect/components/DataConnectDetailDrawer", () => ({
  DataConnectDetailDrawer: () => null,
}));

vi.mock("@/modules/data-connect/services/data-connect.service", () => ({
  deleteDataConnectRecord: vi.fn(),
  listDataConnectConnectorTypes: listDataConnectConnectorTypesMock,
  listDataConnectRecords: listDataConnectRecordsMock,
  setDataConnectRecordEnabled: vi.fn(),
  testDataConnectRecord: vi.fn(),
}));

import { DataConnectListScene } from "./DataConnectListScene";

function record(id: string, operations: string[]): DataConnectRecord {
  return {
    category: "table",
    connectorConfig: {},
    connectorType: "postgresql",
    createTime: null,
    creatorName: "test",
    description: "",
    enabled: true,
    expectedUpdateTime: 1,
    healthCheckResult: "",
    healthStatus: "healthy",
    id,
    builtin: false,
    lastCheckTime: null,
    metadata: {},
    mode: "direct",
    name: id,
    operations,
    status: "enabled",
    tags: [],
    type: "physical",
    updateTime: null,
    updaterName: "test",
  };
}

describe("DataConnectListScene object permissions", () => {
  const onEdit = vi.fn();
  const onOpenDiscovers = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    listDataConnectConnectorTypesMock.mockResolvedValue([]);
    listDataConnectRecordsMock.mockResolvedValue({
      items: [
        record("catalog-view-only", ["view_detail"]),
        record("catalog-summary-only", ["view_summary"]),
        record("catalog-manager", ["delete", "modify", "task_manage", "view_detail"]),
      ],
      total: 2,
    });
  });

  it("isolates discover and mutation actions to each catalog's effective operations", async () => {
    render(
      <MemoryRouter>
        <DataConnectListScene onEdit={onEdit} onOpenDiscovers={onOpenDiscovers} />
      </MemoryRouter>,
    );

    const viewOnlyRow = await screen.findByTestId("record-catalog-view-only");
    const summaryOnlyRow = await screen.findByTestId("record-catalog-summary-only");
    const managerRow = await screen.findByTestId("record-catalog-manager");

    expect(within(viewOnlyRow).getByRole("button", { name: "common.detail" })).toBeTruthy();
    expect(
      within(viewOnlyRow).queryByRole("button", {
        name: "dataConnect.discoverManage",
      }),
    ).toBeNull();
    expect(within(summaryOnlyRow).queryByRole("button", { name: "common.detail" })).toBeNull();
    expect(
      within(summaryOnlyRow).queryByRole("button", {
        name: "dataConnect.moreActions",
      }),
    ).toBeNull();
    for (const action of [
      "common.edit",
      "common.testConnection",
      "common.disabled",
      "common.delete",
    ]) {
      expect(within(viewOnlyRow).queryByRole("button", { name: action })).toBeNull();
    }

    fireEvent.click(
      within(managerRow).getByRole("button", {
        name: "dataConnect.discoverManage",
      }),
    );
    fireEvent.click(within(managerRow).getByRole("button", { name: "common.edit" }));

    await waitFor(() => {
      expect(onOpenDiscovers).toHaveBeenCalledWith("catalog-manager");
      expect(onEdit).toHaveBeenCalledWith("catalog-manager");
    });
  });

  it("shows a manual refresh hint without a retry button when connections fail to load", async () => {
    listDataConnectRecordsMock.mockRejectedValue(new Error("connections unavailable"));
    render(
      <MemoryRouter>
        <DataConnectListScene onEdit={onEdit} onOpenDiscovers={onOpenDiscovers} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("connections unavailable")).toBeInTheDocument();
    expect(listDataConnectRecordsMock).toHaveBeenCalledWith(expect.anything(), {
      skipErrorToast: true,
    });
    expect(screen.queryByRole("button", { name: "common.retry" })).toBeNull();
    expect(screen.getByText("dataConnect.loadErrorRefreshHint")).toBeInTheDocument();
  });

  it("keeps connection records visible when connector types fail to load", async () => {
    listDataConnectConnectorTypesMock.mockRejectedValue(new Error("connector types unavailable"));
    render(
      <MemoryRouter>
        <DataConnectListScene onEdit={onEdit} onOpenDiscovers={onOpenDiscovers} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("record-catalog-view-only")).toBeInTheDocument();
    expect(screen.getByTestId("record-catalog-manager")).toBeInTheDocument();
    expect(screen.queryByText("connector types unavailable")).toBeNull();
    expect(screen.queryByText("dataConnect.loadErrorRefreshHint")).toBeNull();
  });

  it("shows connection records without waiting for connector types", async () => {
    listDataConnectConnectorTypesMock.mockImplementation(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <DataConnectListScene onEdit={onEdit} onOpenDiscovers={onOpenDiscovers} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("record-catalog-view-only")).toBeInTheDocument();
    expect(screen.getByTestId("record-catalog-manager")).toBeInTheDocument();
    expect(screen.queryByText("dataConnect.loadErrorRefreshHint")).toBeNull();
  });

  it("reloads connection records when refreshing with unchanged filters", async () => {
    render(
      <MemoryRouter>
        <DataConnectListScene onEdit={onEdit} onOpenDiscovers={onOpenDiscovers} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("record-catalog-view-only")).toBeInTheDocument();
    listDataConnectRecordsMock.mockResolvedValue({
      items: [record("catalog-refreshed", ["view_detail"])],
      total: 1,
    });
    fireEvent.click(screen.getByRole("button", { name: /common\.refresh$/ }));

    expect(await screen.findByTestId("record-catalog-refreshed")).toBeInTheDocument();
    expect(listDataConnectRecordsMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the active search and connector filter when refreshing connections", async () => {
    render(
      <MemoryRouter>
        <DataConnectListScene
          defaultConnectorType="postgresql"
          onEdit={onEdit}
          onOpenDiscovers={onOpenDiscovers}
        />
      </MemoryRouter>,
    );

    const search = screen.getByPlaceholderText("dataConnect.searchPlaceholder");
    fireEvent.change(search, { target: { value: "orders" } });
    await waitFor(() =>
      expect(listDataConnectRecordsMock).toHaveBeenCalledWith(
        expect.objectContaining({ connectorType: "postgresql", keyword: "orders" }),
        { skipErrorToast: true },
      ),
    );
    const beforeRefresh = listDataConnectRecordsMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /common\.refresh$/ }));

    expect(search).toHaveValue("orders");
    await waitFor(() =>
      expect(listDataConnectRecordsMock).toHaveBeenCalledTimes(beforeRefresh + 1),
    );
    expect(listDataConnectRecordsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connectorType: "postgresql",
        keyword: "orders",
      }),
      { skipErrorToast: true },
    );
  });

  it("does not let an older search result replace the latest connection records", async () => {
    let resolveSlow: (value: { items: DataConnectRecord[]; total: number }) => void = () =>
      undefined;
    const slowResult = new Promise<{ items: DataConnectRecord[]; total: number }>((resolve) => {
      resolveSlow = resolve;
    });
    listDataConnectRecordsMock.mockImplementation(({ keyword }: { keyword: string }) => {
      if (keyword === "slow") return slowResult;
      if (keyword === "fast")
        return Promise.resolve({
          items: [record("catalog-fast", ["view_detail"])],
          total: 1,
        });
      return Promise.resolve({
        items: [record("catalog-initial", ["view_detail"])],
        total: 1,
      });
    });

    render(
      <MemoryRouter>
        <DataConnectListScene onEdit={onEdit} onOpenDiscovers={onOpenDiscovers} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("record-catalog-initial")).toBeInTheDocument();
    const search = screen.getByPlaceholderText("dataConnect.searchPlaceholder");
    fireEvent.change(search, { target: { value: "slow" } });
    await waitFor(() =>
      expect(listDataConnectRecordsMock).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "slow" }),
        { skipErrorToast: true },
      ),
    );
    fireEvent.change(search, { target: { value: "fast" } });
    expect(await screen.findByTestId("record-catalog-fast")).toBeInTheDocument();

    await act(async () => {
      resolveSlow({ items: [record("catalog-slow", ["view_detail"])], total: 1 });
      await slowResult;
    });
    expect(screen.getByTestId("record-catalog-fast")).toBeInTheDocument();
    expect(screen.queryByTestId("record-catalog-slow")).toBeNull();
  });

  it("does not show an older load error after a newer refresh succeeds", async () => {
    let rejectFirst: (error: Error) => void = () => undefined;
    const firstResult = new Promise<{ items: DataConnectRecord[]; total: number }>(
      (_resolve, reject) => {
        rejectFirst = reject;
      },
    );
    listDataConnectRecordsMock.mockImplementationOnce(() => firstResult);
    listDataConnectRecordsMock.mockResolvedValue({
      items: [record("catalog-current", ["view_detail"])],
      total: 1,
    });

    render(
      <MemoryRouter>
        <DataConnectListScene onEdit={onEdit} onOpenDiscovers={onOpenDiscovers} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listDataConnectRecordsMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /common\.refresh$/ }));
    expect(await screen.findByTestId("record-catalog-current")).toBeInTheDocument();

    await act(async () => {
      rejectFirst(new Error("outdated request failed"));
      await firstResult.catch(() => undefined);
    });
    expect(screen.getByTestId("record-catalog-current")).toBeInTheDocument();
    expect(screen.queryByText("outdated request failed")).toBeNull();
  });
});

describe("DataConnectListScene deletion preflight", () => {
  function impact(): CatalogDeletionImpact {
    return {
      catalogId: "catalog-1",
      canDelete: true,
      blockers: [],
      resources: 0,
      protectedResources: 0,
      discoverSchedules: 0,
      catalogHealthCheckSchedules: 0,
      buildTasks: { willDelete: 0, blocking: 0 },
      discoverTasks: { willDelete: 0, blocking: 0 },
      semanticUnderstandingTasks: { willDelete: 0, blocking: 0 },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listDataConnectConnectorTypesMock.mockResolvedValue([]);
    listDataConnectRecordsMock.mockResolvedValue({
      items: [record("catalog-1", ["delete"])],
      total: 1,
    });
  });

  async function requestDeletion(report: CatalogDeletionImpact) {
    previewCatalogDeletionMock.mockResolvedValue(report);
    render(
      <MemoryRouter>
        <DataConnectListScene />
      </MemoryRouter>,
    );
    const row = await screen.findByTestId("record-catalog-1");
    fireEvent.click(within(row).getByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(previewCatalogDeletionMock).toHaveBeenCalledWith("catalog-1"));
  }

  it.each(
    (["buildTasks", "discoverTasks", "semanticUnderstandingTasks"] as const).flatMap((taskType) =>
      [1, 3].map((count) => ({ taskType, count })),
    ),
  )(
    "requires name confirmation and formats $count $taskType record(s)",
    async ({ taskType, count }) => {
      const report = impact();
      report[taskType].willDelete = count;
      await requestDeletion(report);
      await waitFor(() => expect(dangerOpenMock).toHaveBeenCalled());
      const options = dangerOpenMock.mock.calls[0][0] as {
        requireTypeName: boolean;
        impact: ReactNode;
      };
      expect(options.requireTypeName).toBe(true);
      render(<>{options.impact}</>);
      expect(
        screen.getByText(
          `${taskType === "buildTasks" ? "Build" : taskType === "discoverTasks" ? "Discovery" : "Semantic"} tasks: delete ${count} task ${count === 1 ? "record" : "records"}, 0 blocking`,
        ),
      ).toBeTruthy();
      expect(screen.getByText(/all associated task records.*will be deleted/)).toBeTruthy();
      expect(warningMock).not.toHaveBeenCalled();
    },
  );

  it("uses the empty catalog confirmation when all counts are zero", async () => {
    await requestDeletion(impact());
    await waitFor(() => expect(dangerOpenMock).toHaveBeenCalled());
    expect(dangerOpenMock.mock.calls[0][0]).toMatchObject({ requireTypeName: false });
    const options = dangerOpenMock.mock.calls[0][0] as { impact: ReactNode };
    render(<>{options.impact}</>);
    expect(
      screen.getByText(
        'Connection "catalog-1" has no cascading objects. Deletion still cannot be undone.',
      ),
    ).toBeTruthy();
  });

  it("shows blockers without opening deletion confirmation", async () => {
    const report = impact();
    report.canDelete = false;
    report.blockers = ["discover_tasks_running"];
    report.discoverTasks = { willDelete: 4, blocking: 1 };
    await requestDeletion(report);
    await waitFor(() => expect(warningMock).toHaveBeenCalled());
    expect(dangerOpenMock).not.toHaveBeenCalled();
    const options = warningMock.mock.calls[0][0] as { content: ReactNode };
    render(<>{options.content}</>);
    expect(screen.getByText("Discovery tasks: delete 4 task records, 1 blocking")).toBeTruthy();
  });
});
