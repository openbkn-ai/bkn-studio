/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";

const testCatalogConnectionMock = vi.hoisted(() => vi.fn());
const testCatalogConnectionConfigMock = vi.hoisted(() => vi.fn());
const listCatalogsMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

vi.mock("@/shared/catalog", () => ({
  listCatalogs: listCatalogsMock,
  testCatalogConnection: testCatalogConnectionMock,
  testCatalogConnectionConfig: testCatalogConnectionConfigMock,
}));

describe("data-connect.service · test connection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    testCatalogConnectionMock.mockReset();
    testCatalogConnectionConfigMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists connector types regardless of runtime availability and enabled state", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            available: false,
            category: "table",
            description: "",
            enabled: true,
            mode: "local",
            name: "SQL Server",
            required_edition: "professional",
            type: "sqlserver",
          },
        ],
        total_count: 1,
      },
    });
    const { listDataConnectConnectorTypes } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(listDataConnectConnectorTypes()).resolves.toMatchObject([
      {
        available: false,
        requiredEdition: "professional",
        type: "sqlserver",
      },
    ]);

    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/connector-types", {
      params: {
        direction: "asc",
        limit: 100,
        offset: 0,
        sort: "name",
      },
    });
  });

  it("loads every connector-type page instead of silently dropping types after the first 100", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      category: "table",
      description: "",
      enabled: true,
      mode: "local",
      name: `Connector ${index}`,
      type: `connector-${index}`,
    }));
    getMock
      .mockResolvedValueOnce({ data: { entries: firstPage, total_count: 101 } })
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              category: "table",
              description: "",
              enabled: true,
              mode: "local",
              name: "Connector 100",
              type: "connector-100",
            },
          ],
          total_count: 101,
        },
      });
    const { listDataConnectConnectorTypes } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(listDataConnectConnectorTypes()).resolves.toHaveLength(101);
    expect(getMock).toHaveBeenNthCalledWith(2, "/vega-backend/v1/connector-types", {
      params: {
        direction: "asc",
        limit: 100,
        offset: 100,
        sort: "name",
      },
    });
  });

  it("passes data-connection pagination and filters through to Vega", async () => {
    listCatalogsMock.mockResolvedValue({ items: [], total: 23 });
    const { listDataConnectRecords } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(
      listDataConnectRecords({
        connectorType: "postgresql",
        keyword: "orders",
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toEqual({ items: [], total: 23 });

    expect(listCatalogsMock).toHaveBeenCalledWith({
      connectorType: "postgresql",
      keyword: "orders",
      page: 2,
      pageSize: 10,
      type: "physical",
    });
  });

  it("passes the caller's error-toast preference to the catalog list", async () => {
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    const { listDataConnectRecords } =
      await import("@/modules/data-connect/services/data-connect.service");

    await listDataConnectRecords({ keyword: "", page: 1, pageSize: 10 }, { skipErrorToast: true });

    expect(listCatalogsMock).toHaveBeenCalledWith(expect.objectContaining({ type: "physical" }), {
      skipErrorToast: true,
    });
  });

  it("passes status and health filters through to the catalog list", async () => {
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    const { listDataConnectRecords } =
      await import("@/modules/data-connect/services/data-connect.service");

    await listDataConnectRecords({
      enabled: false,
      healthStatus: "offline",
      keyword: "",
      page: 1,
      pageSize: 10,
    });

    expect(listCatalogsMock).toHaveBeenCalledWith({
      enabled: false,
      healthStatus: "offline",
      keyword: "",
      page: 1,
      pageSize: 10,
      type: "physical",
    });
  });

  it("keeps only field runtime semantics and ignores backend display text", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            category: "table",
            description: "后端展示描述",
            enabled: true,
            field_config: {
              host: {
                description: "后端主机说明",
                encrypted: false,
                name: "后端主机名称",
                required: true,
                type: "string",
              },
            },
            mode: "local",
            name: "后端连接器名称",
            type: "postgresql",
          },
        ],
        total_count: 1,
      },
    });
    const { listDataConnectConnectorTypes } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(listDataConnectConnectorTypes()).resolves.toEqual([
      {
        category: "table",
        description: "后端展示描述",
        enabled: true,
        fieldConfig: {
          host: {
            encrypted: false,
            required: true,
            type: "string",
          },
        },
        mode: "local",
        name: "后端连接器名称",
        type: "postgresql",
      },
    ]);
  });

  it("loads field semantics from the selected connector type detail", async () => {
    getMock.mockResolvedValue({
      data: {
        category: "table",
        description: "后端展示描述",
        enabled: true,
        field_config: {
          host: { encrypted: false, required: true, type: "string" },
        },
        mode: "local",
        name: "后端连接器名称",
        type: "postgresql",
      },
    });
    const { getDataConnectConnectorType } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(getDataConnectConnectorType("postgresql")).resolves.toMatchObject({
      fieldConfig: { host: { encrypted: false, required: true, type: "string" } },
      type: "postgresql",
    });
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/connector-types/postgresql");
  });

  it("covers every built-in connector field from the Vega initialization data", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_EDITION", "community");
    const { listDataConnectConnectorTypes } =
      await import("@/modules/data-connect/services/data-connect.service");

    const connectorTypes = await listDataConnectConnectorTypes();
    const fieldsByType = new Map(
      connectorTypes.map((connector) => [connector.type, connector.fieldConfig]),
    );

    expect(Object.keys(fieldsByType.get("mariadb") ?? {})).toEqual([
      "host",
      "port",
      "username",
      "password",
      "databases",
      "options",
    ]);
    expect(Object.keys(fieldsByType.get("mysql") ?? {})).toEqual([
      "host",
      "port",
      "username",
      "password",
      "databases",
      "options",
    ]);
    expect(Object.keys(fieldsByType.get("postgresql") ?? {})).toEqual([
      "host",
      "port",
      "username",
      "password",
      "database",
      "schemas",
      "options",
    ]);
    expect(Object.keys(fieldsByType.get("sqlserver") ?? {})).toEqual([
      "host",
      "port",
      "username",
      "password",
      "database",
      "schemas",
      "options",
    ]);
    expect(Object.keys(fieldsByType.get("oracle") ?? {})).toEqual([
      "host",
      "port",
      "username",
      "password",
      "service_name",
      "schemas",
      "options",
    ]);
    expect(fieldsByType.get("oracle")?.password).toMatchObject({
      encrypted: true,
      required: true,
      type: "string",
    });
    expect(Object.keys(fieldsByType.get("opensearch") ?? {})).toEqual([
      "host",
      "port",
      "username",
      "password",
      "index_pattern",
    ]);
    expect(Object.keys(fieldsByType.get("anyshare") ?? {})).toEqual([
      "protocol",
      "host",
      "port",
      "auth_type",
      "token",
      "app_id",
      "app_secret",
      "doc_lib_type",
      "paths",
    ]);
    expect(fieldsByType.get("anyshare")?.app_secret).toMatchObject({
      encrypted: true,
      required: false,
      type: "string",
    });

    const editionsByType = new Map(
      connectorTypes.map((connector) => [connector.type, connector.requiredEdition]),
    );
    expect(editionsByType.get("sqlserver")).toBe("professional");
    expect(editionsByType.get("oracle")).toBe("professional");
    expect(editionsByType.get("mysql")).toBeUndefined();

    const stateByType = new Map(connectorTypes.map((connector) => [connector.type, connector]));
    expect(stateByType.get("opensearch")).toMatchObject({ available: false, enabled: true });
    expect(stateByType.get("oracle")).toMatchObject({ available: false, enabled: true });
    expect(stateByType.get("mysql")).toMatchObject({ available: true, enabled: false });
  });

  it("makes the mock Oracle connector available only at professional edition or above", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_EDITION", "professional");
    const { listDataConnectConnectorTypes } =
      await import("@/modules/data-connect/services/data-connect.service");

    const connectorTypes = await listDataConnectConnectorTypes();
    expect(connectorTypes.find((connector) => connector.type === "oracle")).toMatchObject({
      available: true,
      enabled: true,
      requiredEdition: "professional",
    });
  });

  it("recognizes only the backend connection-test failure code", async () => {
    const { isDataConnectConnectionTestFailure } =
      await import("@/modules/data-connect/services/data-connect.service");

    expect(
      isDataConnectConnectionTestFailure(
        new axios.AxiosError("Request failed", undefined, undefined, undefined, {
          config: { headers: new axios.AxiosHeaders() },
          data: {
            description: "Connection test failed.",
            error_code: "VegaBackend.Catalog.InternalError.TestConnectionFailed",
          },
          headers: {},
          status: 400,
          statusText: "Bad Request",
        }),
      ),
    ).toBe(true);
    expect(
      isDataConnectConnectionTestFailure(
        new axios.AxiosError("Request failed", undefined, undefined, undefined, {
          config: { headers: new axios.AxiosHeaders() },
          data: {
            description: "Invalid parameter.",
            error_code: "VegaBackend.Catalog.InvalidParameter",
          },
          headers: {},
          status: 400,
          statusText: "Bad Request",
        }),
      ),
    ).toBe(false);
  });

  it("rejects an existing catalog business failure with the backend message", async () => {
    testCatalogConnectionMock.mockResolvedValue({
      message: "Connection refused.",
      success: false,
    });
    const { testDataConnectRecord } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(testDataConnectRecord("catalog-1")).rejects.toThrow("Connection refused.");
  });

  it("rejects a preflight business failure with the backend details", async () => {
    testCatalogConnectionConfigMock.mockResolvedValue({
      message: "dial tcp db.example.com:3306: i/o timeout",
      success: false,
    });
    const { testDataConnectConfig } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(
      testDataConnectConfig({
        connectorConfig: { host: "db.example.com" },
        connectorType: "mariadb",
      }),
    ).rejects.toThrow("dial tcp db.example.com:3306: i/o timeout");
  });

  it("uses the localized fallback when the backend failure message is empty", async () => {
    testCatalogConnectionConfigMock.mockResolvedValue({
      message: "  ",
      success: false,
    });
    const { testDataConnectConfig } =
      await import("@/modules/data-connect/services/data-connect.service");

    await expect(
      testDataConnectConfig({
        connectorConfig: { host: "db.example.com" },
        connectorType: "postgresql",
      }),
    ).rejects.toThrow(i18n.t("dataConnect.testConnectionFailed"));
  });

  it("resolves a successful preflight without creating or updating a catalog", async () => {
    testCatalogConnectionConfigMock.mockResolvedValue({
      message: "Connection test succeeded.",
      success: true,
    });
    const { testDataConnectConfig } =
      await import("@/modules/data-connect/services/data-connect.service");
    const input = {
      connectorConfig: { host: "db.example.com" },
      connectorType: "postgresql",
    };

    await expect(testDataConnectConfig(input)).resolves.toBeUndefined();
    expect(testCatalogConnectionConfigMock).toHaveBeenCalledWith(input);
    expect(testCatalogConnectionMock).not.toHaveBeenCalled();
  });
});
