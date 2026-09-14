/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
});
