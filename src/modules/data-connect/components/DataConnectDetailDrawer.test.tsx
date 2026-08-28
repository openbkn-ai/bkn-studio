/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DataConnectDetailDrawer } from "@/modules/data-connect/components/DataConnectDetailDrawer";

const {
  getRecordMock,
  getScheduleMock,
  messageErrorMock,
  updateScheduleMock,
} = vi.hoisted(() => ({
  getRecordMock: vi.fn(),
  getScheduleMock: vi.fn(),
  messageErrorMock: vi.fn(),
  updateScheduleMock: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({
      i18n: { language: "en-US" },
      t: (key: string) => key,
    }),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: messageErrorMock, success: vi.fn() },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/modules/data-connect/services/data-connect.service", () => ({
  getDataConnectHealthCheckSchedule: getScheduleMock,
  getDataConnectRecord: getRecordMock,
  updateDataConnectHealthCheckSchedule: updateScheduleMock,
}));

vi.mock("@/modules/data-connect/components/HealthCheckScheduleFormModal", () => ({
  HealthCheckScheduleFormModal: ({
    onSubmit,
    open,
    schedule,
  }: {
    onSubmit: (input: { mode: "disabled" }) => Promise<void>;
    open: boolean;
    schedule: { expectedUpdateTime: number };
  }) => open ? (
    <button onClick={() => void onSubmit({ mode: "disabled" })} type="button">
      submit schedule {schedule.expectedUpdateTime}
    </button>
  ) : null,
}));

const record = {
  category: "database",
  connectorConfig: {},
  connectorType: "postgresql",
  createTime: "2026-08-19 10:00:00",
  creatorName: "Admin",
  description: "",
  enabled: true,
  expectedUpdateTime: 100,
  healthCheckResult: "",
  healthStatus: "healthy",
  id: "catalog-1",
  internal: false,
  lastCheckTime: "-",
  metadata: {},
  mode: "standard",
  name: "Orders",
  operations: [],
  status: "enabled",
  tags: [],
  type: "physical",
  updateTime: "2026-08-19 10:00:00",
  updaterName: "Admin",
};

const schedule = (expectedUpdateTime: number) => ({
  catalogId: "catalog-1",
  cronExpr: "0 * * * *",
  expectedUpdateTime,
  lastRun: "-",
  mode: "enabled",
  nextRun: "2026-08-19 11:00:00",
  updateTime: "2026-08-19 10:00:00",
});

describe("DataConnectDetailDrawer", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(), addListener: vi.fn(), dispatchEvent: vi.fn(),
      matches: false, media: query, onchange: null,
      removeEventListener: vi.fn(), removeListener: vi.fn(),
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getRecordMock.mockResolvedValue(record);
    getScheduleMock
      .mockResolvedValueOnce(schedule(100))
      .mockResolvedValue(schedule(200));
    updateScheduleMock
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } })
      .mockResolvedValue(schedule(300));
  });

  it("refreshes the schedule version after a conflict before retrying", async () => {
    render(
      <DataConnectDetailDrawer
        connectorTypes={[]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "submit schedule 100" }));

    await screen.findByRole("button", { name: "submit schedule 200" });
    fireEvent.click(screen.getByRole("button", { name: "submit schedule 200" }));

    await waitFor(() => {
      expect(updateScheduleMock).toHaveBeenNthCalledWith(
        2,
        "catalog-1",
        { mode: "disabled" },
        200,
      );
    });
    expect(getScheduleMock).toHaveBeenCalledTimes(2);
  });

  it("does not apply a conflict refresh after switching records", async () => {
    let resolveConflictRefresh: (value: ReturnType<typeof schedule>) => void;
    getScheduleMock
      .mockReset()
      .mockResolvedValueOnce(schedule(100))
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveConflictRefresh = resolve;
        }),
      )
      .mockResolvedValueOnce({ ...schedule(300), catalogId: "catalog-2" });
    updateScheduleMock
      .mockReset()
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });

    const { rerender } = render(
      <DataConnectDetailDrawer
        connectorTypes={[]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "submit schedule 100" }));
    await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(2));

    rerender(
      <DataConnectDetailDrawer
        connectorTypes={[]}
        onClose={vi.fn()}
        open
        recordId="catalog-2"
      />,
    );
    expect(
      await screen.findByRole("button", { name: "submit schedule 300" }),
    ).toBeTruthy();

    act(() => {
      resolveConflictRefresh(schedule(200));
    });
    await Promise.resolve();

    expect(screen.queryByRole("button", { name: "submit schedule 200" })).toBeNull();
    expect(screen.getByRole("button", { name: "submit schedule 300" })).toBeTruthy();
  });

  it("shows fields from the connector template when the detail response omits them", async () => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorConfig: {
        host: "db.example.com",
        port: 5432,
        username: "readonly_user",
      },
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: {
              host: { encrypted: false, required: true, type: "string" },
              password: { encrypted: true, required: true, type: "string" },
              port: { encrypted: false, required: true, type: "number" },
              username: { encrypted: false, required: true, type: "string" },
            },
            mode: "local",
            name: "PostgreSQL",
            type: "postgresql",
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    expect(await screen.findByText("db.example.com")).toBeTruthy();
    expect(screen.getByText("dataConnect.sensitiveValueHidden")).toBeTruthy();
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    expect(configSection).not.toBeNull();
    const values = [...configSection!.querySelectorAll('[class*="configItem"]')]
      .map((item) => item.textContent);
    expect(values).toEqual([
      expect.stringContaining("db.example.com"),
      expect.stringContaining("5432"),
      expect.stringContaining("readonly_user"),
      expect.stringContaining("dataConnect.sensitiveValueHidden"),
    ]);
  });

  it("uses the connector template as the configuration schema", async () => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorConfig: { database: "legacy_database" },
      connectorType: "mysql",
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: {
              databases: { encrypted: false, required: false, type: "array" },
            },
            mode: "local",
            name: "MySQL",
            type: "mysql",
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    await screen.findByText("dataConnect.connectorConfig");
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    expect(configSection).not.toBeNull();
    expect(configSection!.querySelectorAll('[class*="configItem"]')).toHaveLength(1);
    expect(configSection!.textContent).not.toContain("legacy_database");
  });

  it("renders database lists as tags", async () => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorConfig: { databases: ["sales", "reporting"] },
      connectorType: "mysql",
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: {
              databases: { encrypted: false, required: false, type: "array" },
            },
            mode: "local",
            name: "MySQL",
            type: "mysql",
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    await screen.findByText("sales");
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    expect(configSection).not.toBeNull();
    expect(configSection!.querySelectorAll(".ant-tag")).toHaveLength(2);
    expect(screen.getByText("reporting")).toBeTruthy();
  });

  it("renders object configuration values as key-value tags", async () => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorConfig: { options: { connect_timeout: 10, sslmode: "require" } },
      connectorType: "postgresql",
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: {
              options: { encrypted: false, required: false, type: "object" },
            },
            mode: "local",
            name: "PostgreSQL",
            type: "postgresql",
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    expect(await screen.findByText("sslmode: require")).toBeTruthy();
    expect(screen.getByText("connect_timeout: 10")).toBeTruthy();
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    expect(configSection).not.toBeNull();
    expect(configSection!.querySelectorAll(".ant-tag")).toHaveLength(2);
  });
});
