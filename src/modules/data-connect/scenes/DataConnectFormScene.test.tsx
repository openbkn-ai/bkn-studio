/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DataConnectFormScene } from "@/modules/data-connect/scenes/DataConnectFormScene";

const permissionState = vi.hoisted(() => ({
  values: new Set<string>(),
}));
const getDataConnectRecordMock = vi.hoisted(() => vi.fn());
const listDataConnectConnectorTypesMock = vi.hoisted(() => vi.fn());
const testDataConnectConfigMock = vi.hoisted(() => vi.fn());
const messageSuccessMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: vi.fn(),
      success: messageSuccessMock,
      warning: vi.fn(),
    },
    modal: {
      confirm: vi.fn(),
    },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({
    children,
    fallback = null,
    permissions,
  }: {
    children: ReactNode;
    fallback?: ReactNode;
    permissions: string | string[];
  }) => {
    const required = Array.isArray(permissions) ? permissions : [permissions];
    return required.every((permission) => permissionState.values.has(permission))
      ? children
      : fallback;
  },
}));

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/modules/data-connect/services/data-connect.service", () => ({
  createDataConnectRecord: vi.fn(),
  getDataConnectRecord: getDataConnectRecordMock,
  isDataConnectConnectionTestFailure: vi.fn(() => false),
  listDataConnectConnectorTypes: listDataConnectConnectorTypesMock,
  testDataConnectConfig: testDataConnectConfigMock,
  updateDataConnectRecord: vi.fn(),
}));

describe("DataConnectFormScene · connection preflight", () => {
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
    permissionState.values = new Set(["catalog:modify"]);
    messageSuccessMock.mockReset();
    testDataConnectConfigMock.mockReset();
    testDataConnectConfigMock.mockResolvedValue(undefined);
    listDataConnectConnectorTypesMock.mockResolvedValue([
      {
        category: "table",
        description: "",
        enabled: true,
        fieldConfig: {
          host: {
            description: "",
            encrypted: false,
            name: "Host",
            required: true,
            type: "string",
          },
        },
        mode: "local",
        name: "PostgreSQL",
        type: "postgresql",
      },
    ]);
    getDataConnectRecordMock.mockResolvedValue({
      category: "table",
      connectorConfig: { host: "db.example.com" },
      connectorType: "postgresql",
      createTime: "-",
      creatorName: "-",
      description: "",
      enabled: true,
      healthCheckResult: "",
      healthStatus: "healthy",
      id: "catalog-1",
      lastCheckTime: "-",
      metadata: {},
      mode: "local",
      name: "orders",
      operations: [],
      status: "enabled",
      tags: [],
      type: "physical",
      updateTime: "-",
      updaterName: "-",
    });
  });

  it("hides the preflight action without catalog create permission", async () => {
    render(<DataConnectFormScene mode="edit" recordId="catalog-1" />);

    await screen.findByDisplayValue("orders");

    expect(
      screen.queryByRole("button", { name: "common.testConnection" }),
    ).toBeNull();
  });

  it("tests connector fields even when an unrelated catalog field is invalid", async () => {
    permissionState.values.add("catalog:create");
    render(<DataConnectFormScene mode="edit" recordId="catalog-1" />);

    const nameInput = await screen.findByDisplayValue("orders");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(testDataConnectConfigMock).toHaveBeenCalledWith({
        connectorConfig: { host: "db.example.com" },
        connectorType: "postgresql",
      });
    });
    expect(messageSuccessMock).toHaveBeenCalledWith(
      "dataConnect.testConnectionSuccess",
    );
  });
});
