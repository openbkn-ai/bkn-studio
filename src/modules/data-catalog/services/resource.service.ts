/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  throwMockRequestError,
  validateMockExpectedUpdateTime,
} from "@/framework/request/mock-error";
import {
  parsePrecisionSafeJSON,
  transformPrecisionSafeJSONRequest,
  transformPrecisionSafeJSONResponse,
} from "@/framework/request/precision-safe-json";
import JSONBig from "json-bigint";
import i18n from "@/app/locales/i18n";
import { postCatalogDiscover } from "@/shared/catalog";
import { resourceCountForPagination } from "@/modules/data-catalog/lib/resource-count";
import { parseFilterCondition } from "@/modules/data-catalog/lib/filter-tree";
import {
  emitMockChange,
  formatMockTimestamp,
  mockBuildTasks,
  mockResources,
  mockDiscoverRecords,
  mockDiscoveringCatalogs,
  mockSlug,
  mockStartScan,
} from "@/modules/data-catalog/services/mock-db";
import type {
  CatalogResource,
  CatalogDiscoverRecord,
  DerivedLogicDefinition,
  DerivedViewInput,
  DerivedViewUpdateInput,
  ResourceCategory,
  ResourceCreateInput,
  ResourceDiscoverStatus,
  ResourceFieldFeature,
  ResourceFeatureType,
  ResourceIndexConfig,
  ResourceListQuery,
  ResourcePreviewQuery,
  ResourcePreviewResult,
  ResourceSchemaField,
  ResourceSourceMetadata,
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
  features?: BackendFieldFeature[] | null;
  name?: string;
  original_description?: string;
  original_name?: string;
  original_type?: string;
  type?: string;
};

type BackendIndexConfig = {
  default_keyword_ignore_above?: number;
  incremental_fields?: string[];
  primary_key_fields?: string[];
  default_embedding_model?: string;
  default_fulltext_analyzer?: string;
};

function isResourceFeatureType(value: string | undefined): value is ResourceFeatureType {
  return value === "keyword" || value === "fulltext" || value === "vector";
}

