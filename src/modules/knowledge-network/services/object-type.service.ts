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
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendListResponse,
  BackendObjectType,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  buildBackendObjectTypePayload,
  mapObjectType,
  mapObjectTypeDetail,
  toBackendDataProperty,
} from "@/modules/knowledge-network/services/mappers";
import {
  buildMockObjectTypeDetail,
  cloneDataProperties,
  mockConceptGroups,
  mockObjectTypeDataProperties,
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
