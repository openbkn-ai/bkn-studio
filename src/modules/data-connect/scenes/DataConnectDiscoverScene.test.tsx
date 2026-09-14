/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import taskStyles from "@/framework/ui/common/TaskDetailDrawer.module.css";

import { DataConnectDiscoverScene } from "./DataConnectDiscoverScene";

const {
  appServicesMock,
  getCatalogMock,
  getScheduleMock,
  listCatalogsMock,
  listTasksMock,
  listSchedulesMock,
  updateScheduleMock,
} = vi.hoisted(() => ({
  appServicesMock: {
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  },
  getCatalogMock: vi.fn(),
  getScheduleMock: vi.fn(),
  listCatalogsMock: vi.fn(),
  listTasksMock: vi.fn(),
  listSchedulesMock: vi.fn(),
  updateScheduleMock: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("antd", () => ({
  Alert: ({ action, children, message }: { action?: ReactNode; children?: ReactNode; message?: ReactNode }) => (
    <div>{message}{children}{action}</div>
  ),
  Input: ({ onChange, value }: { onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void; value?: string }) => (
    <input onChange={onChange} value={value} />
  ),
  Select: ({ options = [] }: { options?: Array<{ label: ReactNode; value: string }> }) => (
    <div data-testid="catalog-options">
      {options.map((option) => <span key={option.value}>{option.label}</span>)}
    </div>
  ),
  Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Switch: () => null,
  Tabs: ({
    activeKey,
    items,
    onChange,
  }: {
    activeKey: string;
    items: Array<{ children: ReactNode; key: string; label: ReactNode }>;
    onChange: (key: string) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.key} onClick={() => onChange(item.key)} type="button">
          {item.label}
        </button>
      ))}
      {items.find((item) => item.key === activeKey)?.children}
    </div>
  ),
  Tag: ({ children, color }: { children?: ReactNode; color?: string }) => <span data-color={color}>{children}</span>,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => appServicesMock,
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({ columns, dataSource, rowSelection }: {
    columns: Array<{
      dataIndex?: string;
      filters?: unknown[];
      render?: (_value: unknown, record: { id: string; progress?: number; status?: string }, index: number) => ReactNode;
    }>;
    dataSource: Array<{ id: string; progress?: number; status?: string }>;
    rowSelection?: {
      onChange: (keys: string[]) => void;
      selectedRowKeys: string[];
    };
  }) => (
    <div data-filter-columns={columns.filter((column) => column.filters).length} data-testid="app-table">
      {rowSelection ? (
        <>
          <output data-testid="selected-task-keys">{rowSelection.selectedRowKeys.join(",")}</output>
          <button onClick={() => rowSelection.onChange(dataSource[0] ? [dataSource[0].id] : [])} type="button">
            select first task
          </button>
        </>
      ) : null}
      {dataSource.map((record, index) => (
        <div key={record.id}>
          {record.status !== undefined
            ? columns
              .filter((column) => column.dataIndex === "id" || column.dataIndex === "status" || column.dataIndex === "progress")
              .map((column) => (
                <div key={column.dataIndex}>
                  {column.render?.(record[column.dataIndex as "id" | "progress" | "status"], record, index)}
                </div>
              ))
            : columns.at(-1)?.render?.(undefined, record, index)}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/framework/ui/common/AppButton", () => ({
  AppButton: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@/framework/ui/common/TablePaginationBar", () => ({
  TablePaginationBar: () => null,
}));

vi.mock("@/framework/ui/common/TableSurface", () => ({
  TableSurface: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/modules/data-connect/components/DataConnectPageHeader", () => ({
  DataConnectPageHeader: ({ extra }: { extra?: ReactNode }) => <>{extra}</>,
}));

vi.mock("@/modules/data-connect/components/DataConnectDiscoverTaskDrawer", () => ({
  DataConnectDiscoverTaskDrawer: ({ taskId }: { taskId: string }) => <output>drawer:{taskId}</output>,
}));

vi.mock("@/modules/data-connect/components/DiscoverRunNowModal", () => ({
  DiscoverRunNowModal: () => null,
}));

vi.mock("@/modules/data-connect/components/DiscoverScheduleFormModal", () => ({
  DiscoverScheduleFormModal: ({ initialValue, onCancel, onSubmit, submitting }: {
    initialValue: { expectedUpdateTime: number } | null;
    onCancel: () => void;
    onSubmit: (payload: {
      catalogId: string;
      cronExpr: string;
      enabled: boolean;
      endTime?: number;
      name: string;
      startTime?: number;
      strategy: "full_sync";
    }) => Promise<void>;
    submitting: boolean;
  }) => initialValue ? (
    <>
      <output data-testid="schedule-submitting">{String(submitting)}</output>
      <button onClick={onCancel} type="button">cancel schedule</button>
      <button
        onClick={() => void onSubmit({
          catalogId: "catalog-1",
          cronExpr: "0 * * * *",
          enabled: true,
          endTime: undefined,
          name: "nightly",
          startTime: undefined,
          strategy: "full_sync",
        })}
        type="button"
      >
        submit schedule {initialValue.expectedUpdateTime}
      </button>
    </>
  ) : null,
}));

vi.mock("@/shared/catalog", () => ({
  getCatalog: getCatalogMock,
  hasCatalogOperation: (
    catalog: { operations?: string[] } | null | undefined,
    operation: string,
  ) => Boolean(catalog?.operations?.includes("*") || catalog?.operations?.includes(operation)),
  listCatalogs: listCatalogsMock,
}));

vi.mock("@/modules/data-connect/services/discover.service", () => ({
  createDataConnectDiscoverSchedule: vi.fn(),
  deleteDataConnectDiscoverSchedule: vi.fn(),
  deleteDataConnectDiscoverTask: vi.fn(),
  getDataConnectDiscoverSchedule: getScheduleMock,
  listDataConnectDiscoverSchedules: listSchedulesMock,
  listDataConnectDiscoverTasks: listTasksMock,
  setDataConnectDiscoverScheduleEnabled: vi.fn(),
  triggerDataConnectDiscover: vi.fn(),
  updateDataConnectDiscoverSchedule: updateScheduleMock,
}));

const schedule = (expectedUpdateTime: number) => ({
  catalogId: "catalog-1",
  createTime: "-",
  creatorName: "-",
  cronExpr: "0 * * * *",
  enabled: true,
  endTime: "-",
  endTimeValue: Date.parse("2026-08-20T11:00:00"),
  expectedUpdateTime,
  id: "schedule-1",
  lastRun: "-",
  name: "nightly",
  nextRun: "-",
  startTime: "-",
  startTimeValue: Date.parse("2026-08-20T10:00:00"),
  strategy: "full_sync" as const,
  updateTime: "-",
  updaterName: "-",
});

const task = (catalogId: string, id: string) => ({
  catalogId,
  createTime: 100,
  id,
  progress: 100,
  queuePriority: 10,
  status: "completed" as const,
  strategy: "full_sync" as const,
  triggerType: "manual" as const,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function openScheduleEditor() {
  await waitFor(() => expect(listSchedulesMock).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "dataConnect.discoverTabSchedules" }));
  fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
  await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(1));
}

describe("DataConnectDiscoverScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScheduleMock.mockReset();
    getCatalogMock.mockResolvedValue({
      id: "catalog-1",
      name: "Orders",
      operations: ["task_manage", "view_detail"],
    });
    updateScheduleMock.mockReset();
    listCatalogsMock.mockResolvedValue({
      items: [{
        id: "catalog-1",
        name: "Orders",
        operations: ["task_manage", "view_detail"],
      }, {
        id: "catalog-2",
        name: "Customers",
        operations: ["task_manage", "view_detail"],
      }],
      total: 2,
    });
    listSchedulesMock.mockResolvedValue({ items: [schedule(100)], total: 1 });
    listTasksMock.mockResolvedValue({ items: [], total: 0 });
    getScheduleMock
      .mockResolvedValueOnce(schedule(100))
      .mockResolvedValue(schedule(200));
    updateScheduleMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
  });

  it("rejects a direct catalog route without task_manage on that catalog", async () => {
    getCatalogMock.mockResolvedValue({
      id: "catalog-1",
      name: "Orders",
      operations: ["view_detail"],
    });

    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    expect(await screen.findByText("common.noPermission")).toBeTruthy();
    expect(listTasksMock).not.toHaveBeenCalled();
    expect(listSchedulesMock).not.toHaveBeenCalled();
    expect(listCatalogsMock).not.toHaveBeenCalled();
  });

  it("authorizes a direct catalog route with an exact catalog lookup", async () => {
    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    await waitFor(() => expect(listTasksMock).toHaveBeenCalled());
    expect(getCatalogMock).toHaveBeenCalledWith("catalog-1", { skipErrorToast: true });
    expect(listCatalogsMock).not.toHaveBeenCalled();
  });

  it("keeps the newest direct catalog authorization when lookups resolve out of order", async () => {
    const firstLookup = deferred<{ id: string; name: string; operations: string[] }>();
    const secondLookup = deferred<{ id: string; name: string; operations: string[] }>();
    getCatalogMock.mockImplementation((id: string) =>
      id === "catalog-1" ? firstLookup.promise : secondLookup.promise,
    );
    const view = render(<DataConnectDiscoverScene catalogId="catalog-1" />);
    await waitFor(() => expect(getCatalogMock).toHaveBeenCalledWith(
      "catalog-1",
      { skipErrorToast: true },
    ));

    view.rerender(<DataConnectDiscoverScene catalogId="catalog-2" />);
    await waitFor(() => expect(getCatalogMock).toHaveBeenCalledWith(
      "catalog-2",
      { skipErrorToast: true },
    ));
    await act(async () => {
      secondLookup.resolve({
        id: "catalog-2",
        name: "Customers",
        operations: ["task_manage", "view_detail"],
      });
      await secondLookup.promise;
    });
    await waitFor(() => expect(listTasksMock).toHaveBeenCalledWith(
      expect.objectContaining({ catalogId: "catalog-2" }),
    ));

    await act(async () => {
      firstLookup.resolve({
        id: "catalog-1",
        name: "Orders",
        operations: ["view_detail"],
      });
      await firstLookup.promise;
    });

    expect(screen.queryByText("common.noPermission")).toBeNull();
  });

  it("loads all catalog pages before filtering task_manage options", async () => {
    listCatalogsMock.mockImplementation(({ page }: { page: number }) => Promise.resolve({
      items: page === 1
        ? Array.from({ length: 50 }, (_, index) => ({
          id: `catalog-denied-${index}`,
          name: `Denied ${index}`,
          operations: ["view_detail"],
        }))
        : [{
          id: "catalog-authorized",
          name: "Authorized",
          operations: ["task_manage", "view_detail"],
        }],
      total: 51,
    }));

    render(<DataConnectDiscoverScene />);

    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledWith({
      keyword: "",
      page: 2,
      pageSize: 50,
      type: "physical",
    }));
    expect(await screen.findByText("Authorized")).toBeTruthy();
    expect(screen.queryByText("Denied 0")).toBeNull();
  });

  it("shows no permission only for a forbidden direct catalog lookup", async () => {
    getCatalogMock.mockRejectedValue(new AxiosError(
      "Forbidden",
      undefined,
      undefined,
      undefined,
      {
        status: 403,
        statusText: "Forbidden",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {},
      },
    ));

    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    expect(await screen.findByText("common.noPermission")).toBeTruthy();
    expect(listTasksMock).not.toHaveBeenCalled();
    expect(listSchedulesMock).not.toHaveBeenCalled();
  });

  it("keeps lookup failures distinct from permission denials", async () => {
    getCatalogMock.mockRejectedValue(new Error("Catalog lookup failed"));

    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    expect(await screen.findByText("Catalog lookup failed")).toBeTruthy();
    expect(screen.queryByText("common.noPermission")).toBeNull();
    expect(screen.getByRole("button", { name: "common.retry" })).toBeTruthy();
    expect(listTasksMock).not.toHaveBeenCalled();
    expect(listSchedulesMock).not.toHaveBeenCalled();
  });

  it("refreshes the discover schedule version after an update conflict", async () => {
    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    await openScheduleEditor();
    fireEvent.click(screen.getByRole("button", { name: "submit schedule 100" }));

    await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "submit schedule 200" })).toBeTruthy();
  });

  it("clears the submitting state before closing a successfully saved schedule", async () => {
    updateScheduleMock.mockResolvedValue(undefined);
    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    await openScheduleEditor();
    fireEvent.click(screen.getByRole("button", { name: "submit schedule 100" }));

    await waitFor(() => expect(updateScheduleMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId("schedule-submitting").textContent).toBe("false");
  });

  it("sends cleared schedule times to the update service", async () => {
    updateScheduleMock.mockResolvedValue(undefined);
    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    await openScheduleEditor();
    fireEvent.click(screen.getByRole("button", { name: "submit schedule 100" }));

    await waitFor(() => {
      expect(updateScheduleMock).toHaveBeenCalledWith("schedule-1", {
        catalogId: "catalog-1",
        cronExpr: "0 * * * *",
        enabled: true,
        endTime: undefined,
        expectedUpdateTime: 100,
        name: "nightly",
        startTime: undefined,
        strategy: "full_sync",
      });
    });
  });

  it("clears the submitting state when a schedule modal closes during submission", async () => {
    let resolveUpdate: (() => void) | undefined;
    updateScheduleMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveUpdate = resolve; }),
    );
    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    await openScheduleEditor();
    fireEvent.click(screen.getByRole("button", { name: "submit schedule 100" }));
    await waitFor(() => expect(screen.getByTestId("schedule-submitting").textContent).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "cancel schedule" }));
    await waitFor(() => expect(screen.queryByTestId("schedule-submitting")).toBeNull());
    resolveUpdate?.();

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("schedule-submitting").textContent).toBe("false"));
  });

  it("renders pending task status and progress with the neutral color", async () => {
    listTasksMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        createTime: 100,
        id: "discover-task-pending",
        progress: 0,
        queuePriority: 10,
        status: "pending",
        strategy: "full_sync",
        triggerType: "manual",
      }],
      total: 1,
    });

    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    const status = await screen.findByText("dataConnect.discoverTaskStatuses.pending");
    expect(status.getAttribute("data-color")).toBe("default");
    expect(document.querySelector(`.${taskStyles.progressFillMuted}`)).not.toBeNull();
  });

  it("keeps task header filters available when no task matches", async () => {
    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    await waitFor(() => expect(listTasksMock).toHaveBeenCalled());
    expect(screen.getByTestId("app-table").getAttribute("data-filter-columns")).not.toBe("0");
  });

  it("clears selected tasks and task details when the catalog changes", async () => {
    listTasksMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        createTime: 100,
        id: "discover-task-1",
        progress: 100,
        queuePriority: 10,
        status: "completed",
        strategy: "full_sync",
        triggerType: "manual",
      }],
      total: 1,
    });

    const view = render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    await screen.findByText("discover-task-1");
    fireEvent.click(screen.getByRole("button", { name: "select first task" }));
    fireEvent.click(screen.getByRole("button", { name: "discover-task-1" }));
    expect(screen.getByTestId("selected-task-keys").textContent).toBe("discover-task-1");
    expect(screen.getByText("drawer:discover-task-1")).toBeTruthy();

    view.rerender(<DataConnectDiscoverScene catalogId="catalog-2" />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-task-keys").textContent).toBe("");
      expect(screen.queryByText("drawer:discover-task-1")).toBeNull();
    });
  });

  it("does not replace the new catalog task list with a stale response", async () => {
    const firstTasks = deferred<{ items: ReturnType<typeof task>[]; total: number }>();
    const secondTasks = deferred<{ items: ReturnType<typeof task>[]; total: number }>();
    listTasksMock.mockImplementation(({ catalogId }: { catalogId?: string }) =>
      catalogId === "catalog-1" ? firstTasks.promise : secondTasks.promise,
    );
    const view = render(<DataConnectDiscoverScene catalogId="catalog-1" />);
    await waitFor(() => expect(listTasksMock).toHaveBeenCalledWith(
      expect.objectContaining({ catalogId: "catalog-1" }),
    ));

    view.rerender(<DataConnectDiscoverScene catalogId="catalog-2" />);
    await waitFor(() => expect(listTasksMock).toHaveBeenCalledWith(
      expect.objectContaining({ catalogId: "catalog-2" }),
    ));
    await act(async () => {
      secondTasks.resolve({ items: [task("catalog-2", "task-new")], total: 1 });
      await secondTasks.promise;
    });
    expect(await screen.findByText("task-new")).toBeTruthy();

    await act(async () => {
      firstTasks.resolve({ items: [task("catalog-1", "task-stale")], total: 1 });
      await firstTasks.promise;
    });

    expect(screen.queryByText("task-stale")).toBeNull();
    expect(screen.getByText("task-new")).toBeTruthy();
  });
});
