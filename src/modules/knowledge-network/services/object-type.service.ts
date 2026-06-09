import axios from "axios";

import { http } from "@/framework/request/http";
import {
  unwrapSingleEntryResponse,
  type SingleEntryResponse,
} from "@/framework/request/normalize";
import type {
  KnowledgeNetworkImportMode,
  KnowledgeNetworkObjectTypeMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
  ObjectTypeDataProperty,
  ObjectTypeDataViewListQuery,
  ObjectTypeDataViewListResult,
  ObjectTypeDataViewPreview,
  ObjectTypeLogicOperatorRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendListResponse,
  BackendObjectType,
  BackendSmallModel,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  buildBackendObjectTypePayload,
  mapObjectType,
  mapObjectTypeDetail,
  mapSmallModel,
  toBackendDataProperty,
} from "@/modules/knowledge-network/services/mappers";
import {
  buildMockObjectTypeDetail,
  cloneDataProperties,
  mockConceptGroups,
  mockObjectTypeDataProperties,
  mockObjectTypeDataViewFields,
  mockObjectTypeDataViewGroups,
  mockObjectTypeDataViewPreviewRows,
  mockObjectTypeDataViews,
  mockObjectTypeLogicMetricModels,
  mockObjectTypeLogicOperators,
  mockObjectTypeSmallModels,
  mockObjectTypes,
  mockRecentObjects,
  objectTypeHasIndexFromProperties,
  persistMockObjectTypeProperties,
  removeMockObjectTypeProperties,
  syncKnowledgeNetworkStatistics,
  syncMockConceptGroups,
} from "@/modules/knowledge-network/services/mock/state";
import {
  formatTimestamp,
  rethrowImportConflict,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";
import { listKnowledgeNetworkConceptGroups } from "@/modules/knowledge-network/services/concept-group.service";

type LegacyDataViewGroupResponse = {
  entries?: Array<{
    builtin?: boolean;
    id: string;
    name?: string;
  }>;
};

type LegacyDataSourceConnectionResponse = {
  entries?: Array<{
    id: string;
    name?: string;
    type?: string;
  }>;
};

type LegacyDataViewListResponse = {
  entries?: Array<{
    data_source_id?: string;
    group_id?: string;
    group_name?: string;
    id: string;
    name: string;
  }>;
  total_count?: number;
};

type LegacyDataViewDetailField = {
  comment?: string;
  display_name?: string;
  name: string;
  type?: string;
};

type LegacyDataViewDetail = {
  fields?: LegacyDataViewDetailField[];
  id: string;
  name?: string;
};

type LegacyDataViewPreviewResponse = {
  entries?: Array<Record<string, string | number | boolean | null>>;
  view?: {
    fields?: LegacyDataViewDetailField[];
    name?: string;
  };
};

type LegacyMetricModelDimension = {
  display_name?: string;
  name: string;
  type?: string;
};

type LegacyMetricModelRecord = {
  analysis_dimensions?: LegacyMetricModelDimension[];
  group_name?: string;
  id: string;
  name: string;
};

type LegacyMetricModelListResponse = {
  entries?: LegacyMetricModelRecord[];
};

const DATA_VIEW_SOURCE_TYPE_LABELS: Record<string, string> = {
  index_base: "Index Base",
  mysql: "MySQL",
};

function resolveObjectTypeMutationResultId(
  value: unknown,
  fallbackId?: string,
): string | null {
  if (typeof fallbackId === "string" && fallbackId.trim()) {
    return fallbackId.trim();
  }

  if (Array.isArray(value)) {
    const firstId =
      typeof value[0] === "object" && value[0] !== null && "id" in value[0]
        ? (value[0] as { id?: unknown }).id
        : undefined;

    return typeof firstId === "string" && firstId.trim() ? firstId.trim() : null;
  }

  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }

  return null;
}

