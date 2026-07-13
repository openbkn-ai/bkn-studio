/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ConnectorFieldConfig,
  DataConnectConnectorType,
} from "@/modules/data-connect/types/data-connect";

export type DataSourceFamilyKey = "structured" | "unstructured";
export type ConnectorFieldGroupKey = "connection" | "auth" | "advanced";

export type DataSourceFamilyMeta = {
  description: string;
  key: DataSourceFamilyKey;
  label: string;
};

export type ConnectorFieldGroup = {
  fields: Array<[string, ConnectorFieldConfig]>;
  key: ConnectorFieldGroupKey;
  title: string;
};

const FAMILY_REGISTRY: Record<DataSourceFamilyKey, DataSourceFamilyMeta> = {
  structured: {
    key: "structured",
    label: "结构化数据",
    description: "数据库、检索、接口等结构化接入。",
  },
  unstructured: {
    key: "unstructured",
    label: "非结构化数据",
    description: "文件、文档库等非结构化接入。",
  },
};

const CATEGORY_TO_FAMILY: Record<string, DataSourceFamilyKey> = {
  api: "structured",
  file: "unstructured",
  fileset: "unstructured",
  index: "structured",
  metric: "structured",
  table: "structured",
  topic: "structured",
};

const CATEGORY_TO_TEMPLATE: Record<string, { description: string; label: string }> = {
  api: {
    label: "API 服务",
    description: "通过接口协议接入外部业务系统或第三方数据服务。",
  },
  file: {
    label: "文件数据",
    description: "导入本地或网络文件中的业务数据。",
  },
  fileset: {
    label: "文件集 / 文档库",
    description: "接入文档库、文件目录或批量文件资源。",
  },
  index: {
    label: "搜索引擎",
    description: "连接全文检索或索引引擎，承载检索与召回能力。",
  },
  metric: {
    label: "时序数据",
    description: "接入指标、监控与时序型业务数据。",
  },
  table: {
    label: "关系型数据库",
    description: "连接数据库实例，接入结构化业务数据。",
  },
  topic: {
    label: "消息主题",
    description: "接入消息流或主题通道，处理持续更新的数据。",
  },
};

const TYPE_TO_TEMPLATE: Record<string, { description?: string; label?: string }> = {
  mariadb: {
    description: "面向业务库接入。",
  },
  mysql: {
    description: "面向业务库接入。",
  },
  postgresql: {
    description: "面向数仓 / 分析型数据。",
  },
  opensearch: {
    description: "面向检索索引接入。",
  },
  anyshare: {
    description: "面向文件集 / 文档资源接入。",
  },
};

const TYPE_FIELD_DEFAULTS: Record<string, Record<string, unknown>> = {
  mariadb: {
    port: 3306,
    charset: "utf8mb4",
    encoding: "utf8mb4",
    ssl: false,
    use_ssl: false,
    ssl_enabled: false,
  },
  mysql: {
    port: 3306,
    charset: "utf8mb4",
    encoding: "utf8mb4",
    ssl: false,
    use_ssl: false,
    ssl_enabled: false,
  },
  postgresql: {
    port: 5432,
    schema: "public",
    encoding: "UTF8",
    charset: "UTF8",
    ssl_mode: "prefer",
    ssl: false,
    use_ssl: false,
  },
  opensearch: {
    port: 9200,
  },
};

const TYPE_PORT_PLACEHOLDER: Record<string, string> = {
  mariadb: "例如 3306",
  mysql: "例如 3306",
  postgresql: "例如 5432",
  opensearch: "例如 9200",
};

const BOOLEAN_FIELD_NAMES = new Set([
  "enable_ssl",
  "ssl",
  "ssl_enabled",
  "ssl_verify",
  "tls",
  "use_ssl",
  "use_tls",
  "verify_ssl",
]);

const ENCODING_FIELD_NAMES = new Set([
  "character_encoding",
  "character_set",
  "charset",
  "encoding",
]);

const SSL_MODE_FIELD_NAMES = new Set(["sslmode", "ssl_mode"]);

const ENCODING_OPTIONS = [
  { label: "utf8mb4", value: "utf8mb4" },
  { label: "utf8", value: "utf8" },
  { label: "UTF8", value: "UTF8" },
  { label: "gbk", value: "gbk" },
  { label: "latin1", value: "latin1" },
];

const SSL_MODE_OPTIONS = [
  { label: "禁用", value: "disable" },
  { label: "优先", value: "prefer" },
  { label: "要求", value: "require" },
  { label: "校验 CA", value: "verify-ca" },
  { label: "完整校验", value: "verify-full" },
];

const CONNECTION_MODE_OPTIONS = [
  { label: "默认", value: "default" },
  { label: "只读", value: "readonly" },
  { label: "读写", value: "readwrite" },
];

export type ConnectorFieldControlOption = {
  label: string;
  value: boolean | number | string;
};

