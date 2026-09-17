/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogRecord } from "@/shared/catalog/types";

export const MOCK_CATALOG_OPERATIONS = [
  "view_detail",
  "modify",
  "delete",
  "authorize",
  "task_manage",
  "query_data",
  "resource_manage",
];

let mockCatalogs: CatalogRecord[] = [
  {
    id: "cat-001",
    builtin: false,
    name: "customer_master",
    description: "客户主数据连接，用于同步基础资料。",
    connectorType: "mariadb",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckResult: "Connection test passed.",
    lastCheckTime: "2026-06-03 10:45:00",
    expectedUpdateTime: Date.parse("2026-06-03T10:45:00Z"),
    updateTime: "2026-06-03 10:45:00",
    createTime: "2026-05-31 16:10:00",
    updaterName: "Platform Admin",
    creatorName: "Platform Admin",
    tags: ["crm", "core"],
    connectorConfig: {
      host: "mariadb.internal.example",
      port: 3306,
      username: "readonly",
      databases: ["customer_center", "crm_reporting"],
      options: { charset: "utf8mb4", connect_timeout: 10 },
    },
    metadata: { schemas: ["customer_center"] },
    operations: [...MOCK_CATALOG_OPERATIONS],
    type: "physical",
  },
  {
    id: "cat-002",
    builtin: false,
    name: "knowledge_index",
    description: "知识网络的全文检索索引。",
    connectorType: "opensearch",
    category: "index",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "degraded",
    healthCheckResult: "Latency is higher than expected.",
    lastCheckTime: "2026-06-03 09:12:00",
    expectedUpdateTime: Date.parse("2026-06-03T09:12:00Z"),
    updateTime: "2026-06-03 09:12:00",
    createTime: "2026-05-28 11:20:00",
    updaterName: "Search Team",
    creatorName: "Search Team",
    tags: ["search"],
    connectorConfig: {
      host: "search.internal.example",
      port: 9200,
      username: "search_admin",
      index_pattern: "knowledge-*",
    },
    metadata: {},
    operations: [...MOCK_CATALOG_OPERATIONS],
    type: "physical",
  },
  {
    id: "cat-003",
    builtin: false,
    name: "finance_dw",
    description: "财务数仓只读连接。",
    connectorType: "postgresql",
    category: "table",
    mode: "local",
    enabled: false,
    status: "disabled",
    healthStatus: "unchecked",
    healthCheckResult: "",
    lastCheckTime: "-",
    expectedUpdateTime: Date.parse("2026-05-29T15:28:00Z"),
    updateTime: "2026-05-29 15:28:00",
    createTime: "2026-05-26 10:08:00",
    updaterName: "Data Ops",
    creatorName: "Data Ops",
    tags: ["finance", "warehouse"],
    connectorConfig: {
      host: "postgres.internal.example",
      port: 5432,
      database: "finance_dw",
      username: "etl_reader",
      schemas: ["finance", "reporting"],
      options: { sslmode: "require", statement_timeout: 30000 },
    },
    metadata: { schemas: ["public"] },
    operations: [...MOCK_CATALOG_OPERATIONS],
    type: "physical",
  },
  {
    id: "cat-006",
    builtin: false,
    name: "ISSUE180_IV18007_PG17_orders_archive_20260915",
    description: "用于验收长名称目录在停用状态下的展示。",
    connectorType: "postgresql",
    category: "table",
    mode: "local",
    enabled: false,
    status: "disabled",
    healthStatus: "unchecked",
    healthCheckResult: "",
    lastCheckTime: "-",
    expectedUpdateTime: Date.parse("2026-09-15T02:30:00Z"),
    updateTime: "2026-09-15 10:30:00",
    createTime: "2026-09-15 10:20:00",
    updaterName: "Platform Admin",
    creatorName: "Platform Admin",
    tags: ["issue-664", "archive"],
    connectorConfig: {
      host: "postgres.internal.example",
      port: 5432,
      database: "issue_664_archive",
      username: "readonly",
      schemas: ["ISSUE180_IV18007_PG17_archive_schema_with_a_long_suffix"],
    },
    metadata: { schemas: ["ISSUE180_IV18007_PG17_archive_schema_with_a_long_suffix"] },
    operations: [...MOCK_CATALOG_OPERATIONS],
    type: "physical",
  },
  {
    id: "cat-007",
    builtin: false,
    name: "ISSUE180_IV18007_PG17_orders_current_20260915",
    description: "用于验收具有相同长前缀的数据目录名称。",
    connectorType: "postgresql",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckResult: "Connection test passed.",
    lastCheckTime: "2026-09-15 10:35:00",
    expectedUpdateTime: Date.parse("2026-09-15T02:35:00Z"),
    updateTime: "2026-09-15 10:35:00",
    createTime: "2026-09-15 10:25:00",
    updaterName: "Platform Admin",
    creatorName: "Platform Admin",
    tags: ["issue-664", "current"],
    connectorConfig: {
      host: "postgres.internal.example",
      port: 5432,
      database: "issue_664_current",
      username: "readonly",
      schemas: ["ISSUE180_IV18007_PG17_current_schema_with_a_long_suffix"],
    },
    metadata: { schemas: ["ISSUE180_IV18007_PG17_current_schema_with_a_long_suffix"] },
    operations: [...MOCK_CATALOG_OPERATIONS],
    type: "physical",
  },
  {
    id: "cat-008",
    builtin: false,
    name: "permission_limited_catalog",
    description: "用于验收只有查看详情权限时的按钮显隐与各功能页权限提示。",
    connectorType: "postgresql",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckResult: "Connection test passed.",
    lastCheckTime: "2026-09-15 11:10:00",
    expectedUpdateTime: Date.parse("2026-09-15T03:10:00Z"),
    updateTime: "2026-09-15 11:10:00",
    createTime: "2026-09-15 11:00:00",
    updaterName: "Permission Demo",
    creatorName: "Permission Demo",
    tags: ["permission-demo", "view-detail-only"],
    connectorConfig: {
      host: "postgres.internal.example",
      port: 5432,
      database: "permission_demo",
      username: "readonly",
      schemas: ["public"],
    },
    metadata: { schemas: ["public"] },
    operations: ["view_detail"],
    type: "physical",
  },
  {
    id: "cat-009",
    builtin: false,
    name: "summary_only_resource_catalog",
    description: "用于验收由 Resource 访问派生的目录摘要导航。",
    connectorType: "postgresql",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckResult: "Connection test passed.",
    lastCheckTime: "2026-09-15 11:15:00",
    expectedUpdateTime: Date.parse("2026-09-15T03:15:00Z"),
    updateTime: "2026-09-15 11:15:00",
    createTime: "2026-09-15 11:05:00",
    updaterName: "Permission Demo",
    creatorName: "Permission Demo",
    tags: ["permission-demo", "view-summary-only"],
    connectorConfig: {
      host: "postgres.internal.example",
      port: 5432,
      database: "permission_demo",
      username: "readonly",
      schemas: ["public"],
    },
    metadata: { schemas: ["public"] },
    operations: ["view_summary"],
    type: "physical",
  },
  {
    id: "adp_bkn_catalog",
    builtin: true,
    name: "adp_bkn_catalog",
    description: "BKN的逻辑命名空间",
    connectorType: "",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckResult: "",
    lastCheckTime: "-",
    expectedUpdateTime: Date.parse("2026-06-02T14:30:00Z"),
    updateTime: "2026-06-02 14:30:00",
    createTime: "2026-05-20 09:00:00",
    updaterName: "Platform Admin",
    creatorName: "Platform Admin",
    tags: ["BKN", "概念索引"],
    connectorConfig: {},
    metadata: { builtin: true },
    operations: ["view_detail"],
    type: "logical",
  },
  {
    id: "cat-005",
    builtin: true,
    name: "openbkn_execution_factory",
    description: "执行工厂内置逻辑 Catalog。",
    connectorType: "",
    category: "table",
    mode: "local",
    enabled: true,
    status: "enabled",
    healthStatus: "healthy",
    healthCheckResult: "",
    lastCheckTime: "-",
    expectedUpdateTime: Date.parse("2026-06-02T14:30:00Z"),
    updateTime: "2026-06-02 14:30:00",
    createTime: "2026-05-20 09:00:00",
    updaterName: "Platform Admin",
    creatorName: "Platform Admin",
    tags: ["system"],
    connectorConfig: {},
    metadata: { builtin: true },
    operations: ["view_detail"],
    type: "logical",
  },
];

function summarySchemas(metadata: Record<string, unknown>) {
  const schemas = metadata.schemas;
  return Array.isArray(schemas)
    ? schemas.filter((schema): schema is string => typeof schema === "string")
    : [];
}

export function getMockCatalogs() {
  return mockCatalogs.map((catalog) => ({
    ...catalog,
    schemas: catalog.schemas ?? summarySchemas(catalog.metadata),
  }));
}

export function prependMockCatalog(record: CatalogRecord) {
  mockCatalogs = [record, ...mockCatalogs];
}

export function updateMockCatalog(
  id: string,
  patch: Partial<CatalogRecord> | ((record: CatalogRecord) => CatalogRecord),
) {
  mockCatalogs = mockCatalogs.map((record) => {
    if (record.id !== id) {
      return record;
    }
    return typeof patch === "function" ? patch(record) : { ...record, ...patch };
  });
}

export function removeMockCatalog(id: string) {
  mockCatalogs = mockCatalogs.filter((record) => record.id !== id);
}

export function findMockCatalog(id: string) {
  return mockCatalogs.find((record) => record.id === id) ?? null;
}
