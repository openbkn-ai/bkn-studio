/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataConnectDiscoverScene } from "./DataConnectDiscoverScene";

const {
  appServicesMock,
  getScheduleMock,
  listSchedulesMock,
  updateScheduleMock,
} = vi.hoisted(() => ({
  appServicesMock: {
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  },
  getScheduleMock: vi.fn(),
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
  Alert: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Input: ({ onChange, value }: { onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void; value?: string }) => (
    <input onChange={onChange} value={value} />
  ),
  Select: () => null,
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
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => appServicesMock,
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({ columns, dataSource }: {
    columns: Array<{
      render?: (_value: unknown, record: { id: string }, index: number) => ReactNode;
    }>;
    dataSource: Array<{ id: string }>;
  }) => (
    <div>
      {dataSource.map((record, index) => (
        <div key={record.id}>
          {columns.at(-1)?.render?.(undefined, record, index)}
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
  DataConnectPageHeader: () => null,
}));

vi.mock("@/modules/data-connect/components/DataConnectDiscoverTaskDrawer", () => ({
  DataConnectDiscoverTaskDrawer: () => null,
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
  listCatalogs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock("@/modules/data-connect/services/discover.service", () => ({
  createDataConnectDiscoverSchedule: vi.fn(),
  deleteDataConnectDiscoverSchedule: vi.fn(),
  deleteDataConnectDiscoverTask: vi.fn(),
  getDataConnectDiscoverSchedule: getScheduleMock,
  listDataConnectDiscoverSchedules: listSchedulesMock,
  listDataConnectDiscoverTasks: vi.fn().mockResolvedValue({ items: [], total: 0 }),
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

async function openScheduleEditor() {
  await waitFor(() => expect(listSchedulesMock).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "dataConnect.discoverTabSchedules" }));
  fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
  await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(1));
}

describe("DataConnectDiscoverScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSchedulesMock.mockResolvedValue({ items: [schedule(100)], total: 1 });
    getScheduleMock
      .mockResolvedValueOnce(schedule(100))
      .mockResolvedValue(schedule(200));
    updateScheduleMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
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
});
