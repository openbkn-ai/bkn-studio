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
    description: "适用于数据库、检索引擎、接口服务等具备稳定结构的数据连接。",
  },
  unstructured: {
    key: "unstructured",
    label: "非结构化数据",
    description: "适用于文件、文档库、对象存储等非表结构数据接入场景。",
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
    description: "适用于 MySQL / MariaDB 业务库接入，常见于订单、商品、客户等结构化数据同步。",
  },
  mysql: {
    description: "适用于 MySQL 业务库接入，承载日常业务表和明细数据接入场景。",
  },
  postgresql: {
    description: "适用于 PostgreSQL 数据库接入，常见于数据仓库、业务中台和分析型数据场景。",
  },
  opensearch: {
    description: "适用于检索索引接入，承载全文检索、语义召回和索引查询类数据服务。",
  },
  anyshare: {
    description: "适用于文件集和文档资源接入，便于批量接入知识文件与非结构化内容。",
  },
};

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
    database: "数据库",
    database_list: "数据库列表",
    databases: "数据库列表",
    db: "数据库",
    endpoint: "访问地址",
    host: "主机地址",
    password: "密码",
    path: "路径",
    port: "端口号",
    project: "项目",
    schema: "Schema",
    schema_list: "Schema 列表",
    secret: "密钥",
    secret_key: "密钥",
    server: "主机地址",
    table: "数据表",
    token: "访问令牌",
    uri: "连接地址",
    url: "连接地址",
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

export function getConnectorFieldPlaceholder(fieldName: string, fieldType: string) {
  const normalized = fieldName.trim().toLowerCase();
  const placeholderMap: Record<string, string> = {
    account: "例如 readonly_account",
    api_key: "请输入 API Key",
    database: "例如 supply_chain",
    database_list: "例如 supply_chain, finance_dw",
    databases: "例如 supply_chain, finance_dw",
    db: "例如 supply_chain",
    endpoint: "例如 https://search.internal:9200",
    host: "例如 10.10.27.117",
    password: "请输入密码",
    path: "例如 /data/import",
    port: "例如 3306",
    project: "例如 demo_project",
    schema: "例如 public",
    schema_list: "例如 public, ods",
    secret: "请输入密钥",
    secret_key: "请输入密钥",
    server: "例如 10.10.27.117",
    table: "例如 order_detail",
    token: "请输入访问令牌",
    uri: "例如 mysql://10.10.27.117:3306",
    url: "例如 https://api.example.com/v1",
    user: "例如 readonly_user",
    username: "例如 readonly_user",
    warehouse: "例如 analytics_wh",
  };

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