function isBackendObjectTypeRecord(value: unknown): value is BackendObjectType {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

async function getLegacyDataViewDetail(dataViewId: string): Promise<LegacyDataViewDetail | null> {
  const response = await http.get<LegacyDataViewDetail[] | LegacyDataViewDetail>(
    `/mdl-data-model/v1/data-views/${dataViewId}`,
  );

  if (Array.isArray(response.data)) {
    return response.data[0] ?? null;
  }

  return response.data ?? null;
}

async function getLegacyMetricModelDetail(modelId: string): Promise<LegacyMetricModelRecord | null> {
  const response = await http.get<LegacyMetricModelRecord[] | LegacyMetricModelRecord>(
    `/mdl-data-model/v1/metric-models/${modelId}`,
  );

  if (Array.isArray(response.data)) {
    return response.data[0] ?? null;
  }

  return response.data ?? null;
}

function getDataViewSourceTypeLabel(type: string) {
  return DATA_VIEW_SOURCE_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

function normalizeDataViewPreviewRows(
  rows: Array<Record<string, string | number | boolean | null>> | undefined,
) {
  return (rows ?? []).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value == null ? "" : typeof value === "boolean" ? String(value) : value,
      ]),
    ),
  );
}

async function resolveObjectTypeConceptGroups(
  networkId: string,
  conceptGroupIds: string[],
): Promise<Array<{ id: string; name: string }>> {
  const groups = await listKnowledgeNetworkConceptGroups(networkId);

  return groups
    .filter((group) => conceptGroupIds.includes(group.id))
    .map((group) => ({ id: group.id, name: group.name }));
}

