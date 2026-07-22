/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { postCatalogDiscover } from "@/shared/catalog";
import {
  emitMockChange,
  formatMockTimestamp,
  mockBuildTasks,
  mockResources,
  mockScanRecords,
  mockScanningCatalogs,
  mockSlug,
  mockStartScan,
} from "@/modules/data-catalog/services/mock-db";
import type {
  CatalogResource,
  CatalogScanRecord,
  ResourceCategory,
  ResourceCreateInput,
  ResourceFieldFeature,
  ResourceFeatureType,
  ResourceIndexConfig,
  ResourceListQuery,
  ResourcePreviewQuery,
  ResourcePreviewResult,
  ResourceSchemaField,
  ResourceUpdateInput,
} from "@/modules/data-catalog/types/data-catalog";

type BackendFieldFeature = {
  config?: Record<string, unknown>;
  description?: string;
  display_name?: string;
  feature_type?: string;
  is_default?: boolean;
  is_native?: boolean;
  name?: string;
  ref_property?: string;
  type?: string;
};

type BackendSchemaField = {
  attributes?: Record<string, unknown> | null;
  description?: string;
  display_name?: string;
  extensions?: Record<string, string>;
  features?: BackendFieldFeature[] | null;
  name?: string;
  original_description?: string;
  original_name?: string;
  original_type?: string;
  type?: string;
};

type BackendIndexConfig = {
  build_key_fields?: string[];
  default_embedding_model?: string;
  default_fulltext_analyzer?: string;
};

function isResourceFeatureType(value: string | undefined): value is ResourceFeatureType {
  return value === "keyword" || value === "fulltext" || value === "vector";
}

function mapFeatureToBackend(feature: ResourceFieldFeature): BackendFieldFeature {
  return {
    name: feature.name,
    display_name: feature.displayName,
    feature_type: feature.featureType,
    description: feature.description,
    ref_property: feature.refProperty,
    is_default: feature.isDefault,
    is_native: feature.isNative,
    config: feature.config,
  };
}

function mapFeatureFromBackend(feature: BackendFieldFeature): ResourceFieldFeature | null {
  const featureType = feature.feature_type ?? feature.type;
  if (!isResourceFeatureType(featureType)) {
    return null;
  }

  return {
    name: feature.name,
    displayName: feature.display_name,
    featureType,
    description: feature.description,
    refProperty: feature.ref_property,
    isDefault: feature.is_default,
    isNative: feature.is_native,
    config: feature.config,
  };
}

function mapIndexConfigToBackend(
  config?: ResourceIndexConfig,
): BackendIndexConfig | undefined {
  if (!config) {
    return undefined;
  }

  return {
    build_key_fields: config.buildKeyFields,
    default_fulltext_analyzer: config.defaultFulltextAnalyzer,
    default_embedding_model: config.defaultEmbeddingModel,
  };
}

function mapIndexConfigFromBackend(
  config?: BackendIndexConfig | null,
): ResourceIndexConfig | undefined {
  if (!config) {
    return undefined;
  }

  return {
    buildKeyFields: config.build_key_fields,
    defaultFulltextAnalyzer: config.default_fulltext_analyzer,
    defaultEmbeddingModel: config.default_embedding_model,
  };
}

function mapSchemaFieldToBackend(field: ResourceSchemaField): BackendSchemaField {
  const displayName = field.displayName?.trim() || field.name;
  const description = field.description?.trim() || "";

  return {
    description,
    display_name: displayName,
    name: field.name,
    original_name: field.name,
    type: field.type,
    features: field.features?.map(mapFeatureToBackend),
  };
}

function mapSchemaFieldUpdateToBackend(field: ResourceSchemaField): BackendSchemaField {
  const displayName = field.displayName?.trim() || field.name;
  const description = field.description?.trim() || "";
  const base = field.raw
    ? { ...field.raw }
    : ({
        attributes: field.attributes,
        extensions: field.extensions,
        name: field.name,
        original_description: field.originalDescription ?? "",
        original_name: field.originalName ?? "",
        original_type: field.originalType ?? "",
        type: field.type,
      } satisfies BackendSchemaField);

  return {
    ...base,
    description,
    display_name: displayName,
    features: field.features?.map(mapFeatureToBackend) ?? [],
  };
}

