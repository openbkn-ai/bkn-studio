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

export function formatCatalogTimestamp(value?: number) {
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

export function inferConnectorCategory(connectorType: string) {
  if (connectorType === "opensearch") {
    return "index";
  }

  if (connectorType === "anyshare") {
    return "fileset";
  }

  return "table";
}

export function mapBackendCatalog(item: BackendCatalog): CatalogRecord {
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
    updateTime: formatCatalogTimestamp(item.update_time),
    createTime: formatCatalogTimestamp(item.create_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    tags: item.tags ?? [],
    connectorConfig: item.connector_config ?? {},
    metadata: item.metadata ?? {},
    operations: item.operations ?? [],
    type: item.type ?? "physical",
  };
}

function matchesCatalogType(item: CatalogRecord, type: CatalogListQuery["type"]) {
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

export type { BackendCatalog };