function mapFeatureToBackend(
  feature: ResourceFieldFeature,
  propertyName: string,
): BackendFieldFeature {
  return {
    name: feature.name,
    display_name: feature.displayName,
    feature_type: feature.featureType,
    description: feature.description,
    ...(feature.refProperty && feature.refProperty !== propertyName
      ? { ref_property: feature.refProperty }
      : {}),
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

function mapIndexConfigToBackend(config?: ResourceIndexConfig): BackendIndexConfig | undefined {
  if (!config) {
    return undefined;
  }

  return {
    ...(config.defaultKeywordIgnoreAbove !== undefined
      ? { default_keyword_ignore_above: config.defaultKeywordIgnoreAbove }
      : {}),
    ...(config.incrementalFields !== undefined
      ? { incremental_fields: config.incrementalFields }
      : {}),
    ...(config.primaryKeyFields !== undefined
      ? { primary_key_fields: config.primaryKeyFields }
      : {}),
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
    ...(config.default_keyword_ignore_above !== undefined
      ? { defaultKeywordIgnoreAbove: config.default_keyword_ignore_above }
      : {}),
    incrementalFields: config.incremental_fields,
    primaryKeyFields: config.primary_key_fields,
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
    features: field.features?.map((feature) => mapFeatureToBackend(feature, field.name)),
  };
}

function mapSchemaFieldUpdateToBackend(field: ResourceSchemaField): BackendSchemaField {
  const displayName = field.displayName?.trim() || field.name;
  const description = field.description?.trim() || "";
  const base = field.raw
    ? { ...field.raw }
    : ({
        attributes: field.attributes,
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
    features: field.features?.map((feature) => mapFeatureToBackend(feature, field.name)) ?? [],
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
    displayName: displayName && displayName !== name ? displayName : undefined,
    description: description || undefined,
    features: features.length > 0 ? features : undefined,
    originalDescription: field.original_description,
    originalName: field.original_name,
    originalType: field.original_type,
    raw: { ...field },
  };
}

type BackendResourceSummary = {
  catalog_id: string;
  category?: string;
  create_time?: number;
  creator?: { id?: string; name?: string };
  description?: string;
  enabled?: boolean;
  id: string;
  last_discover_status?: string;
  index_name?: string;
  local_status?: string;
  logic_type?: string;
  name: string;
  operations?: string[];
  schema?: string;
  source_identifier?: string;
  status?: string;
  status_message?: string;
  tags?: string[];
  update_time?: number;
  updater?: { id?: string; name?: string };
};

type BackendResourceDetailFields = {
  column_count?: number;
  index_config?: BackendIndexConfig | null;
  row_count?: number | string;
  estimated_row_count?: number | string;
  schema_definition?: BackendSchemaField[] | null;
  logic_definition?: {
    source_resource_id?: string;
    filter_condition?: Record<string, unknown> | null;
  } | null;
  source_metadata?: {
    foreign_keys?: unknown[];
    indices?: unknown[];
    original_description?: string;
    original_name?: string;
    primary_keys?: string[];
    source_resource?: {
      category?: string;
      original_name?: string;
      table_type?: string;
    };
    table_type?: string;
  } | null;
};

type BackendResource = BackendResourceSummary & BackendResourceDetailFields;

function transformResourceDetailResponse(data: unknown): unknown {
  const response = transformPrecisionSafeJSONResponse(data);
  if (typeof data !== "string" || !response || typeof response !== "object") return response;

  const safeEntries = (response as { entries?: BackendResource[] }).entries;
  if (
    !safeEntries?.some(
      (entry) =>
        entry.logic_definition?.filter_condition &&
        parseFilterCondition(entry.logic_definition.filter_condition) === null,
    )
  ) {
    return response;
  }

  // The display parser turns unsafe JSON numbers into strings. For an unsupported
  // filter, retain the original numeric types so a complete PUT can preserve it.
  const preciseEntries = (JSONBig().parse(data) as { entries?: BackendResource[] }).entries;
  safeEntries.forEach((entry, index) => {
    const condition = entry.logic_definition?.filter_condition;
    if (!condition || parseFilterCondition(condition) !== null) return;
    const preciseCondition = preciseEntries?.[index]?.logic_definition?.filter_condition;
    if (!preciseCondition || !entry.logic_definition) return;
    entry.logic_definition.filter_condition = preciseCondition;
  });
  return response;
}

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const RESOURCE_LIST_PAGE_SIZE = 500;

const wait = async <T>(value: T, delay = 180) =>
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
  if (value === "logicview" || value === "dataset" || value === "index") {
    return value;
  }
  if (logicType) {
    return "logicview";
  }
  return "table";
}

function normalizeDiscoverStatus(value?: string): ResourceDiscoverStatus | undefined {
  switch (value) {
    case "error":
    case "missing":
    case "new":
    case "restored":
    case "unchanged":
    case "updated":
      return value;
    default:
      return undefined;
  }
}

function normalizeResourceStatus(value?: string): CatalogResource["status"] {
  switch (value) {
    case "active":
    case "deprecated":
    case "stale":
      return value;
    default:
      return undefined;
  }
}

function normalizeLocalIndexStatus(value?: string): CatalogResource["localIndexStatus"] {
  switch (value) {
    case "available":
    case "stale":
    case "unavailable":
      return value;
    default:
      return "unavailable";
  }
}

function mapSourceMetadata(
  metadata?: BackendResourceDetailFields["source_metadata"],
): ResourceSourceMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const source = metadata.source_resource;
  const sourceCategory =
    source?.category === "table" || source?.category === "index" ? source.category : undefined;

  return {
    foreignKeyCount: metadata.foreign_keys?.length,
    indexCount: metadata.indices?.length,
    objectType:
      source?.table_type?.trim() || sourceCategory || metadata.table_type?.trim() || undefined,
    originalDescription: metadata.original_description?.trim() || undefined,
    originalName: source?.original_name?.trim() || metadata.original_name?.trim() || undefined,
    primaryKeys: metadata.primary_keys?.map((key) => key.trim()).filter(Boolean),
  };
}

function mapResource(
  item: BackendResourceSummary & Partial<BackendResourceDetailFields>,
): CatalogResource {
  return {
    id: item.id,
    catalogId: item.catalog_id,
    name: item.name,
    operations: item.operations,
    tags: item.tags ?? [],
    category: normalizeCategory(item.category, item.logic_type),
    sourceIdentifier: item.source_identifier ?? "",
    description: item.description ?? "",
    enabled: item.enabled ?? true,
    schema: (item.schema_definition ?? []).map(mapSchemaField),
    indexConfig: mapIndexConfigFromBackend(item.index_config),
    lastDiscoverStatus: normalizeDiscoverStatus(item.last_discover_status),
    localIndexName: item.index_name?.trim() || undefined,
    localIndexStatus: normalizeLocalIndexStatus(item.local_status),
    logicType:
      item.logic_type === "derived" || item.logic_type === "composite"
        ? item.logic_type
        : undefined,
    logicDefinition: item.logic_definition?.source_resource_id
      ? {
          sourceResourceId: item.logic_definition.source_resource_id,
          filterCondition: item.logic_definition.filter_condition,
        }
      : undefined,
    sourceMetadata: mapSourceMetadata(item.source_metadata),
    // Scale fields and schema_definition are detail-only; list resources map them to null and an empty schema.
    columnCount: item.column_count ?? item.schema_definition?.length ?? null,
    rowCount: item.row_count ?? null,
    estimatedRowCount: item.estimated_row_count ?? null,
    schemaName: item.schema,
    status: normalizeResourceStatus(item.status),
    statusMessage: item.status_message?.trim() || undefined,
    expectedUpdateTime: item.update_time ?? 0,
    createTime: item.create_time ? formatTimestamp(item.create_time) : undefined,
    creatorName: item.creator?.name ?? item.creator?.id,
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id,
  };
}

function mapDerivedViewSchema(field: ResourceSchemaField): BackendSchemaField {
  return {
    name: field.name,
    original_name: field.originalName,
    type: field.type,
    display_name: field.displayName?.trim(),
    ...(field.features === undefined
      ? {}
      : {
          features: field.features.map((feature) =>
            mapFeatureToBackend(feature, field.originalName ?? field.name),
          ),
        }),
  };
}

function mapDerivedDefinition(
  sourceResourceId: string,
  filterCondition?: DerivedLogicDefinition["filterCondition"],
) {
  return {
    source_resource_id: sourceResourceId,
    ...(filterCondition == null ? {} : { filter_condition: filterCondition }),
  };
}

function mockResponseFilterCondition(condition?: Record<string, unknown> | null) {
  if (condition == null) return condition;
  return parsePrecisionSafeJSON(transformPrecisionSafeJSONRequest(condition)) as Record<
    string,
    unknown
  >;
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
    const matchesStatus = !query.status || item.status === query.status;
    const matchesEnabled =
      query.enabled === undefined || (item.enabled !== false) === query.enabled;
    const matchesDiscoverStatus =
      !query.lastDiscoverStatus || item.lastDiscoverStatus === query.lastDiscoverStatus;
    const matchesSchema = !query.schema || item.schemaName === query.schema;

    return (
      matchesKeyword &&
      matchesCatalog &&
      matchesCategory &&
      matchesStatus &&
      matchesEnabled &&
      matchesDiscoverStatus &&
      matchesSchema
    );
  });
}