function mapSchemaField(field: BackendSchemaField): ResourceSchemaField {
  const name = field.name ?? field.original_name ?? field.display_name ?? "";
  const displayName = field.display_name?.trim();
  const description = field.description?.trim();
  const features = (field.features ?? [])
    .map(mapFeatureFromBackend)
    .filter((item): item is ResourceFieldFeature => item !== null);

  return {
    attributes: field.attributes,
    name,
    type: field.type ?? field.original_type ?? "string",
    displayName:
      displayName && displayName !== name ? displayName : undefined,
    description: description || undefined,
    extensions: field.extensions,
    features: features.length > 0 ? features : undefined,
    originalDescription: field.original_description,
    originalName: field.original_name,
    originalType: field.original_type,
    raw: { ...field },
  };
}

type BackendResource = {
  catalog_id: string;
  category?: string;
  column_count?: number;
  description?: string;
  id: string;
  index_config?: BackendIndexConfig | null;
  logic_type?: string;
  name: string;
  row_count?: number;
  schema_definition?: BackendSchemaField[] | null;
  source_identifier?: string;
  source_metadata?: {
    properties?: {
      row_count?: number;
    };
  } | null;
  update_time?: number;
};

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const RESOURCE_LIST_PAGE_SIZE = 500;

const wait = async <T,>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }
  return formatMockTimestamp(value);
}

function normalizeCategory(value?: string, logicType?: string): ResourceCategory {
  if (value === "logicview" || value === "dataset") {
    return value;
  }
  if (logicType) {
    return "logicview";
  }
  return "table";
}

function mapResource(item: BackendResource): CatalogResource {
  return {
    id: item.id,
    catalogId: item.catalog_id,
    name: item.name,
    category: normalizeCategory(item.category, item.logic_type),
    sourceIdentifier: item.source_identifier ?? "",
    description: item.description ?? "",
    schema: (item.schema_definition ?? []).map(mapSchemaField),
    indexConfig: mapIndexConfigFromBackend(item.index_config),
    // 列表接口不返回 schema_definition,改用后端标量 column_count;详情接口回退到 schema 长度
    columnCount: item.column_count ?? item.schema_definition?.length ?? 0,
    // 顶层 row_count 后端常缺省,实际行数在 source_metadata.properties 里
    rowCount: item.row_count ?? item.source_metadata?.properties?.row_count ?? 0,
    updatedAt: item.update_time ?? 0,
    updateTime: formatTimestamp(item.update_time),
  };
}

function filterResources(items: CatalogResource[], query: ResourceListQuery) {
  const keyword = (query.keyword ?? "").trim().toLowerCase();

  return items.filter((item) => {
    const matchesKeyword =
      keyword.length === 0 ||
      item.name.toLowerCase().includes(keyword) ||
      item.sourceIdentifier.toLowerCase().includes(keyword) ||
      item.id.toLowerCase().includes(keyword);
    const matchesCatalog = !query.catalogId || item.catalogId === query.catalogId;
    const matchesCategory = !query.category || item.category === query.category;
    const matchesDatabase =
      !query.database ||
      item.sourceIdentifier === query.database ||
      item.sourceIdentifier.startsWith(`${query.database}.`);

    return matchesKeyword && matchesCatalog && matchesCategory && matchesDatabase;
  });
}

export type CatalogResourcePage = {
  items: CatalogResource[];
  total: number;
};

export async function listCatalogResourcePage(
  query: ResourceListQuery = {},
): Promise<CatalogResourcePage> {
  const offset = Math.max(0, query.offset ?? 0);
  const limit = query.limit ?? RESOURCE_LIST_PAGE_SIZE;

  if (useMock) {
    const filtered = filterResources([...mockResources], query);
    return wait({
      items: limit === -1 ? filtered.slice(offset) : filtered.slice(offset, offset + limit),
      total: filtered.length,
    });
  }

  const response = await http.get<ListResponse<BackendResource>>(
    "/vega-backend/v1/resources",
    {
      params: {
        catalog_id: query.catalogId || undefined,
        category: query.category || undefined,
        database: query.database || undefined,
        limit,
        name: query.keyword?.trim() || undefined,
        offset,
      },
    },
  );

  return {
    items: response.data.entries.map(mapResource),
    total: response.data.total_count,
  };
}

