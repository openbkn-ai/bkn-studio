/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  findMockCatalog,
  getMockCatalogs,
  prependMockCatalog,
  removeMockCatalog,
  updateMockCatalog,
} from "@/shared/catalog/catalog-mock";
import {
  filterCatalogs,
  formatCatalogTimestamp,
  inferConnectorCategory,
  mapBackendCatalog,
  type BackendCatalog,
} from "@/shared/catalog/catalog-mapper";
import type {
  CatalogListQuery,
  CatalogListResult,
  CatalogRecord,
} from "@/shared/catalog/types";

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const wait = async <T,>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

export async function listCatalogs(query: CatalogListQuery): Promise<CatalogListResult> {
  if (useMock) {
    const filtered = filterCatalogs(getMockCatalogs(), query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  const response = await http.get<ListResponse<BackendCatalog>>("/vega-backend/v1/catalogs", {
    params: {
      connector_type: query.connectorType || undefined,
      direction: "desc",
      limit: query.pageSize,
      name: query.keyword.trim() || undefined,
      offset: (query.page - 1) * query.pageSize,
      sort: "update_time",
    },
  });

  const mapped = response.data.entries.map(mapBackendCatalog);
  const filtered = filterCatalogs(mapped, query);
  const usesClientTypeFilter = query.type && query.type !== "all";

  return {
    items: filtered,
    total: usesClientTypeFilter ? filtered.length : response.data.total_count,
  };
}

export async function getCatalog(id: string) {
  if (useMock) {
    return wait(findMockCatalog(id));
  }

  const response = await http.get<{ entries: BackendCatalog[] }>(
    `/vega-backend/v1/catalogs/${id}`,
  );

  const catalog = response.data.entries?.[0];
  return catalog ? mapBackendCatalog(catalog) : null;
}

export async function deleteCatalog(id: string) {
  if (useMock) {
    removeMockCatalog(id);
    await wait(undefined);
    return;
  }

  await http.delete(`/vega-backend/v1/catalogs/${id}`);
}

export async function setCatalogEnabled(id: string, enabled: boolean) {
  if (useMock) {
    updateMockCatalog(id, (record) => ({
      ...record,
      enabled,
      status: enabled ? "enabled" : "disabled",
      updateTime: formatCatalogTimestamp(Date.now()),
      healthStatus: enabled ? record.healthStatus : "unchecked",
    }));
    await wait(undefined);
    return;
  }

  await http.post(`/vega-backend/v1/catalogs/${id}/${enabled ? "enable" : "disable"}`);
}

export async function createLogicalCatalog(input: { description?: string; name: string }) {
  if (useMock) {
    prependMockCatalog({
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description ?? "",
      connectorType: "",
      category: "table",
      mode: "local",
      enabled: true,
      status: "enabled",
      healthStatus: "healthy",
      healthCheckEnabled: false,
      healthCheckResult: "",
      updateTime: formatCatalogTimestamp(Date.now()),
      createTime: formatCatalogTimestamp(Date.now()),
      updaterName: "Local Admin",
      creatorName: "Local Admin",
      tags: [],
      connectorConfig: {},
      metadata: {},
      operations: ["view", "delete"],
      type: "logical",
    });
    await wait(undefined);
    return;
  }

  await http.post("/vega-backend/v1/catalogs", {
    description: input.description ?? "",
    enabled: true,
    name: input.name,
    tags: [],
    type: "logical",
  });
}

export function appendMockPhysicalCatalog(record: CatalogRecord) {
  prependMockCatalog(record);
}

export function updateMockCatalogRecord(
  id: string,
  patch: Partial<CatalogRecord> | ((record: CatalogRecord) => CatalogRecord),
) {
  updateMockCatalog(id, patch);
}

export async function updateCatalog(
  id: string,
  input: {
    connectorConfig: Record<string, unknown>;
    connectorType: string;
    description: string;
    enabled: boolean;
    name: string;
    tags: string[];
  },
) {
  if (useMock) {
    updateMockCatalog(id, (record) => ({
      ...record,
      name: input.name,
      description: input.description,
      tags: input.tags,
      connectorConfig: input.connectorConfig,
      updateTime: formatCatalogTimestamp(Date.now()),
    }));
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

export async function createPhysicalCatalog(input: {
  connectorConfig: Record<string, unknown>;
  connectorType: string;
  description: string;
  enabled: boolean;
  name: string;
  tags: string[];
  category?: string;
  mode?: string;
}) {
  if (useMock) {
    prependMockCatalog({
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      connectorType: input.connectorType,
      category: input.category ?? inferConnectorCategory(input.connectorType),
      mode: input.mode ?? "local",
      enabled: input.enabled,
      status: input.enabled ? "enabled" : "disabled",
      healthStatus: "unchecked",
      healthCheckEnabled: true,
      healthCheckResult: "",
      updateTime: formatCatalogTimestamp(Date.now()),
      createTime: formatCatalogTimestamp(Date.now()),
      updaterName: "Local Admin",
      creatorName: "Local Admin",
      tags: input.tags,
      connectorConfig: input.connectorConfig,
      metadata: {},
      operations: ["view", "edit", "delete", "test_connection", "enable", "disable"],
      type: "physical",
    });
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

export async function testCatalogConnection(id: string) {
  if (useMock) {
    await wait(undefined);
    return;
  }

  await http.post(`/vega-backend/v1/catalogs/${id}/test-connection`);
}