function sortResources(items: CatalogResource[], query: ResourceListQuery) {
  if (query.sort !== "name") {
    return items;
  }

  const multiplier = query.direction === "desc" ? -1 : 1;
  return [...items].sort((left, right) => left.name.localeCompare(right.name) * multiplier);
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
    const filtered = sortResources(filterResources([...mockResources], query), query);
    const page = limit === -1 ? filtered.slice(offset) : filtered.slice(offset, offset + limit);
    return wait({
      items: page.map((resource) => ({
        ...resource,
        columnCount: null,
        indexConfig: undefined,
        rowCount: null,
        schema: [],
        sourceMetadata: undefined,
      })),
      total: filtered.length,
    });
  }

  const response = await http.get<ListResponse<BackendResourceSummary>>(
    "/vega-backend/v1/resources",
    {
      params: {
        catalog_id: query.catalogId || undefined,
        category: query.category || undefined,
        direction: query.direction,
        enabled: query.enabled,
        last_discover_status: query.lastDiscoverStatus,
        schema: query.schema || undefined,
        limit,
        name: query.keyword?.trim() || undefined,
        offset,
        sort: query.sort,
        status: query.status,
      },
    },
  );

  return {
    items: response.data.entries.map(mapResource),
    total: response.data.total_count,
  };
}