export async function listCatalogResources(
  query: ResourceListQuery = {},
): Promise<CatalogResource[]> {
  if (query.limit !== undefined || query.offset !== undefined) {
    return (await listCatalogResourcePage(query)).items;
  }

  const resources: CatalogResource[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (resources.length < total) {
    const page = await listCatalogResourcePage({
      ...query,
      limit: RESOURCE_LIST_PAGE_SIZE,
      offset,
    });
    resources.push(...page.items);
    total = page.total;

    if (page.items.length === 0 || page.items.length < RESOURCE_LIST_PAGE_SIZE) {
      break;
    }
    offset += page.items.length;
  }

  return resources;
}

export async function countCatalogResources(
  query: ResourceListQuery = {},
): Promise<number> {
  return (await listCatalogResourcePage({ ...query, limit: 1, offset: 0 })).total;
}

export async function getCatalogResource(id: string) {
  const [resource] = await getCatalogResources([id]);
  return resource ?? null;
}

export async function getCatalogResources(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return [];
  }

  if (useMock) {
    const byId = new Map(mockResources.map((item) => [item.id, item]));
    return wait(uniqueIds.map((id) => byId.get(id)).filter(Boolean) as CatalogResource[]);
  }

  const resources: CatalogResource[] = [];
  for (let index = 0; index < uniqueIds.length; index += 50) {
    const chunk = uniqueIds.slice(index, index + 50);
    const response = await http.get<{ entries?: BackendResource[] }>(
      `/vega-backend/v1/resources/${chunk.join(",")}`,
      { skipErrorToast: true },
    );
    resources.push(...(response.data.entries ?? []).map(mapResource));
  }

  return resources;
}

export async function createCatalogResource(input: ResourceCreateInput) {
  if (useMock) {
    const resource: CatalogResource = {
      id: `res-${mockSlug(10)}`,
      catalogId: input.catalogId,
      name: input.name,
      category: input.category,
      sourceIdentifier: input.sourceIdentifier,
      description: input.description,
      schema:
        input.schema.length > 0
          ? input.schema
          : [
              { name: "id", type: "bigint" },
              { name: "name", type: "varchar(128)" },
              { name: "updated_at", type: "datetime" },
            ],
      columnCount: input.schema.length > 0 ? input.schema.length : 3,
      rowCount: 0,
      updatedAt: Date.now(),
      updateTime: formatMockTimestamp(Date.now()),
    };
    mockResources.unshift(resource);
    emitMockChange();
    return wait(resource);
  }

  const response = await http.post<{ id?: string } & BackendResource>(
    "/vega-backend/v1/resources",
    {
      catalog_id: input.catalogId,
      category: input.category,
      description: input.description,
      name: input.name,
      schema_definition:
        input.schema.length > 0 ? input.schema.map(mapSchemaFieldToBackend) : undefined,
      index_config: mapIndexConfigToBackend(input.indexConfig),
      source_identifier: input.sourceIdentifier,
    },
  );

  const created = response.data.id ? await getCatalogResource(response.data.id) : null;
  return (
    created ?? {
      id: response.data.id ?? "",
      catalogId: input.catalogId,
      name: input.name,
      category: input.category,
      sourceIdentifier: input.sourceIdentifier,
      description: input.description,
      schema: input.schema,
      columnCount: input.schema.length,
      rowCount: 0,
      updatedAt: Date.now(),
      updateTime: formatMockTimestamp(Date.now()),
    }
  );
}

export async function updateCatalogResource(
  id: string,
  input: ResourceUpdateInput,
) {
  if (useMock) {
    const index = mockResources.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error("Resource not found");
    }

    const current = mockResources[index];
    const updatedAt = Date.now();
    const nextResource: CatalogResource = {
      ...current,
      catalogId: input.catalogId,
      category: input.category,
      description: input.description,
      name: input.name,
      schema: input.schema,
      indexConfig: input.indexConfig ?? current.indexConfig,
      sourceIdentifier: input.sourceIdentifier,
      columnCount: input.schema.length,
      updatedAt,
      updateTime: formatMockTimestamp(updatedAt),
    };

    mockResources[index] = nextResource;
    emitMockChange();
    return wait(nextResource);
  }

  await http.put(`/vega-backend/v1/resources/${id}`, {
    catalog_id: input.catalogId,
    category: input.category,
    description: input.description,
    name: input.name,
    schema_definition: input.schema.map(mapSchemaFieldUpdateToBackend),
    index_config: mapIndexConfigToBackend(input.indexConfig),
    source_identifier: input.sourceIdentifier,
  });

  return getCatalogResource(id);
}

export async function deleteCatalogResource(id: string) {
  if (useMock) {
    const index = mockResources.findIndex((item) => item.id === id);
    if (index >= 0) {
      mockResources.splice(index, 1);
    }
    for (let cursor = mockBuildTasks.length - 1; cursor >= 0; cursor -= 1) {
      if (mockBuildTasks[cursor].resourceId === id) {
        mockBuildTasks.splice(cursor, 1);
      }
    }
    emitMockChange();
    await wait(undefined);
    return;
  }

  await http.delete(`/vega-backend/v1/resources/${id}`);
}

