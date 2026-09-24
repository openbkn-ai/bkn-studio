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
import { humanizeConnectorFieldLabel } from "@/modules/data-connect/lib/connector-template";

const { getRecordMock, getScheduleMock, messageErrorMock, updateScheduleMock } = vi.hoisted(() => ({
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
  }) =>
    open ? (
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
  builtin: false,
  lastCheckTime: "-",
  metadata: {},
  mode: "standard",
  name: "Orders",
  operations: ["modify", "view_detail"],
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
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getScheduleMock.mockReset();
    updateScheduleMock.mockReset();
    getRecordMock.mockResolvedValue(record);
    getScheduleMock.mockResolvedValueOnce(schedule(100)).mockResolvedValue(schedule(200));
    updateScheduleMock
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } })
      .mockResolvedValue(schedule(300));
  });

  it("hides schedule editing without modify on this catalog", async () => {
    getRecordMock.mockResolvedValue({ ...record, operations: ["view_detail"] });

    render(
      <DataConnectDetailDrawer connectorTypes={[]} onClose={vi.fn()} open recordId="catalog-1" />,
    );

    await screen.findByText("Orders");
    expect(screen.queryByRole("button", { name: "common.edit" })).toBeNull();
  });

  it("refreshes the schedule version after a conflict before retrying", async () => {
    render(
      <DataConnectDetailDrawer connectorTypes={[]} onClose={vi.fn()} open recordId="catalog-1" />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "submit schedule 100" }));

    await screen.findByRole("button", { name: "submit schedule 200" });
    fireEvent.click(screen.getByRole("button", { name: "submit schedule 200" }));

    await waitFor(() => {
      expect(updateScheduleMock).toHaveBeenNthCalledWith(2, "catalog-1", { mode: "disabled" }, 200);
    });
    expect(getScheduleMock).toHaveBeenCalledTimes(2);
  });

  it("does not apply a conflict refresh after switching records", async () => {
    let resolveConflictRefresh: (value: ReturnType<typeof schedule>) => void;
    getScheduleMock
      .mockReset()
      .mockResolvedValueOnce(schedule(100))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveConflictRefresh = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...schedule(300), catalogId: "catalog-2" });
    updateScheduleMock
      .mockReset()
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });

    const { rerender } = render(
      <DataConnectDetailDrawer connectorTypes={[]} onClose={vi.fn()} open recordId="catalog-1" />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "common.edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "submit schedule 100" }));
    await waitFor(() => expect(getScheduleMock).toHaveBeenCalledTimes(2));

    rerender(
      <DataConnectDetailDrawer connectorTypes={[]} onClose={vi.fn()} open recordId="catalog-2" />,
    );
    expect(await screen.findByRole("button", { name: "submit schedule 300" })).toBeTruthy();

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
            available: true,
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
    const maskedPassword = screen.getByText("••••••••");
    expect(maskedPassword.getAttribute("title")).toBe("dataConnect.encryptedFieldEditHint");
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    expect(configSection).not.toBeNull();
    const values = [...configSection!.querySelectorAll('[class*="configItem"]')].map(
      (item) => item.textContent,
    );
    expect(values).toEqual([
      expect.stringContaining("db.example.com"),
      expect.stringContaining("5432"),
      expect.stringContaining("readonly_user"),
      expect.stringContaining("••••••••"),
    ]);
  });

  it("never echoes an encrypted password returned by the detail API", async () => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorConfig: { password: "actual-password" },
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            available: true,
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: {
              password: { encrypted: true, required: true, type: "string" },
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

    expect(await screen.findByText("••••••••")).toBeTruthy();
    expect(screen.queryByText("actual-password")).toBeNull();
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
            available: true,
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

  it("pairs Oracle service name with schemas and places options on the last full row", async () => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorType: "oracle",
      connectorConfig: {
        host: "oracle.example.com",
        port: 1521,
        username: "readonly_user",
        password: "secret",
        service_name: "ORCLPDB1",
        schemas: ["OPENBKN_IT"],
        options: { timeout: 30 },
      },
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            available: true,
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: {
              options: { encrypted: false, required: false, type: "object" },
              schemas: { encrypted: false, required: false, type: "array" },
              service_name: { encrypted: false, required: true, type: "string" },
              password: { encrypted: true, required: true, type: "string" },
              username: { encrypted: false, required: true, type: "string" },
              port: { encrypted: false, required: true, type: "integer" },
              host: { encrypted: false, required: true, type: "string" },
            },
            mode: "local",
            name: "Oracle",
            type: "oracle",
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    await screen.findByText("ORCLPDB1");
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    expect(configSection).not.toBeNull();
    const items = [...configSection!.querySelectorAll('[class*="configItem"]')];
    expect(items.map((item) => item.querySelector('[class*="configLabel"]')?.textContent)).toEqual([
      "主机地址",
      "端口号",
      "用户名",
      "密码",
      "服务名",
      "Schema 列表",
      "连接参数",
    ]);
    expect(items[6]?.className).toContain("configItemFull");
    expect(items.slice(0, 6).every((item) => !item.className.includes("configItemFull"))).toBe(
      true,
    );
    expect(items[5]?.querySelectorAll(".ant-tag")).toHaveLength(1);
    expect(items[6]?.querySelectorAll(".ant-tag")).toHaveLength(1);
    expect(items[5]?.textContent).toContain("OPENBKN_IT");
    expect(items[6]?.textContent).toContain("timeout: 30");
  });

  it.each([
    ["mariadb", ["host", "port", "username", "password", "databases", "options"]],
    ["mysql", ["host", "port", "username", "password", "databases", "options"]],
    ["postgresql", ["host", "port", "username", "password", "database", "schemas", "options"]],
    ["sqlserver", ["host", "port", "username", "password", "database", "schemas", "options"]],
    ["opensearch", ["host", "port", "username", "password", "index_pattern"]],
    [
      "anyshare",
      [
        "protocol",
        "host",
        "port",
        "auth_type",
        "token",
        "app_id",
        "app_secret",
        "doc_lib_type",
        "paths",
      ],
    ],
  ])("orders %s detail fields by connector type", async (connectorType, fieldNames) => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorType,
      connectorConfig: Object.fromEntries(fieldNames.map((name) => [name, name])),
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            available: true,
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: Object.fromEntries(
              [...fieldNames]
                .reverse()
                .map((name) => [name, { encrypted: false, required: false, type: "string" }]),
            ),
            mode: "local",
            name: connectorType,
            type: connectorType,
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    const configSection = await screen.findByText("dataConnect.connectorConfig");
    await waitFor(() => {
      expect(
        configSection.closest("section")?.querySelectorAll('[class*="configItem"]'),
      ).toHaveLength(fieldNames.length);
    });
    const items = [...configSection.closest("section")!.querySelectorAll('[class*="configItem"]')];
    expect(items.map((item) => item.querySelector('[class*="configLabel"]')?.textContent)).toEqual(
      fieldNames.map((name) => humanizeConnectorFieldLabel(name, connectorType)),
    );
    if (fieldNames.includes("options")) {
      expect(items.at(-1)?.className).toContain("configItemFull");
    }
  });

  it("places options last and across both columns for an unknown connector type", async () => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorType: "custom",
      connectorConfig: {
        options: { timeout: 30 },
        host: "custom.example.com",
        custom_setting: "on",
      },
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            available: true,
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: {
              options: { encrypted: false, required: false, type: "object" },
              host: { encrypted: false, required: true, type: "string" },
              custom_setting: { encrypted: false, required: false, type: "string" },
            },
            mode: "local",
            name: "Custom",
            type: "custom",
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    await screen.findByText("timeout: 30");
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    const items = [...configSection!.querySelectorAll('[class*="configItem"]')];
    expect(items.at(-1)?.querySelector('[class*="configLabel"]')?.textContent).toBe("连接参数");
    expect(items.at(-1)?.className).toContain("configItemFull");
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
            available: true,
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

  it.each([
    ["postgresql", "schemas"],
    ["sqlserver", "schemas"],
    ["oracle", "schemas"],
    ["anyshare", "paths"],
  ])("renders %s %s lists as tags", async (connectorType, fieldName) => {
    getRecordMock.mockResolvedValue({
      ...record,
      connectorType,
      connectorConfig: { [fieldName]: ["first", "second"] },
    });

    render(
      <DataConnectDetailDrawer
        connectorTypes={[
          {
            available: true,
            category: "table",
            description: "",
            enabled: true,
            fieldConfig: { [fieldName]: { encrypted: false, required: false, type: "array" } },
            mode: "local",
            name: connectorType,
            type: connectorType,
          },
        ]}
        onClose={vi.fn()}
        open
        recordId="catalog-1"
      />,
    );

    await screen.findByText("first");
    const configSection = screen.getByText("dataConnect.connectorConfig").closest("section");
    expect(configSection?.querySelectorAll(".ant-tag")).toHaveLength(2);
    expect(screen.getByText("second")).toBeTruthy();
  });

  it.each(["postgresql", "sqlserver", "oracle"])(
    "truncates long %s schema tags while preserving the full name",
    async (connectorType) => {
      const schemaName = "SCHEMA_WITH_A_NAME_THAT_IS_TOO_LONG_FOR_THE_DETAIL_CARD";
      getRecordMock.mockResolvedValue({
        ...record,
        connectorType,
        connectorConfig: { schemas: [schemaName] },
      });

      render(
        <DataConnectDetailDrawer
          connectorTypes={[
            {
              available: true,
              category: "table",
              description: "",
              enabled: true,
              fieldConfig: {
                schemas: { encrypted: false, required: false, type: "array" },
              },
              mode: "local",
              name: connectorType,
              type: connectorType,
            },
          ]}
          onClose={vi.fn()}
          open
          recordId="catalog-1"
        />,
      );

      const schemaTag = await screen.findByText(schemaName);
      expect(schemaTag.className).toContain("configSchemaTag");
      expect(schemaTag.getAttribute("title")).toBe(schemaName);
    },
  );

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
            available: true,
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
