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
  DiscoverScheduleFormModal: ({ initialValue, onSubmit, submitting }: {
    initialValue: { expectedUpdateTime: number } | null;
    onSubmit: (payload: {
      catalogId: string;
      cronExpr: string;
      enabled: boolean;
      name: string;
      strategy: "full_sync";
    }) => Promise<void>;
    submitting: boolean;
  }) => initialValue ? (
    <>
      <output data-testid="schedule-submitting">{String(submitting)}</output>
      <button
        onClick={() => void onSubmit({
          catalogId: "catalog-1",
          cronExpr: "0 * * * *",
          enabled: true,
          name: "nightly",
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
  expectedUpdateTime,
  id: "schedule-1",
  lastRun: "-",
  name: "nightly",
  nextRun: "-",
  startTime: "-",
  strategy: "full_sync" as const,
  updateTime: "-",
  updaterName: "-",
});

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

    fireEvent.click(await screen.findByText("dataConnect.discoverTabSchedules"));
    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "submit schedule 100" }));

    expect(
      await screen.findByRole("button", { name: "submit schedule 200" }),
    ).toBeTruthy();
    await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(2));
  });

  it("clears the submitting state before closing a successfully saved schedule", async () => {
    updateScheduleMock.mockResolvedValue(undefined);
    render(<DataConnectDiscoverScene catalogId="catalog-1" />);

    fireEvent.click(await screen.findByText("dataConnect.discoverTabSchedules"));
    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "submit schedule 100" }));

    await waitFor(() => expect(updateScheduleMock).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));

    expect((await screen.findByTestId("schedule-submitting")).textContent).toBe("false");
  });
});
