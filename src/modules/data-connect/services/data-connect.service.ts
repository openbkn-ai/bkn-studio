/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import i18n from "@/app/locales/i18n";
import { extractRequestErrorDetails } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import {
  catalogListAllQuery,
  createLogicalCatalog,
  createPhysicalCatalog,
  deleteCatalog,
  getCatalogHealthCheckSchedule,
  getCatalog,
  inferConnectorCategory,
  listCatalogs,
  setCatalogEnabled,
  testCatalogConnection,
  testCatalogConnectionConfig,
  updateCatalog,
  updateCatalogHealthCheckSchedule,
} from "@/shared/catalog";
import { filterCatalogs } from "@/shared/catalog/catalog-mapper";
import type {
  CatalogConnectionTestInput,
  CatalogConnectionTestResult,
  CatalogHealthCheckScheduleInput,
  CatalogMutationOptions,
} from "@/shared/catalog";
import type {
  DataConnectConnectorType,
  DataConnectListQuery,
  DataConnectListResult,
  DataConnectMutationPayload,
  DataConnectRecord,
  DataConnectUpdatePayload,
} from "@/modules/data-connect/types/data-connect";

type BackendConnectorFieldConfig = {
  description?: string;
  encrypted?: boolean;
  name?: string;
  required?: boolean;
  type?: string;
};

type BackendConnectorType = {
  category: string;
  description: string;
  enabled: boolean;
  field_config?: Record<string, BackendConnectorFieldConfig>;
  mode: string;
  name: string;
  type: string;
};

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const mockConnectorTypes: BackendConnectorType[] = [
  {
    type: "mariadb",
    name: "MariaDB",
    category: "table",
    mode: "local",
    description: "Connect MariaDB / MySQL-compatible databases.",
    enabled: true,
    field_config: {
      host: mockField("Host", "Database host address", "string", true),
      port: mockField("Port", "Database port", "integer", true),
      username: mockField("Username", "Login username", "string", true),
      password: mockField("Password", "Login password", "string", true, true),
      databases: mockField("Database list", "Optional database names", "array", false),
      options: mockField("Connection options", "Driver connection options", "object", false),
    },
  },
  {
    type: "mysql",
    name: "MySQL",
    category: "table",
    mode: "local",
    description: "Connect MySQL-compatible databases.",
    enabled: true,
    field_config: {
      host: mockField("Host", "Database host address", "string", true),
      port: mockField("Port", "Database port", "integer", true),
      username: mockField("Username", "Login username", "string", true),
      password: mockField("Password", "Login password", "string", true, true),
      databases: mockField("Database list", "Optional database names", "array", false),
      options: mockField("Connection options", "Driver connection options", "object", false),
    },
  },
  {
    type: "postgresql",
    name: "PostgreSQL",
    category: "table",
    mode: "local",
    description: "Connect PostgreSQL databases.",
    enabled: true,
    field_config: {
      host: mockField("Host", "Database host address", "string", true),
      port: mockField("Port", "Database port", "integer", true),
      username: mockField("Username", "Database username", "string", true),
      password: mockField("Password", "Database password", "string", true, true),
      database: mockField("Database", "Database name", "string", true),
      schemas: mockField("Schema list", "Optional schema names", "array", false),
      options: mockField("Connection options", "Driver connection options", "object", false),
    },
  },
  {
    type: "sqlserver",
    name: "SQL Server",
    category: "table",
    mode: "local",
    description: "Connect Microsoft SQL Server databases.",
    enabled: true,
    field_config: {
      host: mockField("Host", "SQL Server server host address", "string", true),
      port: mockField("Port", "SQL Server TCP port", "integer", true),
      username: mockField("Username", "SQL Server login username", "string", true),
      password: mockField("Password", "SQL Server login password", "string", true, true),
      database: mockField("Database", "SQL Server target database", "string", true),
      schemas: mockField("Schema list", "Optional. Leave empty to scan all accessible non-system schemas.", "array", false),
      options: mockField("Connection options", "Connection options such as encrypt, trustservercertificate, and connection timeout.", "object", false),
    },
  },
  {
    type: "opensearch",
    name: "OpenSearch",
    category: "index",
    mode: "local",
    description: "Connect OpenSearch engines.",
    enabled: true,
    field_config: {
      host: mockField("Host", "OpenSearch server host address", "string", true),
      port: mockField("Port", "OpenSearch server port", "integer", true),
      username: mockField("Username", "Service account", "string", false),
      password: mockField("Password", "Service password", "string", false, true),
      index_pattern: mockField("Index pattern", "Optional index matching pattern", "string", false),
    },
  },
  {
    type: "anyshare",
    name: "AnyShare",
    category: "fileset",
    mode: "local",
    description: "Connect fileset and document resources.",
    enabled: true,
    field_config: {
      protocol: mockField("Protocol", "http or https", "string", true),
      host: mockField("Host", "AnyShare service host", "string", true),
      port: mockField("Port", "AnyShare service port", "integer", true),
      auth_type: mockField("Authentication type", "Token or application credentials", "integer", true),
      token: mockField("Access token", "Required for token authentication", "string", false, true),
      app_id: mockField("Application ID", "Required for application authentication", "string", false),
      app_secret: mockField("Application secret", "Required for application authentication", "string", false, true),
      doc_lib_type: mockField("Document library type", "Knowledge or document library", "integer", true),
      paths: mockField("Path list", "Optional document library paths", "array", false),
    },
  },
];