export async function countCatalogResources(query: ResourceListQuery = {}): Promise<number> {
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
      {
        skipErrorToast: true,
        transformResponse: transformResourceDetailResponse,
      },
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
      enabled: true,
      localIndexStatus: "unavailable",
      operations: ["view_detail", "query_data", "delete"],
      schema:
        input.schema.length > 0
          ? input.schema
          : [
              { name: "id", type: "bigint" },
              { name: "name", type: "varchar(128)" },
              { name: "updated_at", type: "datetime" },
            ],
      columnCount: input.schema.length > 0 ? input.schema.length : 3,
      rowCount: input.category === "dataset" ? 0 : null,
      expectedUpdateTime: Date.now(),
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
      enabled: true,
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
      enabled: true,
      localIndexStatus: "unavailable",
      operations: response.data.operations,
      schema: input.schema,
      columnCount: input.schema.length,
      rowCount: input.category === "dataset" ? 0 : null,
      expectedUpdateTime: Date.now(),
      updateTime: formatMockTimestamp(Date.now()),
    }
  );
}

export async function updateCatalogResource(id: string, input: ResourceUpdateInput) {
  if (useMock) {
    const index = mockResources.findIndex((item) => item.id === id);
    if (index < 0) {
      throwMockRequestError(404, "VegaBackend.Resource.NotFound", "Resource not found.");
    }

    const current = mockResources[index];
    if (current.category !== input.category) {
      throwMockRequestError(
        400,
        "VegaBackend.InvalidParameter.RequestBody",
        "Resource catalog and category cannot be changed.",
      );
    }
    validateMockExpectedUpdateTime(input.expectedUpdateTime);
    if (current.catalogId !== input.catalogId) {
      throwMockRequestError(
        400,
        "VegaBackend.InvalidParameter.RequestBody",
        "Resource catalog and category cannot be changed.",
      );
    }
    if (current.expectedUpdateTime !== input.expectedUpdateTime) {
      throwMockRequestError(
        409,
        "VegaBackend.Resource.UpdateConflict",
        "Resource has been updated. Reload it and try again.",
      );
    }
    const expectedUpdateTime = Date.now();
    const nextResource: CatalogResource = {
      ...current,
      description: input.description,
      name: input.name,
      schema: input.schema,
      indexConfig: input.indexConfig ?? current.indexConfig,
      columnCount: input.schema.length,
      expectedUpdateTime,
      updateTime: formatMockTimestamp(expectedUpdateTime),
    };

    mockResources[index] = nextResource;
    emitMockChange();
    return wait(nextResource);
  }

  await http.put(`/vega-backend/v1/resources/${id}`, {
    catalog_id: input.catalogId,
    category: input.category,
    description: input.description,
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    name: input.name,
    schema_definition: input.schema.map(mapSchemaFieldUpdateToBackend),
    index_config: mapIndexConfigToBackend(input.indexConfig),
    expected_update_time: input.expectedUpdateTime,
    source_identifier: input.sourceIdentifier,
  });

  return getCatalogResource(id);
}

/** Derived views use a dedicated write path so generic resource field mapping cannot lose source bindings. */
export async function createDerivedView(input: DerivedViewInput): Promise<CatalogResource> {
  if (useMock) {
    const source = mockResources.find((item) => item.id === input.sourceResourceId);
    if (!source || (source.category !== "table" && source.category !== "index")) {
      throwMockRequestError(400, "VegaBackend.LogicView.InvalidSource", "Invalid source resource.");
    }
    const timestamp = Date.now();
    const resource: CatalogResource = {
      catalogId: input.catalogId,
      category: "logicview",
      columnCount: input.schema.length,
      description: input.description,
      enabled: input.enabled,
      expectedUpdateTime: timestamp,
      id: `res-${mockSlug(10)}`,
      localIndexStatus: "unavailable",
      logicDefinition: {
        sourceResourceId: input.sourceResourceId,
        filterCondition: mockResponseFilterCondition(input.filterCondition),
      },
      logicType: "derived",
      name: input.name,
      operations: ["view_detail", "query_data", "delete"],
      rowCount: null,
      schema: input.schema,
      sourceIdentifier: "",
      tags: input.tags,
      updateTime: formatMockTimestamp(timestamp),
    };
    mockResources.unshift(resource);
    emitMockChange();
    return wait(resource);
  }

  const response = await http.post<{ id?: string } & BackendResource>(
    "/vega-backend/v1/resources",
    {
      catalog_id: input.catalogId,
      category: "logicview",
      description: input.description,
      enabled: input.enabled,
      logic_type: "derived",
      logic_definition: mapDerivedDefinition(input.sourceResourceId, input.filterCondition),
      name: input.name,
      schema_definition: input.schema.map(mapDerivedViewSchema),
      tags: input.tags,
    },
    {
      headers: { "Content-Type": "application/json" },
      transformRequest: transformPrecisionSafeJSONRequest,
    },
  );
  const created = response.data.id ? await getCatalogResource(response.data.id) : null;
  if (!created) {
    throw new Error("Created view detail is unavailable.");
  }
  return created;
}

