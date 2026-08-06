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

const mockConnectorTypes: DataConnectConnectorType[] = [
  {
    type: "mariadb",
    name: "MariaDB",
    category: "table",
    mode: "local",
    description: "用于接入 MariaDB / MySQL 兼容数据库。",
    enabled: true,
    fieldConfig: {
      host: {
        name: "Host",
        type: "string",
        description: "数据库访问地址",
        required: true,
        encrypted: false,
      },
      port: {
        name: "Port",
        type: "integer",
        description: "数据库端口",
        required: true,
        encrypted: false,
      },
      username: {
        name: "Username",
        type: "string",
        description: "登录用户名",
        required: true,
        encrypted: false,
      },
      password: {
        name: "Password",
        type: "string",
        description: "登录密码",
        required: true,
        encrypted: true,
      },
    },
  },
  {
    type: "postgresql",
    name: "PostgreSQL",
    category: "table",
    mode: "local",
    description: "用于接入 PostgreSQL 数据库。",
    enabled: true,
    fieldConfig: {
      host: {
        name: "Host",
        type: "string",
        description: "数据库访问地址",
        required: true,
        encrypted: false,
      },
      port: {
        name: "Port",
        type: "integer",
        description: "数据库端口",
        required: true,
        encrypted: false,
      },
      database: {
        name: "Database",
        type: "string",
        description: "数据库名称",
        required: true,
        encrypted: false,
      },
    },
  },
  {
    type: "sqlserver",
    name: "SQL Server",
    category: "table",
    mode: "local",
    description: "用于接入 Microsoft SQL Server 数据库。",
    enabled: true,
    fieldConfig: {
      host: {
        name: "主机地址",
        type: "string",
        description: "SQL Server 服务器主机地址",
        required: true,
        encrypted: false,
      },
      port: {
        name: "端口号",
        type: "integer",
        description: "SQL Server TCP 端口",
        required: true,
        encrypted: false,
      },
      username: {
        name: "用户名",
        type: "string",
        description: "SQL Server 登录用户名",
        required: true,
        encrypted: false,
      },
      password: {
        name: "密码",
        type: "string",
        description: "SQL Server 登录密码",
        required: true,
        encrypted: true,
      },
      database: {
        name: "数据库名",
        type: "string",
        description: "SQL Server 连接目标数据库",
        required: true,
        encrypted: false,
      },
      schemas: {
        name: "Schema 列表",
        type: "array",
        description: "可选；为空时扫描所有可访问的非系统 schema",
        required: false,
        encrypted: false,
      },
      options: {
        name: "连接参数",
        type: "object",
        description:
          "连接参数，如 encrypt、trustservercertificate、connection timeout",
        required: false,
        encrypted: false,
      },
    },
  },
  {
    type: "opensearch",
    name: "OpenSearch",
    category: "index",
    mode: "local",
    description: "用于接入 OpenSearch 检索引擎。",
    enabled: true,
    fieldConfig: {
      endpoint: {
        name: "Endpoint",
        type: "string",
        description: "服务访问地址",
        required: true,
        encrypted: false,
      },
      username: {
        name: "Username",
        type: "string",
        description: "服务账号",
        required: false,
        encrypted: false,
      },
      password: {
        name: "Password",
        type: "string",
        description: "服务密码",
        required: false,
        encrypted: true,
      },
    },
  },
];

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
          name: value.name ?? key,
          type: value.type ?? "string",
          description: value.description ?? "",
          required: Boolean(value.required),
          encrypted: Boolean(value.encrypted),
        },
      ]),
    ),
  };
}

export async function listDataConnectConnectorTypes() {
  if (useMock) {
    return wait(mockConnectorTypes);
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
  input: DataConnectMutationPayload,
  options: CatalogMutationOptions = {},
) {
  return updateCatalog(id, input, options);
}

export async function updateDataConnectHealthCheckSchedule(
  id: string,
  input: CatalogHealthCheckScheduleInput,
) {
  return updateCatalogHealthCheckSchedule(id, input);
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
