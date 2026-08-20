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
import i18n from "@/app/locales/i18n";

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

const FAMILY_FALLBACKS: Record<DataSourceFamilyKey, Omit<DataSourceFamilyMeta, "key">> = {
  structured: {
    label: "Structured and semi-structured data",
    description: "Structured access for databases, search, APIs, and similar sources.",
  },
  unstructured: {
    label: "Unstructured data",
    description: "Access for files, document libraries, and similar unstructured sources.",
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

const CATEGORY_TO_TEMPLATE_FALLBACKS: Record<string, { description: string; label: string }> = {
  api: {
    label: "API service",
    description: "Connect external business systems or third-party services through API protocols.",
  },
  file: {
    label: "File data",
    description: "Import business data from local or remote files.",
  },
  fileset: {
    label: "Fileset / document library",
    description: "Connect document libraries, file directories, or bulk file resources.",
  },
  index: {
    label: "Search engine",
    description: "Connect full-text search or index engines for retrieval.",
  },
  metric: {
    label: "Time series data",
    description: "Connect metrics, monitoring, and other time-series business data.",
  },
  table: {
    label: "Relational database",
    description: "Connect database instances for structured business data.",
  },
  topic: {
    label: "Message topic",
    description: "Connect message streams or topic channels for continuously updated data.",
  },
};

const TYPE_TO_TEMPLATE_FALLBACKS: Record<string, { description?: string; label?: string }> = {
  mariadb: {
    description: "Connect MariaDB-compatible relational databases.",
  },
  mysql: {
    description: "Connect MySQL-compatible relational databases.",
  },
  postgresql: {
    description: "Connect PostgreSQL relational databases.",
  },
  sqlserver: {
    description: "Connect Microsoft SQL Server relational databases.",
  },
  opensearch: {
    description: "Connect OpenSearch indexes.",
  },
  anyshare: {
    description: "Connect fileset and document resources.",
  },
};

const KNOWN_CONNECTOR_TYPES: DataConnectConnectorType[] = [
  knownConnectorType("mariadb", "MariaDB", "table"),
  knownConnectorType("mysql", "MySQL", "table"),
  knownConnectorType("postgresql", "PostgreSQL", "table"),
  knownConnectorType("sqlserver", "SQL Server", "table"),
  knownConnectorType("opensearch", "OpenSearch", "index"),
];

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
  sqlserver: {
    port: 1433,
  },
  opensearch: {
    port: 9200,
  },
};

const TYPE_PORT_PLACEHOLDER: Record<string, string> = {
  mariadb: "For example: 3306",
  mysql: "For example: 3306",
  postgresql: "For example: 5432",
  sqlserver: "For example: 1433",
  opensearch: "For example: 9200",
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
  { label: "Disable", value: "disable" },
  { label: "Prefer", value: "prefer" },
  { label: "Require", value: "require" },
  { label: "Verify CA", value: "verify-ca" },
  { label: "Verify full", value: "verify-full" },
];

const CONNECTION_MODE_OPTIONS = [
  { label: "Default", value: "default" },
  { label: "Read only", value: "readonly" },
  { label: "Read/write", value: "readwrite" },
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

type ConnectorFieldCondition = {
  field: string;
  values: readonly (boolean | number | string)[];
};

type ConnectorFieldTemplate = {
  control?: ConnectorFieldControl;
  group?: ConnectorFieldGroupKey;
  label: string;
  requiredWhen?: ConnectorFieldCondition;
  visibleWhen?: ConnectorFieldCondition;
};

const CONNECTOR_FIELD_TEMPLATES: Record<string, Record<string, ConnectorFieldTemplate>> = {
  mariadb: {
    host: { label: "Host" },
    port: { label: "Port" },
    username: { group: "auth", label: "Username" },
    password: { group: "auth", label: "Password" },
    databases: { label: "Database list" },
    options: { group: "advanced", label: "Connection options" },
  },
  mysql: {
    host: { label: "Host" },
    port: { label: "Port" },
    username: { group: "auth", label: "Username" },
    password: { group: "auth", label: "Password" },
    databases: { label: "Database list" },
    options: { group: "advanced", label: "Connection options" },
  },
  postgresql: {
    host: { label: "Host" },
    port: { label: "Port" },
    username: { group: "auth", label: "Username" },
    password: { group: "auth", label: "Password" },
    database: { label: "Database" },
    schemas: { group: "advanced", label: "Schema list" },
    options: { group: "advanced", label: "Connection options" },
  },
  sqlserver: {
    host: { label: "Host" },
    port: { label: "Port" },
    username: { group: "auth", label: "Username" },
    password: { group: "auth", label: "Password" },
    database: { label: "Database" },
    schemas: { group: "advanced", label: "Schema list" },
    options: { group: "advanced", label: "Connection options" },
  },
  opensearch: {
    host: { label: "Host" },
    port: { label: "Port" },
    username: { group: "auth", label: "Username" },
    password: { group: "auth", label: "Password" },
    index_pattern: { label: "Index pattern" },
  },
  anyshare: {
    protocol: {
      control: {
        kind: "select",
        options: [
          { label: "HTTP", value: "http" },
          { label: "HTTPS", value: "https" },
        ],
      },
      label: "Protocol",
    },
    host: { label: "Host" },
    port: { label: "Port" },
    auth_type: {
      control: {
        kind: "select",
        options: [
          { label: "Access token", value: 1 },
          { label: "Application credentials", value: 2 },
        ],
      },
      group: "auth",
      label: "Authentication type",
    },
    token: {
      group: "auth",
      label: "Access token",
      requiredWhen: { field: "auth_type", values: [1] },
      visibleWhen: { field: "auth_type", values: [1] },
    },
    app_id: {
      group: "auth",
      label: "Application ID",
      requiredWhen: { field: "auth_type", values: [2] },
      visibleWhen: { field: "auth_type", values: [2] },
    },
    app_secret: {
      group: "auth",
      label: "Application secret",
      requiredWhen: { field: "auth_type", values: [2] },
      visibleWhen: { field: "auth_type", values: [2] },
    },
    doc_lib_type: {
      control: {
        kind: "select",
        options: [
          { label: "Knowledge base", value: 1 },
          { label: "Document library", value: 2 },
        ],
      },
      label: "Document library type",
    },
    paths: { label: "Paths" },
  },
};

const GENERIC_FIELD_LABELS: Record<string, string> = {
  account: "Account",
  api_key: "API Key",
  app_id: "Application ID",
  app_secret: "Application secret",
  auth_type: "Authentication type",
  catalog: "Catalog",
  character_encoding: "Character encoding",
  character_set: "Character set",
  charset: "Character set",
  cluster: "Cluster",
  connection_mode: "Connection mode",
  database: "Database",
  database_list: "Database list",
  databases: "Database list",
  db: "Database",
  doc_lib_type: "Document library type",
  enable_ssl: "Enable SSL",
  encoding: "Character encoding",
  endpoint: "Endpoint",
  host: "Host",
  index_pattern: "Index pattern",
  mode: "Mode",
  options: "Connection options",
  password: "Password",
  path: "Path",
  paths: "Paths",
  port: "Port",
  project: "Project",
  protocol: "Protocol",
  schema: "Schema",
  schema_list: "Schema list",
  schemas: "Schema list",
  secret: "Secret",
  secret_key: "Secret key",
  server: "Host",
  ssl: "SSL",
  ssl_enabled: "Enable SSL",
  ssl_mode: "SSL mode",
  sslmode: "SSL mode",
  table: "Table",
  token: "Access token",
  uri: "Connection URI",
  url: "Connection URL",
  use_ssl: "Enable SSL",
  user: "User",
  username: "Username",
  warehouse: "Warehouse",
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
  const fallback = FAMILY_FALLBACKS[key];
  return {
    key,
    label: dataConnectText(`connectorTemplates.families.${key}.label`, fallback.label),
    description: dataConnectText(
      `connectorTemplates.families.${key}.description`,
      fallback.description,
    ),
  };
}

export function getPrimaryDataSourceFamilies(): DataSourceFamilyMeta[] {
  return [getDataSourceFamilyMeta("structured"), getDataSourceFamilyMeta("unstructured")];
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
  const byCategory = CATEGORY_TO_TEMPLATE_FALLBACKS[connector.category];
  const byType = TYPE_TO_TEMPLATE_FALLBACKS[connector.type];

  return {
    label:
      templateTypeText(connector.type, "label", byType?.label) ??
      templateCategoryText(connector.category, "label", byCategory?.label) ??
      connector.name,
    description:
      templateTypeText(connector.type, "description", byType?.description) ??
      templateCategoryText(connector.category, "description", byCategory?.description) ??
      connector.description ??
      "",
  };
}

export function filterConnectorTypes(
  connectors: DataConnectConnectorType[],
  family: DataSourceFamilyKey,
  nameKeyword: string,
  tag?: string,
) {
  const normalizedNameKeyword = nameKeyword.trim().toLowerCase();

  return connectors.filter((connector) => {
    const templateMeta = getConnectorTemplateMeta(connector);
    const matchesName =
      normalizedNameKeyword.length === 0 ||
      connector.name.toLowerCase().includes(normalizedNameKeyword);
    const matchesTag = tag === undefined || templateMeta.label === tag;

    return matchesDataSourceFamily(connector, family) && matchesName && matchesTag;
  });
}

export function getConnectorTypeTags(
  connectors: DataConnectConnectorType[],
  family: DataSourceFamilyKey,
) {
  return Array.from(
    new Set(
      connectors
        .filter((connector) => matchesDataSourceFamily(connector, family))
        .map((connector) => getConnectorTemplateMeta(connector).label),
    ),
  ).sort();
}

export function mergeKnownConnectorTypes(
  availableTypes: DataConnectConnectorType[],
) {
  const availableByType = new Map(
    availableTypes.map((item) => [item.type.trim().toLowerCase(), item]),
  );
  const knownTypeNames = new Set(KNOWN_CONNECTOR_TYPES.map((item) => item.type));

  return [
    ...KNOWN_CONNECTOR_TYPES.map(
      (item) => availableByType.get(item.type) ?? { ...item, fieldConfig: {} },
    ),
    ...availableTypes.filter(
      (item) => !knownTypeNames.has(item.type.trim().toLowerCase()),
    ),
  ];
}

function knownConnectorType(
  type: string,
  name: string,
  category: string,
): DataConnectConnectorType {
  return {
    category,
    description: "",
    enabled: false,
    fieldConfig: {},
    mode: "local",
    name,
    type,
  };
}

export function humanizeConnectorFieldLabel(name: string, connectorType?: string) {
  const normalized = name.trim().toLowerCase();
  const template = getConnectorFieldTemplate(connectorType, normalized);
  const defaultLabel = template?.label ?? GENERIC_FIELD_LABELS[normalized];
  if (defaultLabel) {
    return dataConnectText(`connectorTemplates.fieldLabels.${normalized}`, defaultLabel);
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
  const typeKey = connectorType?.trim().toLowerCase() ?? "";
  const placeholderMap: Record<string, string> = {
    account: "For example: readonly_account",
    api_key: "Enter API Key",
    database: "For example: supply_chain",
    database_list: "For example: supply_chain, finance_dw",
    databases: "For example: supply_chain, finance_dw",
    db: "For example: supply_chain",
    endpoint: "For example: https://search.internal:9200",
    host: "For example: db.example.internal",
    password: "Enter password",
    path: "For example: /data/import",
    project: "For example: demo_project",
    schema: "For example: public",
    schema_list: "For example: public, ods",
    secret: "Enter secret",
    secret_key: "Enter secret",
    server: "For example: db.example.internal",
    table: "For example: order_detail",
    token: "Enter access token",
    uri: "For example: mysql://db.example.internal:3306",
    url: "For example: https://api.example.com/v1",
    user: "For example: readonly_user",
    username: "For example: readonly_user",
    warehouse: "For example: analytics_wh",
  };

  if (normalized === "port") {
    return templatePortPlaceholder(typeKey);
  }

  if (normalized === "options" && typeKey === "sqlserver") {
    return dataConnectText(
      "connectorTemplates.placeholders.sqlserverOptions",
      'For example: {"encrypt":true,"trustservercertificate":false}',
    );
  }

  if (placeholderMap[normalized]) {
    return dataConnectText(`connectorTemplates.placeholders.${normalized}`, placeholderMap[normalized]);
  }

  if (fieldType === "array") {
    return dataConnectText("connectorTemplates.placeholders.array", "Press Enter to add more values");
  }

  if (fieldType === "object") {
    return dataConnectText("connectorTemplates.placeholders.object", "Enter JSON configuration");
  }

  if (fieldType === "integer" || fieldType === "number") {
    return dataConnectText("connectorTemplates.placeholders.number", "Enter a number");
  }

  return i18n.t("dataConnect.connectorTemplates.placeholders.default", {
    defaultValue: "Enter {{field}}",
    field: humanizeConnectorFieldLabel(fieldName),
  });
}

export function resolveConnectorFieldControl(
  fieldName: string,
  fieldType: string,
  connectorType?: string,
): ConnectorFieldControl {
  const normalized = fieldName.trim().toLowerCase();
  const templateControl = getConnectorFieldTemplate(connectorType, normalized)?.control;

  if (templateControl) {
    return localizeConnectorFieldControl(connectorType, normalized, templateControl);
  }

  if (fieldType === "boolean" || BOOLEAN_FIELD_NAMES.has(normalized)) {
    return { kind: "switch" };
  }

  if (ENCODING_FIELD_NAMES.has(normalized)) {
    return { kind: "select", options: ENCODING_OPTIONS };
  }

  if (SSL_MODE_FIELD_NAMES.has(normalized)) {
    return { kind: "select", options: localizedOptions("sslModes", SSL_MODE_OPTIONS) };
  }

  if (normalized === "mode" || normalized === "connection_mode") {
    return { kind: "select", options: localizedOptions("connectionModes", CONNECTION_MODE_OPTIONS) };
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

export function isValidJSONObject(value: unknown) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "object") {
    return !Array.isArray(value);
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return true;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
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
  connector?: Pick<DataConnectConnectorType, "fieldConfig" | "type">,
): ConnectorFieldGroup[] {
  const fieldEntries = Object.entries(connector?.fieldConfig ?? {}).sort((left, right) => {
    const leftGroup = connectorFieldGroupRank(
      resolveFieldGroupKey(connector?.type, left[0], left[1]),
    );
    const rightGroup = connectorFieldGroupRank(
      resolveFieldGroupKey(connector?.type, right[0], right[1]),
    );
    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    const leftRank = connectorFieldOrderRank(left[0]);
    const rightRank = connectorFieldOrderRank(right[0]);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return humanizeConnectorFieldLabel(left[0], connector?.type).localeCompare(
      humanizeConnectorFieldLabel(right[0], connector?.type),
      "zh-CN",
    );
  });

  const grouped = new Map<ConnectorFieldGroupKey, Array<[string, ConnectorFieldConfig]>>();

  fieldEntries.forEach(([fieldName, fieldConfig]) => {
    const groupKey = resolveFieldGroupKey(connector?.type, fieldName, fieldConfig);
    const current = grouped.get(groupKey) ?? [];
    current.push([fieldName, fieldConfig]);
    grouped.set(groupKey, current);
  });

  return ([
    ["connection", "Connection parameters"],
    ["auth", "Authentication"],
    ["advanced", "Advanced settings"],
  ] as const)
    .map(([key, title]) => ({
      key,
      title: dataConnectText(`connectorTemplates.fieldGroups.${key}`, title),
      fields: grouped.get(key) ?? [],
    }))
    .filter((group) => group.fields.length > 0);
}

export function isConnectorFieldRequired(
  connectorType: string | undefined,
  fieldName: string,
  backendRequired: boolean,
  values?: Record<string, unknown>,
) {
  const template = getConnectorFieldTemplate(connectorType, fieldName);
  return backendRequired || conditionMatches(template?.requiredWhen, values);
}

export function isConnectorFieldVisible(
  connectorType: string | undefined,
  fieldName: string,
  values?: Record<string, unknown>,
) {
  const template = getConnectorFieldTemplate(connectorType, fieldName);
  return !template?.visibleWhen || conditionMatches(template.visibleWhen, values);
}

function getConnectorFieldTemplate(connectorType: string | undefined, fieldName: string) {
  if (!connectorType) {
    return undefined;
  }

  return CONNECTOR_FIELD_TEMPLATES[connectorType.trim().toLowerCase()]?.[
    fieldName.trim().toLowerCase()
  ];
}

function conditionMatches(
  condition: ConnectorFieldCondition | undefined,
  values: Record<string, unknown> | undefined,
) {
  if (!condition) {
    return false;
  }

  const value = values?.[condition.field];
  return condition.values.some((candidate) => String(candidate) === String(value));
}

function localizeConnectorFieldControl(
  connectorType: string | undefined,
  fieldName: string,
  control: ConnectorFieldControl,
): ConnectorFieldControl {
  if (control.kind !== "select" || !connectorType) {
    return control;
  }

  const typeKey = connectorType.trim().toLowerCase();
  return {
    ...control,
    options: control.options.map((option) => ({
      ...option,
      label: dataConnectText(
        `connectorTemplates.options.${typeKey}.${fieldName}.${option.value}`,
        option.label,
      ),
    })),
  };
}

function dataConnectText(key: string, defaultValue: string): string {
  return i18n.t(`dataConnect.${key}`, { defaultValue });
}

function templateCategoryText(
  category: string,
  field: "description" | "label",
  defaultValue?: string,
) {
  if (!defaultValue) {
    return undefined;
  }
  return dataConnectText(`connectorTemplates.categories.${category}.${field}`, defaultValue);
}

function templateTypeText(
  type: string,
  field: "description" | "label",
  defaultValue?: string,
) {
  if (!defaultValue) {
    return undefined;
  }
  return dataConnectText(`connectorTemplates.types.${type}.${field}`, defaultValue);
}

function templatePortPlaceholder(typeKey: string) {
  const defaultValue = TYPE_PORT_PLACEHOLDER[typeKey] ?? "For example: 3306";
  return dataConnectText(`connectorTemplates.portPlaceholders.${typeKey || "default"}`, defaultValue);
}

function localizedOptions(
  group: "connectionModes" | "sslModes",
  options: ConnectorFieldControlOption[],
) {
  return options.map((option) => ({
    ...option,
    label: dataConnectText(`connectorTemplates.options.${group}.${option.value}`, option.label),
  }));
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

function resolveFieldGroupKey(
  connectorType: string | undefined,
  fieldName: string,
  fieldConfig: ConnectorFieldConfig,
): ConnectorFieldGroupKey {
  const templateGroup = getConnectorFieldTemplate(connectorType, fieldName)?.group;
  if (templateGroup) {
    return templateGroup;
  }

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

/**
 * 需要专业档授权的「认证 / 高级连接器」。
 *
 * `connector_certified`(登记表专业档)覆盖的正是这批商业数据库。**权威清单在 Vega 侧
 * 维护**——license-server `capability-registry.md` §8 明写登记表只登 key 与最低档、不列
 * 具体连接器。这里是产品侧的展示快照,用来给选择器上的卡片标一个档位徽标;它不参与任何
 * 判定,能不能建连由服务端说了算。
 *
 * 新增认证连接器时两边都要改,漏了这边只是少一个徽标,不会放行任何东西。
 */
const CERTIFIED_CONNECTOR_TYPES = new Set(["sqlserver"]);

/** 该连接器类型是否属于认证连接器(专业档起)。只用于展示。 */
export function isCertifiedConnectorType(type: string): boolean {
  return CERTIFIED_CONNECTOR_TYPES.has(type.trim().toLowerCase());
}