export type ConnectorFieldControl =
  | { kind: "json" }
  | { kind: "number" }
  | { kind: "password" }
  | { kind: "select"; options: ConnectorFieldControlOption[] }
  | { kind: "switch" }
  | { kind: "tags" }
  | { kind: "text" };

const CONNECTION_KEYS = new Set([
  "catalog",
  "catalog_name",
  "database",
  "database_list",
  "database_name",
  "databases",
  "db",
  "endpoint",
  "host",
  "hostname",
  "path",
  "port",
  "project",
  "schema",
  "schema_list",
  "server",
  "table",
  "uri",
  "url",
  "warehouse",
]);

const AUTH_KEYS = new Set([
  "access_key",
  "account",
  "ak",
  "api_key",
  "app_key",
  "password",
  "secret",
  "secret_key",
  "sk",
  "token",
  "user",
  "username",
]);

export function getDataSourceFamilyMeta(key: DataSourceFamilyKey) {
  return FAMILY_REGISTRY[key];
}

export function getPrimaryDataSourceFamilies(): DataSourceFamilyMeta[] {
  return [FAMILY_REGISTRY.structured, FAMILY_REGISTRY.unstructured];
}

export function resolveDataSourceFamily(connector: Pick<DataConnectConnectorType, "category">) {
  return CATEGORY_TO_FAMILY[connector.category] ?? "structured";
}

export function matchesDataSourceFamily(
  connector: Pick<DataConnectConnectorType, "category">,
  family: DataSourceFamilyKey,
) {
  return resolveDataSourceFamily(connector) === family;
}

export function getConnectorTemplateMeta(
  connector: Pick<DataConnectConnectorType, "category" | "description" | "name" | "type">,
) {
  const byCategory = CATEGORY_TO_TEMPLATE[connector.category];
  const byType = TYPE_TO_TEMPLATE[connector.type];

  return {
    label: byType?.label ?? byCategory?.label ?? connector.name,
    description: byType?.description ?? byCategory?.description ?? connector.description ?? "",
  };
}

export function humanizeConnectorFieldLabel(name: string) {
  const labelMap: Record<string, string> = {
    account: "账号",
    api_key: "API Key",
    catalog: "Catalog",
    character_encoding: "字符编码",
    character_set: "字符集",
    charset: "字符集",
    connection_mode: "连接模式",
    database: "数据库",
    database_list: "数据库列表",
    databases: "数据库列表",
    db: "数据库",
    enable_ssl: "启用 SSL",
    encoding: "字符编码",
    endpoint: "访问地址",
    host: "主机地址",
    mode: "模式",
    password: "密码",
    path: "路径",
    port: "端口号",
    project: "项目",
    schema: "Schema",
    schema_list: "Schema 列表",
    secret: "密钥",
    secret_key: "密钥",
    server: "主机地址",
    ssl: "SSL",
    ssl_enabled: "启用 SSL",
    ssl_mode: "SSL 模式",
    sslmode: "SSL 模式",
    table: "数据表",
    token: "访问令牌",
    uri: "连接地址",
    url: "连接地址",
    use_ssl: "启用 SSL",
    user: "用户名",
    username: "用户名",
    warehouse: "仓库",
  };

  const normalized = name.trim().toLowerCase();
  if (labelMap[normalized]) {
    return labelMap[normalized];
  }

  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (char) => char.toUpperCase());
}

export function connectorFieldOrderRank(key: string) {
  const normalized = key.trim().toLowerCase();
  const rankMap: Record<string, number> = {
    host: 1,
    hostname: 1,
    server: 1,
    user: 2,
    username: 2,
    account: 2,
    port: 3,
    database: 4,
    db: 4,
    database_list: 4,
    databases: 4,
    schema: 4,
    schema_list: 4,
    table: 5,
    endpoint: 6,
    url: 6,
    uri: 6,
  };

  return rankMap[normalized] ?? 100;
}

export function getConnectorFieldPlaceholder(
  fieldName: string,
  fieldType: string,
  connectorType?: string,
) {
  const normalized = fieldName.trim().toLowerCase();
  const placeholderMap: Record<string, string> = {
    account: "例如 readonly_account",
    api_key: "请输入 API Key",
    database: "例如 supply_chain",
    database_list: "例如 supply_chain, finance_dw",
    databases: "例如 supply_chain, finance_dw",
    db: "例如 supply_chain",
    endpoint: "例如 https://search.internal:9200",
    host: "例如 db.example.internal",
    password: "请输入密码",
    path: "例如 /data/import",
    project: "例如 demo_project",
    schema: "例如 public",
    schema_list: "例如 public, ods",
    secret: "请输入密钥",
    secret_key: "请输入密钥",
    server: "例如 db.example.internal",
    table: "例如 order_detail",
    token: "请输入访问令牌",
    uri: "例如 mysql://db.example.internal:3306",
    url: "例如 https://api.example.com/v1",
    user: "例如 readonly_user",
    username: "例如 readonly_user",
    warehouse: "例如 analytics_wh",
  };

  if (normalized === "port") {
    const typeKey = connectorType?.trim().toLowerCase() ?? "";
    return TYPE_PORT_PLACEHOLDER[typeKey] ?? "例如 3306";
  }

  if (placeholderMap[normalized]) {
    return placeholderMap[normalized];
  }

  if (fieldType === "array") {
    return "回车后可继续添加多个值";
  }

  if (fieldType === "object") {
    return "请输入 JSON 配置";
  }

  if (fieldType === "integer" || fieldType === "number") {
    return "请输入数值";
  }

  return `请输入${humanizeConnectorFieldLabel(fieldName)}`;
}

