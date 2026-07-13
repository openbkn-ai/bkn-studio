/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogRecord } from "@/shared/catalog/types";

let mockCatalogs: CatalogRecord[] = [
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
      host: "127.0.0.1",
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
      host: "127.0.0.1",
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
    name: "adp_bkn_catalog",
    description: "平台内置逻辑 Catalog。",
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
    metadata: { builtin: true },
    operations: ["view"],
    type: "logical",
  },
  {
    id: "cat-005",
    name: "openbkn_execution_factory",
    description: "执行工厂内置逻辑 Catalog。",
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
    tags: ["system"],
    connectorConfig: {},
    metadata: { builtin: true },
    operations: ["view"],
    type: "logical",
  },
];

export function getMockCatalogs() {
  return mockCatalogs;
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
