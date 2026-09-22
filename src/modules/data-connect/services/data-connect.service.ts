/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import i18n from "@/app/locales/i18n";
import { atLeast, isEdition, parseEdition } from "@/framework/entitlement/edition";
import { extractRequestErrorDetails } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import {
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
  available: boolean;
  category: string;
  description: string;
  enabled: boolean;
  field_config?: Record<string, BackendConnectorFieldConfig>;
  mode: string;
  name: string;
  required_edition?: string;
  type: string;
};

type MockConnectorType = Omit<BackendConnectorType, "available"> & {
  available?: boolean;
};

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const mockConnectorTypes: MockConnectorType[] = [
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
    enabled: false,
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
    required_edition: "professional",
    field_config: {
      host: mockField("Host", "SQL Server server host address", "string", true),
      port: mockField("Port", "SQL Server TCP port", "integer", true),
      username: mockField("Username", "SQL Server login username", "string", true),
      password: mockField("Password", "SQL Server login password", "string", true, true),
      database: mockField("Database", "SQL Server target database", "string", true),
      schemas: mockField(
        "Schema list",
        "Optional. Leave empty to scan all accessible non-system schemas.",
        "array",
        false,
      ),
      options: mockField(
        "Connection options",
        "Connection options such as encrypt, trustservercertificate, and connection timeout.",
        "object",
        false,
      ),
    },
  },
  {
    type: "oracle",
    name: "Oracle",
    category: "table",
    mode: "local",
    description: "Connect Oracle relational databases.",
    enabled: false,
    available: false,
    required_edition: "professional",
  },
  {
    type: "opensearch",
    name: "OpenSearch",
    category: "index",
    mode: "local",
    description: "Connect OpenSearch engines.",
    enabled: true,
    available: false,
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
      auth_type: mockField(
        "Authentication type",
        "Token or application credentials",
        "integer",
        true,
      ),
      token: mockField("Access token", "Required for token authentication", "string", false, true),
      app_id: mockField(
        "Application ID",
        "Required for application authentication",
        "string",
        false,
      ),
      app_secret: mockField(
        "Application secret",
        "Required for application authentication",
        "string",
        false,
        true,
      ),
      doc_lib_type: mockField(
        "Document library type",
        "Knowledge or document library",
        "integer",
        true,
      ),
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

const wait = async <T>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 180);
  });

function mapConnectorType(item: BackendConnectorType): DataConnectConnectorType {
  return {
    available: item.available,
    type: item.type,
    name: item.name,
    category: item.category,
    mode: item.mode,
    description: item.description,
    enabled: item.enabled,
    requiredEdition: isEdition(item.required_edition) ? item.required_edition : undefined,
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

function mockConnectorAvailability(requiredEdition?: string) {
  return (
    !isEdition(requiredEdition) ||
    atLeast(parseEdition(import.meta.env.VITE_MOCK_EDITION), requiredEdition)
  );
}

function getMockConnectorTypes() {
  return mockConnectorTypes.map((item) => ({
    ...item,
    available: item.available ?? mockConnectorAvailability(item.required_edition),
  }));
}

export async function listDataConnectConnectorTypes() {
  if (useMock) {
    return wait(getMockConnectorTypes().map(mapConnectorType));
  }

  const pageSize = 100;
  const entries: BackendConnectorType[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await http.get<ListResponse<BackendConnectorType>>(
      "/vega-backend/v1/connector-types",
      {
        params: {
          direction: "asc",
          limit: pageSize,
          offset,
          sort: "name",
        },
      },
    );
    const pageEntries = response.data.entries;
    entries.push(...pageEntries);
    offset += pageEntries.length;
    hasMore = pageEntries.length === pageSize && offset < response.data.total_count;
  }

  return entries.map(mapConnectorType);
}

export async function getDataConnectConnectorType(type: string) {
  if (useMock) {
    const connectorType = getMockConnectorTypes().find((item) => item.type === type);
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
  options?: { skipErrorToast?: boolean },
): Promise<DataConnectListResult> {
  const catalogQuery = { ...query, type: "physical" as const };
  return options ? listCatalogs(catalogQuery, options) : listCatalogs(catalogQuery);
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

  throw new Error(result.message?.trim() || i18n.t("dataConnect.testConnectionFailed"));
}

export function isDataConnectConnectionTestFailure(error: unknown) {
  const expectedCode = "VegaBackend.Catalog.InternalError.TestConnectionFailed";

  if (extractRequestErrorDetails(error).code === expectedCode) {
    return true;
  }

  if (axios.isAxiosError<{ error_code?: unknown }>(error)) {
    return error.response?.data?.error_code === expectedCode;
  }

  return false;
}
