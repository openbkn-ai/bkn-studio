import { http } from "@/framework/request/http";
import {
  unwrapSingleEntryResponse,
  type SingleEntryResponse,
} from "@/framework/request/normalize";
import type {
  KnowledgeNetworkImportMode,
  KnowledgeNetworkRelationTypeMutationPayload,
  KnowledgeNetworkRelationTypeRecord,
  RelationTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendListResponse,
  BackendRelationType,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  mapRelationType,
  mapRelationTypeDetail,
  toBackendRelationTypeCreateEntry,
  toBackendRelationTypeUpdatePayload,
} from "@/modules/knowledge-network/services/mappers";
import {
  cloneRelationTypeDataViewMappings,
  cloneRelationTypePropertyMappings,
  mockObjectTypes,
  mockRelationTypeDataViewMappings,
  mockRelationTypeMappings,
  mockRelationTypes,
  persistMockRelationTypeDataViewMappings,
  persistMockRelationTypeMappings,
  removeMockRelationTypeDataViewMappings,
  removeMockRelationTypeMappings,
  syncKnowledgeNetworkStatistics,
} from "@/modules/knowledge-network/services/mock/state";
import {
  formatTimestamp,
  rethrowImportConflict,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

function resolveRelationTypeMutationResultId(
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

function isBackendRelationTypeRecord(value: unknown): value is BackendRelationType {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

function persistMockRelationTypeMappingBundle(
  networkId: string,
  relationTypeId: string,
  input: KnowledgeNetworkRelationTypeMutationPayload,
) {
  if (input.mappingMode === "data-view" && input.mappingRules) {
    persistMockRelationTypeDataViewMappings(networkId, relationTypeId, {
      backingDataSourceId: input.mappingRules.backingDataSourceId,
      backingDataSourceName: input.mappingRules.backingDataSourceName,
      dataViewMappings: input.mappingRules.dataViewMappings.filter(
        (item) =>
          item.sourceObjectPropertyName &&
          item.dataViewSourcePropertyName &&
          item.dataViewTargetPropertyName &&
          item.targetObjectPropertyName,
      ),
    });
    removeMockRelationTypeMappings(networkId, relationTypeId);
    return;
  }

  persistMockRelationTypeMappings(
    networkId,
    relationTypeId,
    (input.mappingRules?.propertyMappings ?? []).filter(
      (item) => item.sourcePropertyName && item.targetPropertyName,
    ),
  );
  removeMockRelationTypeDataViewMappings(networkId, relationTypeId);
}

export async function listKnowledgeNetworkRelationTypes(networkId: string) {
  if (useMock) {
    return wait((mockRelationTypes[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`,
    {
      params: {
        direction: "desc",
        limit: 100,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapRelationType);
}

export async function getKnowledgeNetworkRelationType(
  networkId: string,
  relationTypeId: string,
) {
  if (useMock) {
    return wait(
      (mockRelationTypes[networkId] ?? []).find((item) => item.id === relationTypeId) ?? null,
    );
  }

  const response = await http.get<SingleEntryResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapRelationType(record) : null;
}

export async function getKnowledgeNetworkRelationTypeDetail(
  networkId: string,
  relationTypeId: string,
): Promise<RelationTypeDetail | null> {
  if (useMock) {
    const record = await getKnowledgeNetworkRelationType(networkId, relationTypeId);
    if (!record) {
      return null;
    }

    if (record.mappingMode === "data-view") {
      const dataViewStore = mockRelationTypeDataViewMappings[networkId]?.[relationTypeId];

      return {
        ...record,
        backingDataSourceId: dataViewStore?.backingDataSourceId ?? "",
        backingDataSourceName: dataViewStore?.backingDataSourceName,
        dataViewMappings: cloneRelationTypeDataViewMappings(
          dataViewStore?.dataViewMappings ?? [],
        ),
        propertyMappings: [],
      };
    }

    return {
      ...record,
      backingDataSourceId: "",
      backingDataSourceName: "",
      dataViewMappings: [],
      propertyMappings: cloneRelationTypePropertyMappings(
        mockRelationTypeMappings[networkId]?.[relationTypeId] ?? [],
      ),
    };
  }

  const response = await http.get<SingleEntryResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapRelationTypeDetail(record) : null;
}

export async function createKnowledgeNetworkRelationType(
  networkId: string,
  input: KnowledgeNetworkRelationTypeMutationPayload,
) {
  if (useMock) {
    const sourceObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.sourceObjectTypeId,
    );
    const targetObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.targetObjectTypeId,
    );
    const nextItem: KnowledgeNetworkRelationTypeRecord = {
      id: input.id?.trim() || crypto.randomUUID(),
      name: input.name,
      description: input.description,
      color: input.color,
      mappingMode: input.mappingMode,
      sourceObjectTypeId: input.sourceObjectTypeId,
      sourceObjectTypeName: sourceObject?.name ?? input.sourceObjectTypeId,
      targetObjectTypeId: input.targetObjectTypeId,
      targetObjectTypeName: targetObject?.name ?? input.targetObjectTypeId,
      tags: input.tags,
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Local Admin",
    };

    mockRelationTypes[networkId] = [nextItem, ...(mockRelationTypes[networkId] ?? [])];
    persistMockRelationTypeMappingBundle(networkId, nextItem.id, input);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return nextItem;
  }

  const response = await http.post<SingleEntryResponse<BackendRelationType> | Array<{ id?: string }>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`,
    {
      entries: [toBackendRelationTypeCreateEntry(input)],
    },
  );

  const record = unwrapSingleEntryResponse(response.data);
  if (isBackendRelationTypeRecord(record)) {
    return mapRelationType(record);
  }

  const createdId = resolveRelationTypeMutationResultId(response.data, input.id);
  return createdId ? getKnowledgeNetworkRelationType(networkId, createdId) : null;
}

export async function updateKnowledgeNetworkRelationType(
  networkId: string,
  relationTypeId: string,
  input: KnowledgeNetworkRelationTypeMutationPayload,
) {
  if (useMock) {
    const sourceObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.sourceObjectTypeId,
    );
    const targetObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.targetObjectTypeId,
    );
    mockRelationTypes[networkId] = (mockRelationTypes[networkId] ?? []).map((item) =>
      item.id === relationTypeId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            mappingMode: input.mappingMode,
            sourceObjectTypeId: input.sourceObjectTypeId,
            sourceObjectTypeName: sourceObject?.name ?? input.sourceObjectTypeId,
            targetObjectTypeId: input.targetObjectTypeId,
            targetObjectTypeName: targetObject?.name ?? input.targetObjectTypeId,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    if (input.mappingRules) {
      persistMockRelationTypeMappingBundle(networkId, relationTypeId, input);
    }
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return (mockRelationTypes[networkId] ?? []).find((item) => item.id === relationTypeId) ?? null;
  }

  const response = await http.put<SingleEntryResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
    toBackendRelationTypeUpdatePayload(input),
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapRelationType(record) : getKnowledgeNetworkRelationType(networkId, relationTypeId);
}

export async function deleteKnowledgeNetworkRelationType(
  networkId: string,
  relationTypeId: string,
) {
  if (useMock) {
    mockRelationTypes[networkId] = (mockRelationTypes[networkId] ?? []).filter(
      (item) => item.id !== relationTypeId,
    );
    removeMockRelationTypeMappings(networkId, relationTypeId);
    removeMockRelationTypeDataViewMappings(networkId, relationTypeId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.delete(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
  );
}

export async function importKnowledgeNetworkRelationTypes(
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
      `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`,
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