export async function updateDerivedView(
  id: string,
  input: DerivedViewUpdateInput,
): Promise<CatalogResource | null> {
  if (useMock) {
    const index = mockResources.findIndex((item) => item.id === id);
    const current = mockResources[index];
    if (!current || current.category !== "logicview" || current.logicType !== "derived") {
      throwMockRequestError(404, "VegaBackend.Resource.NotFound", "View not found.");
    }
    validateMockExpectedUpdateTime(input.expectedUpdateTime);
    if (current.expectedUpdateTime !== input.expectedUpdateTime) {
      throwMockRequestError(409, "VegaBackend.Resource.UpdateConflict", "View has changed.");
    }
    const timestamp = Date.now();
    const next: CatalogResource = {
      ...current,
      description: input.description,
      enabled: input.enabled,
      expectedUpdateTime: timestamp,
      logicDefinition: {
        sourceResourceId: input.sourceResourceId,
        filterCondition: mockResponseFilterCondition(input.filterCondition),
      },
      name: input.name,
      schema: input.schema,
      tags: input.tags,
      updateTime: formatMockTimestamp(timestamp),
    };
    mockResources[index] = next;
    emitMockChange();
    return wait(next);
  }

  await http.put(
    `/vega-backend/v1/resources/${id}`,
    {
      catalog_id: input.catalogId,
      category: "logicview",
      description: input.description,
      enabled: input.enabled,
      expected_update_time: input.expectedUpdateTime,
      logic_type: "derived",
      logic_definition: mapDerivedDefinition(input.sourceResourceId, input.filterCondition),
      name: input.name,
      schema_definition: input.schema.map(mapDerivedViewSchema),
      tags: input.tags,
    },
    {
      headers: { "Content-Type": "application/json" },
      transformRequest: transformPrecisionSafeJSONRequest,
    },
  );
  return getCatalogResource(id);
}

