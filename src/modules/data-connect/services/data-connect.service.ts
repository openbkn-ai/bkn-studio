import { http } from "@/framework/request/http";
import type {
  DataConnectConnectorType,
  DataConnectHealthStatus,
  DataConnectListQuery,
  DataConnectListResult,
  DataConnectMutationPayload,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";

type BackendAccountInfo = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
};

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

type BackendCatalog = {
  connector_config?: Record<string, unknown>;
  connector_type: string;
  create_time?: number;
  creator?: BackendAccountInfo;
  description?: string;
  enabled: boolean;
  health_check_enabled?: boolean;
  health_check_result?: string;
  health_check_status?: string;
  id: string;
  metadata?: Record<string, unknown>;
  name: string;
  operations?: string[];
  tags?: string[];
  type?: string;
  update_time?: number;
  updater?: BackendAccountInfo;
};

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK === "true";

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

let mockCatalogs: DataConnectRecord[] = [
  {
    id: "cat-001",
    name: "customer_master",
    description: "客户主数据连接，用于同步基础资料。",
    connectorType: "mariadb",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckEnabled: true,
    healthCheckResult: "Connection test passed.",
    updateTime: "2026-06-03 10:45:00",
    createTime: "2026-05-31 16:10:00",
    updaterName: "Platform Admin",
    creatorName: "Platform Admin",
    tags: ["crm", "core"],
    connectorConfig: {
      host: "10.0.0.18",
      port: 3306,
      database: "customer_center",
      username: "readonly",
    },
    metadata: {},
    operations: ["view", "edit", "delete", "test_connection", "enable", "disable"],
    type: "physical",
  },
  {
    id: "cat-002",
    name: "knowledge_index",
    description: "知识网络的全文检索索引。",
    connectorType: "opensearch",
    category: "index",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "degraded",
    healthCheckEnabled: true,
    healthCheckResult: "Latency is higher than expected.",
    updateTime: "2026-06-03 09:12:00",
    createTime: "2026-05-28 11:20:00",
    updaterName: "Search Team",
    creatorName: "Search Team",
    tags: ["search"],
    connectorConfig: {
      endpoint: "https://search.internal:9200",
      username: "search_admin",
    },
    metadata: {},
    operations: ["view", "edit", "delete", "test_connection", "enable", "disable"],
    type: "physical",
  },
  {
    id: "cat-003",
    name: "finance_dw",
    description: "财务数仓只读连接。",
    connectorType: "postgresql",
    category: "table",
    mode: "local",
    enabled: false,
    status: "disabled",
    healthStatus: "unchecked",
    healthCheckEnabled: true,
    healthCheckResult: "",
    updateTime: "2026-05-29 15:28:00",
    createTime: "2026-05-26 10:08:00",
    updaterName: "Data Ops",
    creatorName: "Data Ops",
    tags: ["finance", "warehouse"],
    connectorConfig: {
      host: "10.0.2.31",
      port: 5432,
      database: "finance_dw",
      username: "etl_reader",
    },
    metadata: {},
    operations: ["view", "edit", "delete", "test_connection", "enable", "disable"],
    type: "physical",
  },
  {
    id: "cat-004",
    name: "kn_workspace",
    description: "平台内部命名空间,承载逻辑视图与衍生数据集。",
    connectorType: "",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckEnabled: false,
    healthCheckResult: "",
    updateTime: "2026-06-02 14:30:00",
    createTime: "2026-05-20 09:00:00",
    updaterName: "Platform Admin",
    creatorName: "Platform Admin",
    tags: ["internal"],
    connectorConfig: {},
    metadata: {},
    operations: ["view", "delete"],
    type: "logical",
  },
];

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 180);
  });

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(value)
    .replace(/\//g, "-");
}

function normalizeHealthStatus(value?: string): DataConnectHealthStatus {
  switch (value) {
    case "healthy":
    case "degraded":
    case "unhealthy":
    case "offline":
      return value;
    default:
      return "unchecked";
  }
}

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

function mapCatalog(item: BackendCatalog): DataConnectRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    connectorType: item.connector_type,
    category: inferConnectorCategory(item.connector_type),
    mode: "local",
    enabled: item.enabled,
    status: item.enabled ? "enabled" : "disabled",
    healthStatus: normalizeHealthStatus(item.health_check_status),
    healthCheckEnabled: Boolean(item.health_check_enabled),
    healthCheckResult: item.health_check_result ?? "",
    updateTime: formatTimestamp(item.update_time),
    createTime: formatTimestamp(item.create_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    tags: item.tags ?? [],
    connectorConfig: item.connector_config ?? {},
    metadata: item.metadata ?? {},
    operations: item.operations ?? [],
    type: item.type ?? "physical",
  };
}

function inferConnectorCategory(connectorType: string) {
  if (connectorType === "opensearch") {
    return "index";
  }

  if (connectorType === "anyshare") {
    return "fileset";
  }

  return "table";
}

