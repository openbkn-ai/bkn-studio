/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

const listDataConnectConnectorTypesMock = vi.hoisted(() => vi.fn());
const listDataConnectRecordsMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Dropdown: ({ children, menu }: {
      children: ReactNode;
      menu: {
        items?: Array<{ key?: string | number; label?: ReactNode } | null>;
        onClick?: (info: { domEvent: { stopPropagation: () => void }; key: string }) => void;
      };
    }) => (
      <div>
        {children}
        {menu.items?.map((item) => item ? (
          <button
            key={item.key}
            onClick={() => menu.onClick?.({
              domEvent: { stopPropagation: vi.fn() },
              key: String(item.key),
            })}
            type="button"
          >
            {item.label}
          </button>
        ) : null)}
      </div>
    ),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn(), warning: vi.fn() },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/safety/DangerDeleteModal", () => ({
  DeleteImpactAlert: () => null,
  useDangerDelete: () => ({ node: null, open: vi.fn() }),
}));

vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({ columns, dataSource }: {
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
    internal: false,
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
        record("catalog-manager", [
          "delete",
          "modify",
          "task_manage",
          "view_detail",
        ]),
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
    const managerRow = await screen.findByTestId("record-catalog-manager");

    expect(within(viewOnlyRow).getByRole("button", { name: "common.detail" })).toBeTruthy();
    expect(within(viewOnlyRow).queryByRole("button", {
      name: "dataConnect.discoverManage",
    })).toBeNull();
    for (const action of [
      "common.edit",
      "common.testConnection",
      "common.disabled",
      "common.delete",
    ]) {
      expect(within(viewOnlyRow).queryByRole("button", { name: action })).toBeNull();
    }

    fireEvent.click(within(managerRow).getByRole("button", {
      name: "dataConnect.discoverManage",
    }));
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
    expect(listDataConnectRecordsMock).toHaveBeenCalledWith(
      expect.anything(),
      { skipErrorToast: true },
    );
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
    await waitFor(() => expect(listDataConnectRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({ connectorType: "postgresql", keyword: "orders" }),
      { skipErrorToast: true },
    ));
    const beforeRefresh = listDataConnectRecordsMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /common\.refresh$/ }));

    expect(search).toHaveValue("orders");
    await waitFor(() => expect(listDataConnectRecordsMock).toHaveBeenCalledTimes(beforeRefresh + 1));
    expect(listDataConnectRecordsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      connectorType: "postgresql",
      keyword: "orders",
    }), { skipErrorToast: true });
  });

  it("does not let an older search result replace the latest connection records", async () => {
    let resolveSlow: (value: { items: DataConnectRecord[]; total: number }) => void = () => undefined;
    const slowResult = new Promise<{ items: DataConnectRecord[]; total: number }>((resolve) => {
      resolveSlow = resolve;
    });
    listDataConnectRecordsMock.mockImplementation(({ keyword }: { keyword: string }) => {
      if (keyword === "slow") return slowResult;
      if (keyword === "fast") return Promise.resolve({
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
    await waitFor(() => expect(listDataConnectRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "slow" }),
      { skipErrorToast: true },
    ));
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
    const firstResult = new Promise<{ items: DataConnectRecord[]; total: number }>((_resolve, reject) => {
      rejectFirst = reject;
    });
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