export async function listKnowledgeNetworkObjectTypes(networkId: string) {
  if (useMock) {
    return wait((mockObjectTypes[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
    {
      params: {
        direction: "desc",
        limit: 100,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapObjectType);
}

export async function getKnowledgeNetworkObjectType(
  networkId: string,
  objectTypeId: string,
) {
  if (useMock) {
    return wait(
      (mockObjectTypes[networkId] ?? []).find((item) => item.id === objectTypeId) ?? null,
    );
  }

  const response = await http.get<SingleEntryResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapObjectType(record) : null;
}

export async function getKnowledgeNetworkObjectTypeDetail(
  networkId: string,
  objectTypeId: string,
) {
  if (useMock) {
    return wait(buildMockObjectTypeDetail(networkId, objectTypeId));
  }

  const response = await http.get<SingleEntryResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapObjectTypeDetail(record) : null;
}

export async function updateKnowledgeNetworkObjectTypeIndex(
  networkId: string,
  objectTypeId: string,
  propertyNames: string[],
  properties: ObjectTypeDataProperty[],
) {
  if (useMock) {
    const detail = buildMockObjectTypeDetail(networkId, objectTypeId);

    if (!detail) {
      throw new Error("Object type not found.");
    }

    const nextProperties = detail.dataProperties.map((item) => {
      const updated = properties.find((property) => property.name === item.name);

      return updated ?? item;
    });

    mockObjectTypeDataProperties[networkId] = {
      ...(mockObjectTypeDataProperties[networkId] ?? {}),
      [objectTypeId]: nextProperties.map((item) => ({
        ...item,
        indexConfig: item.indexConfig ? { ...item.indexConfig } : undefined,
      })),
    };

    return wait(undefined);
  }

  await http.put(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}/data_properties/${propertyNames.join(",")}`,
    {
      entries: properties.map(toBackendDataProperty),
    },
  );
}

export async function listObjectTypeDataViewGroups(networkId: string) {
  if (useMock) {
    return wait((mockObjectTypeDataViewGroups[networkId] ?? []).map((item) => ({ ...item })));
  }

  const [groupsResult, dataSourcesResult] = await Promise.allSettled([
    http.get<LegacyDataViewGroupResponse>("/mdl-data-model/v1/data-view-groups", {
      params: {
        limit: -1,
      },
    }),
    http.get<LegacyDataSourceConnectionResponse>("/data-connection/v1/datasource"),
  ]);

  const groupEntries =
    groupsResult.status === "fulfilled" ? (groupsResult.value.data.entries ?? []) : [];
  const dataSourceEntries =
    dataSourcesResult.status === "fulfilled" ? (dataSourcesResult.value.data.entries ?? []) : [];

  const filteredGroups = groupEntries.filter((item) => item.id && item.name);
  if (dataSourceEntries.length === 0) {
    return filteredGroups.map((item) => ({
      id: item.id,
      name: item.name ?? item.id,
      type: item.id === "__index_base" ? "index_base" : item.builtin ? "mysql" : "custom",
    }));
  }

  const dataSourceById = new Map(dataSourceEntries.map((item) => [item.id, item]));
  const indexBaseDataSource = dataSourceEntries.find((item) => item.type === "index_base");
  const rootGroupIds = new Set<string>();
  const result: Array<{
    id: string;
    name: string;
    parentId?: string;
    selectable?: boolean;
    type: string;
  }> = [];

  filteredGroups.forEach((item) => {
    const matchedDataSource =
      dataSourceById.get(item.id) ?? (item.id === "__index_base" ? indexBaseDataSource : undefined);
    const type = matchedDataSource?.type ?? (item.id === "__index_base" ? "index_base" : "custom");
    const rootId = `source-type:${type}`;

    if (!rootGroupIds.has(rootId)) {
      rootGroupIds.add(rootId);
      result.push({
        id: rootId,
        name: getDataViewSourceTypeLabel(type),
        selectable: false,
        type,
      });
    }

    result.push({
      id: item.id,
      name: matchedDataSource?.name ?? item.name ?? item.id,
      parentId: rootId,
      type,
    });
  });

  return result;
}

export async function queryObjectTypeDataViews(
  networkId: string,
  query: ObjectTypeDataViewListQuery = {},
): Promise<ObjectTypeDataViewListResult> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;

  if (useMock) {
    let items = (mockObjectTypeDataViews[networkId] ?? []).map((item) => ({ ...item }));

    if (query.dataSourceId) {
      items = items.filter((item) => item.dataSourceId === query.dataSourceId);
    }

    if (query.name?.trim()) {
      const keyword = query.name.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(keyword));
    }

    const start = (page - 1) * pageSize;
    return wait({
      items: items.slice(start, start + pageSize),
      total: items.length,
    });
  }

  const response = await http.get<LegacyDataViewListResponse>("/mdl-data-model/v1/data-views", {
    params: {
      direction: "desc",
      group_id: query.dataSourceId || "__all",
      keyword: query.name,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: "update_time",
      type: "atomic",
    },
  });

  return {
    items: (response.data.entries ?? []).map((item) => ({
      dataSourceId: item.group_id ?? item.data_source_id,
      id: item.id,
      name: item.name,
    })),
    total: response.data.total_count ?? 0,
  };
}

export async function getObjectTypeDataViewPreview(
  networkId: string,
  dataViewId: string,
): Promise<ObjectTypeDataViewPreview | null> {
  if (useMock) {
    const view = (mockObjectTypeDataViews[networkId] ?? []).find((item) => item.id === dataViewId);
    const fields = mockObjectTypeDataViewFields[networkId]?.[dataViewId] ?? [];
    const rows =
      mockObjectTypeDataViewPreviewRows[networkId]?.[dataViewId] ??
      fields.slice(0, 3).map((field, index) => ({
        [field.name]: `${field.displayName}-${index + 1}`,
      }));

    if (!view) {
      return null;
    }

    return wait({
      columns: fields.map((field) => ({
        dataIndex: field.name,
        title: field.displayName,
      })),
      name: view.name,
      rows,
    });
  }

  const response = await http.post<LegacyDataViewPreviewResponse>(
    `/mdl-uniquery/v1/data-views/${dataViewId}?include_view=true`,
    {
      limit: 20,
      offset: 0,
    },
    {
      headers: {
        "x-http-method-override": "GET",
      },
    },
  );

  const previewView = response.data.view;
  if (previewView) {
    return {
      columns: (previewView.fields ?? []).map((item) => ({
        dataIndex: item.name,
        title: item.display_name ?? item.name,
      })),
      name: previewView.name ?? "",
      rows: normalizeDataViewPreviewRows(response.data.entries),
    };
  }

  const detail = await getLegacyDataViewDetail(dataViewId);
  if (!detail) {
    return null;
  }

  return {
    columns: (detail.fields ?? []).map((item) => ({
      dataIndex: item.name,
      title: item.display_name ?? item.name,
    })),
    name: detail.name ?? "",
    rows: [],
  };
}

export async function listObjectTypeDataViews(networkId: string) {
  if (useMock) {
    return wait((mockObjectTypeDataViews[networkId] ?? []).map((item) => ({ ...item })));
  }

  const result = await queryObjectTypeDataViews(networkId, { page: 1, pageSize: 9999 });
  return result.items;
}

export async function listObjectTypeDataViewFields(networkId: string, dataViewId: string) {
  if (useMock) {
    return wait(
      (mockObjectTypeDataViewFields[networkId]?.[dataViewId] ?? []).map((item) => ({
        ...item,
      })),
    );
  }

  const detail = await getLegacyDataViewDetail(dataViewId);

  return (detail?.fields ?? []).map((item) => ({
    comment: item.comment,
    displayName: item.display_name ?? item.name,
    name: item.name,
    type: item.type ?? "string",
  }));
}

export async function listObjectTypeLogicMetricModels() {
  if (useMock) {
    return wait(mockObjectTypeLogicMetricModels.map((item) => ({ ...item })));
  }

  const response = await http.get<LegacyMetricModelListResponse>("/mdl-data-model/v1/metric-models", {
    params: {
      direction: "desc",
      limit: -1,
      offset: 0,
      sort: "update_time",
    },
  });

  return (response.data.entries ?? []).map((item) => ({
    analysisDimensions: (item.analysis_dimensions ?? []).map((dimension) => ({
      displayName: dimension.display_name ?? dimension.name,
      name: dimension.name,
      type: dimension.type ?? "string",
    })),
    groupName: item.group_name ?? "",
    id: item.id,
    name: item.name,
  }));
}

export async function listObjectTypeLogicMetricModelFields(modelId: string) {
  if (useMock) {
    const model = mockObjectTypeLogicMetricModels.find((item) => item.id === modelId);
    return wait(
      (model?.analysisDimensions ?? []).map((item) => ({
        displayName: item.displayName,
        name: item.name,
        type: item.type,
      })),
    );
  }

  try {
    const response = await http.get<LegacyMetricModelDimension[]>(
      `/mdl-uniquery/v1/metric-models/${modelId}/fields`,
    );

    return (response.data ?? []).map((item) => ({
      displayName: item.display_name ?? item.name,
      name: item.name,
      type: item.type ?? "string",
    }));
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }

    const detail = await getLegacyMetricModelDetail(modelId);

    return (detail?.analysis_dimensions ?? []).map((item) => ({
      displayName: item.display_name ?? item.name,
      name: item.name,
      type: item.type ?? "string",
    }));
  }
}

export async function listObjectTypeLogicOperators(): Promise<ObjectTypeLogicOperatorRecord[]> {
  if (useMock) {
    return wait(mockObjectTypeLogicOperators.map((item) => ({ ...item })));
  }

  const response = await http.get<{
    data?: Array<{
      metadata?: { api_spec?: unknown };
      name: string;
      operator_id: string;
    }>;
  }>("/bkn-backend/v1/operators", {
    params: {
      execution_mode: "sync",
      page: 1,
      page_size: -1,
    },
  });

  return (response.data.data ?? []).map((item) => ({
    apiSpec: item.metadata?.api_spec,
    id: item.operator_id,
    inputParameters: undefined,
    name: item.name,
  }));
}

export async function listObjectTypeSmallModels() {
  if (useMock) {
    return wait(mockObjectTypeSmallModels.map((item) => ({ ...item })));
  }

  const response = await http.get<{ data?: BackendSmallModel[] }>(
    "/bkn-backend/v1/small-models",
    {
      params: {
        model_type: "embedding",
        page: 1,
        size: 9999,
      },
    },
  );

  return (response.data.data ?? []).map(mapSmallModel);
}

export async function createKnowledgeNetworkObjectType(
  networkId: string,
  input: KnowledgeNetworkObjectTypeMutationPayload,
) {
  if (useMock) {
    const relatedGroups = (mockConceptGroups[networkId] ?? []).filter((group) =>
      input.conceptGroupIds.includes(group.id),
    );
    const objectTypeId = input.id?.trim() || crypto.randomUUID();
    const dataProperties = cloneDataProperties(input.dataProperties ?? []);
    const logicProperties = (input.logicProperties ?? []).map((item) => ({ ...item }));
    const nextItem: KnowledgeNetworkObjectTypeRecord = {
      id: objectTypeId,
      name: input.name,
      description: input.description,
      color: input.color,
      icon: input.icon,
      tags: input.tags,
      conceptGroupIds: input.conceptGroupIds,
      conceptGroupNames: relatedGroups.map((group) => group.name),
      hasIndex: objectTypeHasIndexFromProperties(dataProperties),
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Local Admin",
    };

    mockObjectTypes[networkId] = [nextItem, ...(mockObjectTypes[networkId] ?? [])];
    persistMockObjectTypeProperties(
      networkId,
      objectTypeId,
      dataProperties,
      logicProperties,
      input.dataSource,
    );
    mockRecentObjects[networkId] = [
      {
        id: nextItem.id,
        name: nextItem.name,
        comment: nextItem.description,
        color: nextItem.color,
        icon: nextItem.icon,
        tags: nextItem.tags,
        updateTime: nextItem.updateTime,
        updaterName: nextItem.updaterName,
      },
      ...(mockRecentObjects[networkId] ?? []),
    ].slice(0, 5);
    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return nextItem;
  }

  const conceptGroups = await resolveObjectTypeConceptGroups(networkId, input.conceptGroupIds);
  const payload = buildBackendObjectTypePayload(input, conceptGroups);

  const response = await http.post<SingleEntryResponse<BackendObjectType> | Array<{ id?: string }>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
    {
      entries: [payload],
    },
  );

  const record = unwrapSingleEntryResponse(response.data);
  if (isBackendObjectTypeRecord(record)) {
    return mapObjectType(record);
  }

  const createdId = resolveObjectTypeMutationResultId(response.data, input.id);
  return createdId ? getKnowledgeNetworkObjectType(networkId, createdId) : null;
}

export async function updateKnowledgeNetworkObjectType(
  networkId: string,
  objectTypeId: string,
  input: KnowledgeNetworkObjectTypeMutationPayload,
) {
  if (useMock) {
    const relatedGroups = (mockConceptGroups[networkId] ?? []).filter((group) =>
      input.conceptGroupIds.includes(group.id),
    );
    const dataProperties = cloneDataProperties(input.dataProperties ?? []);
    const logicProperties = (input.logicProperties ?? []).map((item) => ({ ...item }));
    mockObjectTypes[networkId] = (mockObjectTypes[networkId] ?? []).map((item) =>
      item.id === objectTypeId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            icon: input.icon,
            tags: input.tags,
            conceptGroupIds: input.conceptGroupIds,
            conceptGroupNames: relatedGroups.map((group) => group.name),
            hasIndex: objectTypeHasIndexFromProperties(dataProperties),
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    persistMockObjectTypeProperties(
      networkId,
      objectTypeId,
      dataProperties,
      logicProperties,
      input.dataSource,
    );
    mockRecentObjects[networkId] = (mockRecentObjects[networkId] ?? []).map((item) =>
      item.id === objectTypeId
        ? {
            ...item,
            name: input.name,
            comment: input.description,
            color: input.color,
            icon: input.icon,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return (mockObjectTypes[networkId] ?? []).find((item) => item.id === objectTypeId) ?? null;
  }

  const conceptGroups = await resolveObjectTypeConceptGroups(networkId, input.conceptGroupIds);
  const payload = buildBackendObjectTypePayload(input, conceptGroups, objectTypeId);

  const response = await http.put<SingleEntryResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}`,
    payload,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return isBackendObjectTypeRecord(record)
    ? mapObjectType(record)
    : getKnowledgeNetworkObjectType(networkId, objectTypeId);
}

export async function deleteKnowledgeNetworkObjectType(
  networkId: string,
  objectTypeId: string,
) {
  if (useMock) {
    mockObjectTypes[networkId] = (mockObjectTypes[networkId] ?? []).filter(
      (item) => item.id !== objectTypeId,
    );
    removeMockObjectTypeProperties(networkId, objectTypeId);
    mockRecentObjects[networkId] = (mockRecentObjects[networkId] ?? []).filter(
      (item) => item.id !== objectTypeId,
    );
    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}`);
}

export async function importKnowledgeNetworkObjectTypes(
  networkId: string,
  payload: Record<string, unknown>,
  importMode?: KnowledgeNetworkImportMode,
) {
  const entries = Array.isArray(payload.entries) ? payload.entries : [payload];

  if (useMock) {
    await wait(undefined);
    return;
  }

  try {
    await http.post(
      `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
      { entries },
      {
        params: {
          import_mode: importMode,
          validate_dependency: false,
        },
      },
    );
  } catch (error) {
    rethrowImportConflict(error);
  }
}