function mockField(
  name: string,
  description: string,
  type: string,
  required: boolean,
  encrypted = false,
): BackendConnectorFieldConfig {
  return { description, encrypted, name, required, type };
}

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 180);
  });

function mapConnectorType(item: BackendConnectorType): DataConnectConnectorType {
  return {
    type: item.type,
    name: item.name,
    category: item.category,
    mode: item.mode,
    description: item.description,
    enabled: item.enabled,
    fieldConfig: Object.fromEntries(
      Object.entries(item.field_config ?? {}).map(([key, value]) => [
        key,
        {
          type: value.type ?? "string",
          required: Boolean(value.required),
          encrypted: Boolean(value.encrypted),
        },
      ]),
    ),
  };
}

export async function listDataConnectConnectorTypes() {
  if (useMock) {
    return wait(mockConnectorTypes.map(mapConnectorType));
  }

  const response = await http.get<ListResponse<BackendConnectorType>>(
    "/vega-backend/v1/connector-types",
    {
      params: {
        available: true,
        direction: "asc",
        enabled: true,
        limit: 100,
        offset: 0,
        sort: "name",
      },
    },
  );

  return response.data.entries.map(mapConnectorType);
}

export async function getDataConnectConnectorType(type: string) {
  if (useMock) {
    const connectorType = mockConnectorTypes.find((item) => item.type === type);
    if (!connectorType) {
      throw new Error(`Connector type ${type} was not found`);
    }
    return wait(mapConnectorType(connectorType));
  }

  const response = await http.get<BackendConnectorType>(
    `/vega-backend/v1/connector-types/${encodeURIComponent(type)}`,
  );

  return mapConnectorType(response.data);
}

export async function listDataConnectRecords(
  query: DataConnectListQuery,
): Promise<DataConnectListResult> {
  if (useMock) {
    return listCatalogs({ ...query, type: "physical" });
  }

  const batchSize = 200;
  const allItems: DataConnectRecord[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await listCatalogs(
      catalogListAllQuery({
        page,
        pageSize: batchSize,
      }),
    );

    allItems.push(...result.items);
    total = result.total;
    page += 1;
  } while (allItems.length < total);

  const filtered = filterCatalogs(allItems, {
    ...query,
    type: "physical",
  });
  const startIndex = (query.page - 1) * query.pageSize;

  return {
    items: filtered.slice(startIndex, startIndex + query.pageSize),
    total: filtered.length,
  };
}

export async function getDataConnectRecord(id: string) {
  return getCatalog(id);
}

export async function getDataConnectHealthCheckSchedule(id: string) {
  return getCatalogHealthCheckSchedule(id);
}

export async function testDataConnectRecord(id: string) {
  assertConnectionTestSucceeded(await testCatalogConnection(id));
}

export async function testDataConnectConfig(input: CatalogConnectionTestInput) {
  assertConnectionTestSucceeded(await testCatalogConnectionConfig(input));
}

export async function setDataConnectRecordEnabled(id: string, enabled: boolean) {
  return setCatalogEnabled(id, enabled);
}

export async function deleteDataConnectRecord(id: string) {
  return deleteCatalog(id);
}

export async function createDataConnectRecord(
  input: DataConnectMutationPayload,
  options: CatalogMutationOptions = {},
) {
  if (useMock) {
    const connectorType = mockConnectorTypes.find((item) => item.type === input.connectorType);
    return createPhysicalCatalog({
      ...input,
      category: connectorType?.category ?? inferConnectorCategory(input.connectorType),
      mode: connectorType?.mode ?? "local",
    });
  }

  return createPhysicalCatalog(input, options);
}

export { createLogicalCatalog };

export async function updateDataConnectRecord(
  id: string,
  input: DataConnectUpdatePayload,
  options: CatalogMutationOptions = {},
) {
  return updateCatalog(id, input, options);
}

export async function updateDataConnectHealthCheckSchedule(
  id: string,
  input: CatalogHealthCheckScheduleInput,
  expectedUpdateTime: number,
) {
  return updateCatalogHealthCheckSchedule(id, input, expectedUpdateTime);
}

function assertConnectionTestSucceeded(result: CatalogConnectionTestResult) {
  if (result.success) {
    return;
  }

  throw new Error(
    result.message?.trim() || i18n.t("dataConnect.testConnectionFailed"),
  );
}

export function isDataConnectConnectionTestFailure(error: unknown) {
  const expectedCode =
    "VegaBackend.Catalog.InternalError.TestConnectionFailed";

  if (extractRequestErrorDetails(error).code === expectedCode) {
    return true;
  }

  if (axios.isAxiosError<{ error_code?: unknown }>(error)) {
    return error.response?.data?.error_code === expectedCode;
  }

  return false;
}
