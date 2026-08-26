/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  CatalogHealthStatus,
  CatalogListQuery,
  CatalogRecord,
} from "@/shared/catalog/types";

type BackendAccountInfo = {
  id?: string | null;
  name?: string | null;
};

export type BackendCatalogSummary = {
  connector_type: string;
  create_time?: number;
  creator?: BackendAccountInfo;
  description?: string;
  enabled: boolean;
  health_check_result?: string;
  health_check_status?: string;
  id: string;
  internal?: boolean;
  last_check_time?: number;
  name: string;
  operations?: string[];
  tags?: string[];
  type?: string;
  update_time?: number;
  updater?: BackendAccountInfo;
};

export type BackendCatalog = BackendCatalogSummary & {
  connector_config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

function normalizeHealthStatus(value?: string): CatalogHealthStatus {
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

function normalizeCatalogTimestamp(value?: number) {
  return value || null;
}

export function inferConnectorCategory(connectorType: string) {
  if (connectorType === "opensearch") {
    return "index";
  }

  if (connectorType === "anyshare") {
    return "fileset";
  }

  return "table";
}

function mapCatalogRecord(
  item: BackendCatalogSummary,
  connectorConfig: Record<string, unknown>,
  metadata: Record<string, unknown>,
): CatalogRecord {
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
    internal: item.internal ?? false,
    healthCheckResult: item.health_check_result ?? "",
    lastCheckTime: normalizeCatalogTimestamp(item.last_check_time),
    expectedUpdateTime: item.update_time ?? 0,
    updateTime: normalizeCatalogTimestamp(item.update_time),
    createTime: normalizeCatalogTimestamp(item.create_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    tags: item.tags ?? [],
    connectorConfig,
    metadata,
    operations: item.operations ?? [],
    type: item.type ?? "physical",
  };
}

export function mapBackendCatalogSummary(item: BackendCatalogSummary): CatalogRecord {
  return mapCatalogRecord(item, {}, {});
}

export function mapBackendCatalog(item: BackendCatalog): CatalogRecord {
  return mapCatalogRecord(item, item.connector_config ?? {}, item.metadata ?? {});
}

export function matchesCatalogType(item: CatalogRecord, type: CatalogListQuery["type"]) {
  const catalogType = item.type || "physical";
  if (!type || type === "physical") {
    return catalogType === "physical";
  }
  if (type === "logical") {
    return catalogType === "logical";
  }
  return true;
}

export function filterCatalogs(items: CatalogRecord[], query: CatalogListQuery) {
  const keyword = query.keyword.trim().toLowerCase();

  return items.filter((item) => {
    const matchesType = matchesCatalogType(item, query.type);
    const matchesKeyword =
      keyword.length === 0 ||
      item.name.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword);
    const matchesConnectorType =
      !query.connectorType || item.connectorType === query.connectorType;

    return matchesType && matchesKeyword && matchesConnectorType;
  });
}