export function resolveConnectorFieldControl(
  fieldName: string,
  fieldType: string,
): ConnectorFieldControl {
  const normalized = fieldName.trim().toLowerCase();

  if (fieldType === "boolean" || BOOLEAN_FIELD_NAMES.has(normalized)) {
    return { kind: "switch" };
  }

  if (ENCODING_FIELD_NAMES.has(normalized)) {
    return { kind: "select", options: ENCODING_OPTIONS };
  }

  if (SSL_MODE_FIELD_NAMES.has(normalized)) {
    return { kind: "select", options: SSL_MODE_OPTIONS };
  }

  if (normalized === "mode" || normalized === "connection_mode") {
    return { kind: "select", options: CONNECTION_MODE_OPTIONS };
  }

  if (fieldType === "integer" || fieldType === "number") {
    return { kind: "number" };
  }

  if (fieldType === "array") {
    return { kind: "tags" };
  }

  if (fieldType === "object") {
    return { kind: "json" };
  }

  return { kind: "text" };
}

type ConnectorConfigDefaultValue = boolean | number | string | string[];

export function getConnectorConfigDefaults(
  connector?: Pick<DataConnectConnectorType, "fieldConfig" | "type">,
): Record<string, ConnectorConfigDefaultValue> {
  if (!connector) {
    return {};
  }

  const typeKey = connector.type.trim().toLowerCase();
  const recommended = TYPE_FIELD_DEFAULTS[typeKey] ?? {};
  const fieldConfig = connector.fieldConfig ?? {};
  const defaults: Record<string, ConnectorConfigDefaultValue> = {};

  Object.keys(fieldConfig).forEach((fieldName) => {
    const normalized = fieldName.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(recommended, normalized)) {
      defaults[fieldName] = recommended[normalized] as ConnectorConfigDefaultValue;
    }
  });

  return defaults;
}

export function groupConnectorFields(
  connector?: Pick<DataConnectConnectorType, "fieldConfig">,
): ConnectorFieldGroup[] {
  const fieldEntries = Object.entries(connector?.fieldConfig ?? {}).sort((left, right) => {
    const leftGroup = connectorFieldGroupRank(resolveFieldGroupKey(left[0], left[1]));
    const rightGroup = connectorFieldGroupRank(resolveFieldGroupKey(right[0], right[1]));
    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    const leftRank = connectorFieldOrderRank(left[0]);
    const rightRank = connectorFieldOrderRank(right[0]);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return humanizeConnectorFieldLabel(left[0]).localeCompare(
      humanizeConnectorFieldLabel(right[0]),
      "zh-CN",
    );
  });

  const grouped = new Map<ConnectorFieldGroupKey, Array<[string, ConnectorFieldConfig]>>();

  fieldEntries.forEach(([fieldName, fieldConfig]) => {
    const groupKey = resolveFieldGroupKey(fieldName, fieldConfig);
    const current = grouped.get(groupKey) ?? [];
    current.push([fieldName, fieldConfig]);
    grouped.set(groupKey, current);
  });

  return ([
    ["connection", "连接参数"],
    ["auth", "认证信息"],
    ["advanced", "高级设置"],
  ] as const)
    .map(([key, title]) => ({
      key,
      title,
      fields: grouped.get(key) ?? [],
    }))
    .filter((group) => group.fields.length > 0);
}

function connectorFieldGroupRank(key: ConnectorFieldGroupKey) {
  switch (key) {
    case "connection":
      return 1;
    case "auth":
      return 2;
    case "advanced":
    default:
      return 3;
  }
}

function resolveFieldGroupKey(fieldName: string, fieldConfig: ConnectorFieldConfig): ConnectorFieldGroupKey {
  const normalized = fieldName.trim().toLowerCase();

  if (fieldConfig.encrypted || AUTH_KEYS.has(normalized)) {
    return "auth";
  }

  if (CONNECTION_KEYS.has(normalized)) {
    return "connection";
  }

  if (fieldConfig.type === "object" || fieldConfig.type === "array" || fieldConfig.type === "boolean") {
    return "advanced";
  }

  return "connection";
}
