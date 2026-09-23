/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { unwrapSingleEntryResponse, type SingleEntryResponse } from "@/framework/request/normalize";
import { ensureKnowledgeNetworkChildOperations } from "@/modules/knowledge-network/services/child-resource-operations.service";
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
  cloneRelationTypeResourceMappings,
  cloneRelationTypePropertyMappings,
  mockObjectTypes,
  mockRelationTypeResourceMappings,
  mockRelationTypeMappings,
  mockRelationTypes,
  mockKnowledgeNetworkChildOperations,
  persistMockRelationTypeResourceMappings,
  persistMockRelationTypeMappings,
  removeMockRelationTypeResourceMappings,
  removeMockRelationTypeMappings,
  syncKnowledgeNetworkStatistics,
} from "@/modules/knowledge-network/services/mock/state";
import {
  formatTimestamp,
  rethrowImportConflict,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

function resolveRelationTypeMutationResultId(value: unknown, fallbackId?: string): string | null {
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
  return typeof value === "object" && value !== null && "id" in value && "name" in value;
}

function persistMockRelationTypeMappingBundle(
  networkId: string,
  relationTypeId: string,
  input: KnowledgeNetworkRelationTypeMutationPayload,
) {
  if (input.mappingMode === "resource" && input.mappingRules) {
    persistMockRelationTypeResourceMappings(networkId, relationTypeId, {
      backingDataSourceId: input.mappingRules.backingDataSourceId,
      backingDataSourceName: input.mappingRules.backingDataSourceName,
      resourceMappings: input.mappingRules.resourceMappings.filter(
        (item) =>
          item.sourceObjectPropertyName &&
          item.resourceSourcePropertyName &&
          item.resourceTargetPropertyName &&
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
  removeMockRelationTypeResourceMappings(networkId, relationTypeId);
}

export async function listKnowledgeNetworkRelationTypes(networkId: string) {
  if (useMock) {
    return wait(
      (mockRelationTypes[networkId] ?? []).map((item) => ({
        ...item,
        operations: mockKnowledgeNetworkChildOperations,
      })),
    );
  }

  const response = await http.get<BackendListResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`,
    {
      params: {
        direction: "desc",
        // The list panel filters, sorts and paginates client-side, so it needs
        // every relation type. `limit=-1` disables backend pagination.
        limit: -1,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapRelationType);
}

export type KnowledgeNetworkRelationTypePageQuery = {
  direction?: "asc" | "desc";
  limit: number;
  namePattern?: string;
  offset: number;
  sort?: "name" | "update_time";
  sourceObjectTypeId?: string;
  targetObjectTypeId?: string;
};

export type KnowledgeNetworkRelationTypePage = {
  entries: KnowledgeNetworkRelationTypeRecord[];
  totalCount: number;
};

/** Reads one authorization-filtered server page for the relation-type workspace. */
export async function listKnowledgeNetworkRelationTypePage(
  networkId: string,
  query: KnowledgeNetworkRelationTypePageQuery,
): Promise<KnowledgeNetworkRelationTypePage> {
  if (useMock) {
    const keyword = query.namePattern?.trim().toLowerCase() ?? "";
    const filtered = (mockRelationTypes[networkId] ?? []).filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.id.toLowerCase().includes(keyword) ||
        item.name.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword);
      return (
        matchesKeyword &&
        (!query.sourceObjectTypeId || item.sourceObjectTypeId === query.sourceObjectTypeId) &&
        (!query.targetObjectTypeId || item.targetObjectTypeId === query.targetObjectTypeId)
      );
    });
    const sorted = [...filtered].sort((left, right) => {
      const leftValue = query.sort === "name" ? left.name : left.updateTime;
      const rightValue = query.sort === "name" ? right.name : right.updateTime;
      const result = leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return query.direction === "asc" ? result : -result;
    });
    return wait({
      entries: sorted
        .slice(query.offset, query.offset + query.limit)
        .map((item) => ({ ...item, operations: mockKnowledgeNetworkChildOperations })),
      totalCount: sorted.length,
    });
  }

  const response = await http.get<BackendListResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`,
    {
      params: {
        direction: query.direction ?? "desc",
        limit: query.limit,
        name_pattern: query.namePattern?.trim() || undefined,
        offset: query.offset,
        sort: query.sort ?? "update_time",
        source_object_type_id: query.sourceObjectTypeId || undefined,
        target_object_type_id: query.targetObjectTypeId || undefined,
      },
    },
  );

  return {
    entries: response.data.entries.map(mapRelationType),
    totalCount: response.data.total_count,
  };
}

export async function getKnowledgeNetworkRelationType(networkId: string, relationTypeId: string) {
  if (useMock) {
    return wait(
      (() => {
        const record = (mockRelationTypes[networkId] ?? []).find(
          (item) => item.id === relationTypeId,
        );
        return record ? { ...record, operations: mockKnowledgeNetworkChildOperations } : null;
      })(),
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

    if (record.mappingMode === "resource") {
      const resourceStore = mockRelationTypeResourceMappings[networkId]?.[relationTypeId];

      return {
        ...record,
        backingDataSourceId: resourceStore?.backingDataSourceId ?? "",
        backingDataSourceName: resourceStore?.backingDataSourceName,
        resourceMappings: cloneRelationTypeResourceMappings(resourceStore?.resourceMappings ?? []),
        propertyMappings: [],
      };
    }

    return {
      ...record,
      backingDataSourceId: "",
      backingDataSourceName: "",
      resourceMappings: [],
      propertyMappings: cloneRelationTypePropertyMappings(
        mockRelationTypeMappings[networkId]?.[relationTypeId] ?? [],
      ),
    };
  }

  const response = await http.get<SingleEntryResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record
    ? ensureKnowledgeNetworkChildOperations(
        networkId,
        "relation-types",
        mapRelationTypeDetail(record),
      )
    : null;
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

  const response = await http.post<
    SingleEntryResponse<BackendRelationType> | Array<{ id?: string }>
  >(`/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`, {
    entries: [toBackendRelationTypeCreateEntry(input)],
  });

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
  return record
    ? mapRelationType(record)
    : getKnowledgeNetworkRelationType(networkId, relationTypeId);
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
    removeMockRelationTypeResourceMappings(networkId, relationTypeId);
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