export async function deleteCatalogResource(
  id: string,
  options: { onlyIfStale?: boolean; skipErrorToast?: boolean } = {},
) {
  if (useMock) {
    if (
      mockBuildTasks.some(
        (task) =>
          task.resourceId === id && (task.status === "running" || task.status === "stopping"),
      )
    ) {
      throwMockRequestError(
        409,
        "VegaBackend.BuildTask.HasRunningExecution",
        "Resource has a running build task; wait until it finishes.",
      );
    }
    const index = mockResources.findIndex((item) => item.id === id);
    if (options.onlyIfStale && index < 0) {
      throwMockRequestError(404, "VegaBackend.Resource.NotFound", "Resource not found.");
    }
    if (
      options.onlyIfStale &&
      (mockResources[index].status !== "stale" ||
        mockResources[index].lastDiscoverStatus !== "missing")
    ) {
      throwMockRequestError(
        409,
        "VegaBackend.Resource.DeleteConflict",
        "Resource is no longer stale and missing.",
      );
    }
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

  const url = `/vega-backend/v1/resources/${id}${options.onlyIfStale ? "?only_if_stale=true" : ""}`;
  await http.delete(url, {
    skipErrorToast: options.skipErrorToast,
  });
}

/** Trigger asynchronous metadata refresh for one Resource. */
export async function discoverCatalogResource(id: string): Promise<{ id: string }> {
  if (useMock) {
    const resource = mockResources.find((item) => item.id === id);
    if (!resource) {
      throwMockRequestError(404, "VegaBackend.Resource.NotFound", "Resource not found.");
    }
    await wait(undefined);
    return { id: `discover-resource-${id}` };
  }

  const response = await http.post<{ id: string }>(`/vega-backend/v1/resources/${id}/discover`);
  return response.data;
}

/** Change Resource access state through its dedicated action endpoint. */
export async function setCatalogResourceEnabled(id: string, enabled: boolean) {
  if (useMock) {
    const index = mockResources.findIndex((item) => item.id === id);
    if (index < 0) {
      throwMockRequestError(404, "VegaBackend.Resource.NotFound", "Resource not found.");
    }
    const expectedUpdateTime = Date.now();
    const updated = {
      ...mockResources[index],
      enabled,
      expectedUpdateTime,
      updateTime: formatMockTimestamp(expectedUpdateTime),
    };
    mockResources[index] = updated;
    emitMockChange();
    return wait(updated);
  }

  await http.post(`/vega-backend/v1/resources/${id}/${enabled ? "enable" : "disable"}`);
  return getCatalogResource(id);
}

const PREVIEW_CELL_POOL: Record<string, (row: number) => unknown> = {
  bigint: (row) => 100000 + row * 7,
  decimal: (row) => ((row * 137) % 9000) + Math.round(row * 0.37 * 100) / 100,
  datetime: (row) => formatMockTimestamp(Date.now() - row * 3_600_000).slice(0, 16),
  text: (row) =>
    row % 7 === 0 ? null : i18n.t("dataCatalog.preview.mockLongText", { row: row + 1 }),
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

function mockPreviewCell(
  field: ResourceSchemaField,
  row: number,
  query: ResourcePreviewQuery,
  usesLocalIndex: boolean,
) {
  const type = field.type.toLowerCase();
  if (type === "other") {
    return usesLocalIndex
      ? { mode: "unavailable" }
      : { data: mockOtherContent(field, row), mode: "content" };
  }
  if (type !== "binary") {
    return mockCell(field, row);
  }
  if (usesLocalIndex) {
    return { mode: "unavailable" };
  }
  if (row % 7 === 0) {
    return null;
  }

  const byteLength = 10 + (row % 51);
  if (query.binaryMode === "content") {
    return {
      byte_length: byteLength,
      data: mockBinaryContent(row, byteLength),
      mode: "content",
    };
  }
  return { byte_length: byteLength, mode: "metadata" };
}

function mockResourcePreviewCell(
  resource: CatalogResource,
  field: ResourceSchemaField,
  row: number,
  query: ResourcePreviewQuery,
  usesLocalIndex: boolean,
) {
  if (resource.id === "res-orders" && field.name === "customer_id") {
    return 101 + (row % 2);
  }
  return mockPreviewCell(field, row, query, usesLocalIndex);
}

function mockOtherContent(field: ResourceSchemaField, row: number) {
  const originalType = field.originalType ?? "unknown";
  switch (originalType.toLowerCase()) {
    case "point":
      return { x: 116.4 + row * 0.01, y: 39.9 + row * 0.01 };
    case "geometry":
      return `POLYGON((116.${row} 39.${row},116.${row + 1} 39.${row},116.${row + 1} 39.${row + 1},116.${row} 39.${row + 1},116.${row} 39.${row}))`;
    default:
      return { original_type: originalType, value: `unsupported_value_${row + 1}` };
  }
}

function mockBinaryContent(row: number, byteLength: number) {
  const bytes = Array.from({ length: byteLength }, (_, index) => (row + index) % 256);
  return btoa(String.fromCharCode(...bytes));
}

function mockFilterMatches(condition: unknown, row: Record<string, unknown>): boolean {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) return true;
  const node = condition as Record<string, unknown>;
  if (node.operation === "and" || node.operation === "or") {
    const children = Array.isArray(node.sub_conditions) ? node.sub_conditions : [];
    return node.operation === "and"
      ? children.every((child) => mockFilterMatches(child, row))
      : children.some((child) => mockFilterMatches(child, row));
  }
  if (typeof node.field !== "string") return false;
  const actual = row[node.field];
  if (actual === null || actual === undefined) return false;
  const expected = node.value;
  const left =
    typeof actual === "number"
      ? actual
      : typeof actual === "string" || typeof actual === "boolean"
        ? String(actual)
        : null;
  if (left === null) return false;
  const right = typeof actual === "number" ? Number(expected) : String(expected);
  switch (node.operation) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return left > right;
    case "<":
      return left < right;
    default:
      return false;
  }
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

    const usesLocalIndex =
      !query.ignoreLocalIndex &&
      resource.category === "table" &&
      resource.localIndexStatus === "available" &&
      Boolean(resource.localIndexName);
    const source = resource.logicDefinition?.sourceResourceId
      ? mockResources.find((item) => item.id === resource.logicDefinition?.sourceResourceId)
      : null;
    const total = resourceCountForPagination(source?.rowCount ?? resource.rowCount);
    const makeRow = (rowIndex: number) => {
      const sourceCells = source?.schema.map((field) => ({
        field,
        value: mockResourcePreviewCell(source, field, rowIndex, query, false),
      }));
      const sourceRow = sourceCells
        ? Object.fromEntries(sourceCells.map(({ field, value }) => [field.name, value]))
        : null;
      const sourceBindings = sourceCells
        ? Object.fromEntries(
            sourceCells.map(({ field, value }) => [field.originalName || field.name, value]),
          )
        : null;
      const row = Object.fromEntries(
        resource.schema.map((field) => [
          field.name,
          sourceBindings
            ? sourceBindings[field.originalName || field.name]
            : mockResourcePreviewCell(resource, field, rowIndex, query, usesLocalIndex),
        ]),
      );
      return { row, sourceRow };
    };
    const fixed = resource.logicDefinition?.filterCondition;
    const dynamic = query.filterCondition;
    let rows: Record<string, unknown>[] = [];
    let matchingTotal = total;
    if (!fixed && !dynamic) {
      const count = Math.max(0, Math.min(query.limit, total - query.offset));
      rows = Array.from({ length: count }, (_, index) => makeRow(query.offset + index).row);
    } else {
      matchingTotal = 0;
      for (let rowIndex = 0; rowIndex < total; rowIndex++) {
        const { row, sourceRow } = makeRow(rowIndex);
        if (!mockFilterMatches(fixed, sourceRow ?? row) || !mockFilterMatches(dynamic, row))
          continue;
        if (matchingTotal >= query.offset && rows.length < query.limit) rows.push(row);
        matchingTotal++;
      }
    }

    return wait(
      {
        querySource: usesLocalIndex ? "local_index" : "source",
        rows,
        total: matchingTotal,
      },
      260,
    );
  }

  // POST /resources/:id/data with X-HTTP-Method-Override: GET performs the data query.
  const response = await http.post<{
    query_source?: "local_index" | "source";
    entries?: Record<string, unknown>[];
    total_count?: number | string;
  }>(
    `/vega-backend/v1/resources/${id}/data`,
    {
      ...(query.ignoreLocalIndex ? { ignore_local_index: true } : {}),
      ...(query.binaryMode ? { binary_mode: query.binaryMode } : {}),
      ...(query.filterCondition ? { filter_condition: query.filterCondition } : {}),
      need_total: true,
      paging: {
        limit: query.limit,
        mode: "single",
        offset: query.offset,
      },
    },
    {
      headers: { "Content-Type": "application/json", "X-HTTP-Method-Override": "GET" },
      skipErrorToast: true,
      transformRequest: transformPrecisionSafeJSONRequest,
      transformResponse: transformPrecisionSafeJSONResponse,
    },
  );

  return {
    querySource: response.data.query_source,
    rows: response.data.entries ?? [],
    total: response.data.total_count ?? 0,
  };
}

/* ---------------- Discovery ---------------- */

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

export function isCatalogDiscovering(catalogId: string) {
  return mockDiscoveringCatalogs.has(catalogId);
}

export async function listCatalogDiscovers(catalogId: string): Promise<CatalogDiscoverRecord[]> {
  if (useMock) {
    return wait([...(mockDiscoverRecords.get(catalogId) ?? [])]);
  }

  const response = await http.get<ListResponse<BackendDiscoverTask>>(
    "/vega-backend/v1/discover-tasks",
    {
      params: { catalog_id: catalogId, limit: 6, offset: 0 },
    },
  );

  return response.data.entries.map((item) => {
    const startedAt = item.start_time ?? item.create_time ?? 0;
    // Backend enum: pending, running, completed, failed.
    const status: CatalogDiscoverRecord["status"] =
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