function filterCatalogs(items: DataConnectRecord[], query: DataConnectListQuery) {
  const keyword = query.keyword.trim().toLowerCase();

  return items.filter((item) => {
    const matchesKeyword =
      keyword.length === 0 ||
      item.name.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword);
    const matchesConnectorType =
      !query.connectorType || item.connectorType === query.connectorType;

    return matchesKeyword && matchesConnectorType;
  });
}

export async function listDataConnectConnectorTypes() {
  if (useMock) {
    return wait(mockConnectorTypes);
  }

  const response = await http.get<ListResponse<BackendConnectorType>>(
    "/vega-backend/v1/connector-types",
    {
      params: {
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
    const filtered = filterCatalogs(mockCatalogs, query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  if (query.connectorType) {
    const response = await http.get<ListResponse<BackendCatalog>>(
      "/vega-backend/v1/catalogs",
      {
        params: {
          direction: "desc",
          limit: 200,
          name: query.keyword.trim() || undefined,
          offset: 0,
          sort: "update_time",
        },
      },
    );

    const mapped = response.data.entries.map(mapCatalog);
    const filtered = filterCatalogs(mapped, query);
    const startIndex = (query.page - 1) * query.pageSize;

    return {
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    };
  }

  const response = await http.get<ListResponse<BackendCatalog>>(
    "/vega-backend/v1/catalogs",
    {
      params: {
        direction: "desc",
        limit: query.pageSize,
        name: query.keyword.trim() || undefined,
        offset: (query.page - 1) * query.pageSize,
        sort: "update_time",
      },
    },
  );

  return {
    items: response.data.entries.map(mapCatalog),
    total: response.data.total_count,
  };
}

export async function getDataConnectRecord(id: string) {
  if (useMock) {
    return wait(mockCatalogs.find((record) => record.id === id) ?? null);
  }

  const response = await http.get<{ entries: BackendCatalog[] }>(
    `/vega-backend/v1/catalogs/${id}`,
  );

  const catalog = response.data.entries?.[0];

  return catalog ? mapCatalog(catalog) : null;
}

export async function testDataConnectRecord(id: string) {
  if (useMock) {
    return wait(undefined);
  }

  await http.post(`/vega-backend/v1/catalogs/${id}/test-connection`);
}

export async function setDataConnectRecordEnabled(id: string, enabled: boolean) {
  if (useMock) {
    mockCatalogs = mockCatalogs.map((record) =>
      record.id === id
        ? {
            ...record,
            enabled,
            status: enabled ? "enabled" : "disabled",
            updateTime: formatTimestamp(Date.now()),
            healthStatus: enabled ? record.healthStatus : "unchecked",
          }
        : record,
    );

    await wait(undefined);
    return;
  }

  await http.post(`/vega-backend/v1/catalogs/${id}/${enabled ? "enable" : "disable"}`);
}

export async function deleteDataConnectRecord(id: string) {
  if (useMock) {
    mockCatalogs = mockCatalogs.filter((record) => record.id !== id);
    await wait(undefined);
    return;
  }

  await http.delete(`/vega-backend/v1/catalogs/${id}`);
}

export async function createDataConnectRecord(input: DataConnectMutationPayload) {
  if (useMock) {
    const connectorType = mockConnectorTypes.find((item) => item.type === input.connectorType);

    mockCatalogs = [
      {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description,
        connectorType: input.connectorType,
        category: connectorType?.category ?? inferConnectorCategory(input.connectorType),
        mode: connectorType?.mode ?? "local",
        enabled: input.enabled,
        status: input.enabled ? "enabled" : "disabled",
        healthStatus: "unchecked",
        healthCheckEnabled: true,
        healthCheckResult: "",
        updateTime: formatTimestamp(Date.now()),
        createTime: formatTimestamp(Date.now()),
        updaterName: "Local Admin",
        creatorName: "Local Admin",
        tags: input.tags,
        connectorConfig: input.connectorConfig,
        metadata: {},
        operations: ["view", "edit", "delete", "test_connection", "enable", "disable"],
        type: "physical",
      },
      ...mockCatalogs,
    ];

    await wait(undefined);
    return;
  }

  await http.post("/vega-backend/v1/catalogs", {
    connector_config: input.connectorConfig,
    connector_type: input.connectorType,
    description: input.description,
    enabled: input.enabled,
    name: input.name,
    tags: input.tags,
  });
}

export async function updateDataConnectRecord(
  id: string,
  input: DataConnectMutationPayload,
) {
  if (useMock) {
    mockCatalogs = mockCatalogs.map((record) =>
      record.id === id
        ? {
            ...record,
            name: input.name,
            description: input.description,
            tags: input.tags,
            connectorConfig: input.connectorConfig,
            updateTime: formatTimestamp(Date.now()),
          }
        : record,
    );

    await wait(undefined);
    return;
  }

  await http.put(`/vega-backend/v1/catalogs/${id}`, {
    connector_config: input.connectorConfig,
    connector_type: input.connectorType,
    description: input.description,
    enabled: input.enabled,
    id,
    name: input.name,
    tags: input.tags,
  });
}