const PREVIEW_CELL_POOL: Record<string, (row: number) => unknown> = {
  bigint: (row) => 100000 + row * 7,
  decimal: (row) => ((row * 137) % 9000) + Math.round(row * 0.37 * 100) / 100,
  datetime: (row) =>
    formatMockTimestamp(Date.now() - row * 3_600_000).slice(0, 16),
  text: (row) =>
    row % 7 === 0
      ? null
      : `这是第 ${row + 1} 行的长文本内容,用于验证截断与悬停展示。`,
  varchar: (row) => `value_${row + 1}`,
};

function mockCell(field: ResourceSchemaField, row: number) {
  const type = field.type.toLowerCase();
  if (type.startsWith("bigint") || type.startsWith("int")) {
    return PREVIEW_CELL_POOL.bigint(row);
  }
  if (type.startsWith("decimal") || type.startsWith("numeric")) {
    return PREVIEW_CELL_POOL.decimal(row);
  }
  if (type.startsWith("datetime") || type.startsWith("timestamp")) {
    return PREVIEW_CELL_POOL.datetime(row);
  }
  if (type === "text") {
    return PREVIEW_CELL_POOL.text(row);
  }
  return PREVIEW_CELL_POOL.varchar(row);
}

export async function previewCatalogResource(
  id: string,
  query: ResourcePreviewQuery,
): Promise<ResourcePreviewResult> {
  if (useMock) {
    const resource = mockResources.find((item) => item.id === id);
    if (!resource) {
      return wait({ rows: [], total: 0 });
    }

    const total = resource.rowCount;
    const count = Math.max(0, Math.min(query.limit, total - query.offset));
    const rows = Array.from({ length: count }, (_, index) => {
      const rowIndex = query.offset + index;
      return Object.fromEntries(
        resource.schema.map((field) => [field.name, mockCell(field, rowIndex)]),
      );
    });

    return wait({ rows, total }, 260);
  }

  // POST /resources/:id/data + X-HTTP-Method-Override: GET = 数据查询
  const response = await http.post<{
    entries?: Record<string, unknown>[];
    total_count?: number;
  }>(
    `/vega-backend/v1/resources/${id}/data`,
    {
      need_total: true,
      paging: {
        limit: query.limit,
        mode: "single",
        offset: query.offset,
      },
    },
    { headers: { "X-HTTP-Method-Override": "GET" } },
  );

  return {
    rows: response.data.entries ?? [],
    total: response.data.total_count ?? 0,
  };
}

/* ---------------- 扫描(discover) ---------------- */

type BackendDiscoverTask = {
  create_time?: number;
  finish_time?: number;
  id: string;
  result?: {
    new_count?: number;
    restored_count?: number;
    stale_count?: number;
    unchanged_count?: number;
    updated_count?: number;
  } | null;
  start_time?: number;
  status?: string;
  trigger_type?: string;
};

export function isCatalogScanning(catalogId: string) {
  return mockScanningCatalogs.has(catalogId);
}

export async function listCatalogScans(
  catalogId: string,
): Promise<CatalogScanRecord[]> {
  if (useMock) {
    return wait([...(mockScanRecords.get(catalogId) ?? [])]);
  }

  const response = await http.get<ListResponse<BackendDiscoverTask>>(
    "/vega-backend/v1/discover-tasks",
    {
      params: { catalog_id: catalogId, limit: 6, offset: 0 },
    },
  );

  return response.data.entries.map((item) => {
    const startedAt = item.start_time ?? item.create_time ?? 0;
    // 后端枚举:pending/running/completed/failed
    const status: CatalogScanRecord["status"] =
      item.status === "running" || item.status === "pending"
        ? "running"
        : item.status === "failed"
          ? "failed"
          : "succeeded";
    const result = item.result;
    const foundResources = result
      ? (result.new_count ?? 0) +
        (result.unchanged_count ?? 0) +
        (result.updated_count ?? 0) +
        (result.restored_count ?? 0)
      : null;

    return {
      id: item.id,
      status,
      trigger: item.trigger_type === "scheduled" ? "scheduled" : "manual",
      startedAt,
      startTime: formatTimestamp(startedAt),
      durationSec:
        item.finish_time && startedAt
          ? Math.max(0, Math.round((item.finish_time - startedAt) / 1000))
          : null,
      foundResources,
      newResources: result?.new_count ?? null,
    };
  });
}

export async function triggerCatalogScan(catalogId: string) {
  if (useMock) {
    mockStartScan(catalogId);
    await wait(undefined, 120);
    return;
  }

  await postCatalogDiscover(catalogId, { wait: false });
}
