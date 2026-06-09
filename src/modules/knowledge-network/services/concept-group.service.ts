import { http } from "@/framework/request/http";
import {
  unwrapSingleEntryResponse,
  type SingleEntryResponse,
} from "@/framework/request/normalize";
import type {
  ConceptGroupDetail,
  ConceptGroupMutationPayload,
  KnowledgeNetworkImportMode,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendConceptGroup,
  BackendListResponse,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  mapConceptGroup,
  mapConceptGroupDetail,
} from "@/modules/knowledge-network/services/mappers";
import {
  enrichConceptGroupDetail,
  mockConceptGroups,
  mockObjectTypes,
  syncKnowledgeNetworkStatistics,
  syncMockConceptGroups,
} from "@/modules/knowledge-network/services/mock/state";
import {
  formatTimestamp,
  rethrowImportConflict,
  stringFromUnknown,
  throwImportConflict,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

const CONCEPT_GROUP_ICON = "icon-dip-fenzu";
const KNOWLEDGE_NETWORK_BRANCH = "main";

function resolveConceptGroupMutationResultId(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }

  return null;
}

export async function listKnowledgeNetworkConceptGroups(networkId: string) {
  if (useMock) {
    return wait((mockConceptGroups[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendConceptGroup>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups`,
    {
      params: {
        direction: "desc",
        limit: 50,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapConceptGroup);
}

export async function getKnowledgeNetworkConceptGroup(networkId: string, groupId: string) {
  if (useMock) {
    const group = mockConceptGroups[networkId]?.find((item) => item.id === groupId) ?? null;
    return wait(group ? enrichConceptGroupDetail(networkId, group) : null);
  }

  const response = await http.get<SingleEntryResponse<BackendConceptGroup>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapConceptGroupDetail(record) : null;
}

export async function createKnowledgeNetworkConceptGroup(
  networkId: string,
  input: ConceptGroupMutationPayload,
) {
  if (useMock) {
    const nextItem: ConceptGroupDetail = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      color: input.color,
      tags: input.tags,
      objectTypesTotal: 0,
      relationTypesTotal: 0,
      actionTypesTotal: 0,
      updateTime: formatTimestamp(Date.now()),
      objectTypes: [],
      relationTypes: [],
      actionTypes: [],
    };

    mockConceptGroups[networkId] = [nextItem, ...(mockConceptGroups[networkId] ?? [])];
    await wait(undefined);
    return nextItem;
  }

  const response = await http.post<SingleEntryResponse<BackendConceptGroup>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups`,
    {
      branch: KNOWLEDGE_NETWORK_BRANCH,
      color: input.color,
      comment: input.description,
      icon: CONCEPT_GROUP_ICON,
      kn_id: networkId,
      name: input.name,
      tags: input.tags,
    },
  );

  const record = unwrapSingleEntryResponse(response.data);
  if (record?.name) {
    return mapConceptGroupDetail(record);
  }

  const createdId = resolveConceptGroupMutationResultId(response.data);
  return createdId ? getKnowledgeNetworkConceptGroup(networkId, createdId) : null;
}

export async function updateKnowledgeNetworkConceptGroup(
  networkId: string,
  groupId: string,
  input: ConceptGroupMutationPayload,
) {
  if (useMock) {
    mockConceptGroups[networkId] = (mockConceptGroups[networkId] ?? []).map((item) =>
      item.id === groupId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
          }
        : item,
    );

    await wait(undefined);
    return mockConceptGroups[networkId]?.find((item) => item.id === groupId) ?? null;
  }

  const response = await http.put<SingleEntryResponse<BackendConceptGroup>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}`,
    {
      branch: KNOWLEDGE_NETWORK_BRANCH,
      color: input.color,
      comment: input.description,
      icon: CONCEPT_GROUP_ICON,
      name: input.name,
      tags: input.tags,
    },
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record?.name
    ? mapConceptGroupDetail(record)
    : getKnowledgeNetworkConceptGroup(networkId, groupId);
}

export async function deleteKnowledgeNetworkConceptGroup(networkId: string, groupId: string) {
  if (useMock) {
    mockConceptGroups[networkId] = (mockConceptGroups[networkId] ?? []).filter(
      (item) => item.id !== groupId,
    );
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}`);
}

export async function addObjectTypesToKnowledgeNetworkConceptGroup(
  networkId: string,
  groupId: string,
  objectTypeIds: string[],
) {
  if (useMock) {
    const group = mockConceptGroups[networkId]?.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Concept group not found");
    }

    mockObjectTypes[networkId] = (mockObjectTypes[networkId] ?? []).map((item) => {
      if (!objectTypeIds.includes(item.id)) {
        return item;
      }

      return {
        ...item,
        conceptGroupIds: [...new Set([...item.conceptGroupIds, groupId])],
        conceptGroupNames: [...new Set([...(item.conceptGroupNames ?? []), group.name])],
      };
    });

    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.post(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}/object-types`,
    {
      entries: objectTypeIds.map((id) => ({ id })),
    },
  );
}

export async function removeObjectTypesFromKnowledgeNetworkConceptGroup(
  networkId: string,
  groupId: string,
  objectTypeIds: string[],
) {
  if (useMock) {
    const group = mockConceptGroups[networkId]?.find((item) => item.id === groupId);

    mockObjectTypes[networkId] = (mockObjectTypes[networkId] ?? []).map((item) => {
      if (!objectTypeIds.includes(item.id)) {
        return item;
      }

      return {
        ...item,
        conceptGroupIds: item.conceptGroupIds.filter((entry) => entry !== groupId),
        conceptGroupNames: (item.conceptGroupNames ?? []).filter(
          (entry) => entry !== group?.name,
        ),
      };
    });

    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.delete(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}/object-types/${objectTypeIds.join(",")}`,
  );
}

export async function importKnowledgeNetworkConceptGroup(
  networkId: string,
  payload: Record<string, unknown>,
  importMode?: KnowledgeNetworkImportMode,
) {
  const requestBody = { ...payload, validate_dependency: false };

  if (useMock) {
    const id = stringFromUnknown(payload.id);
    const name = stringFromUnknown(payload.name);
    const groups = mockConceptGroups[networkId] ?? [];
    const existingById = id ? groups.find((item) => item.id === id) : undefined;
    const existingByName = name
      ? groups.find((item) => item.name === name && item.id !== id)
      : undefined;

    if (!importMode) {
      if (existingById) {
        throwImportConflict(`概念分组 ID「${id}」已存在。`);
      }
      if (existingByName) {
        throwImportConflict(`概念分组名称「${name}」已存在。`);
      }
    } else if (importMode === "ignore" && (existingById || existingByName)) {
      await wait(undefined);
      return;
    }

    const mapImportedMembers = (value: unknown): ConceptGroupDetail["objectTypes"] => {
      if (!Array.isArray(value)) {
        return [];
      }

      return value
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null,
        )
        .map((item) => ({
          id: stringFromUnknown(item.id),
          name: stringFromUnknown(item.name),
          description: stringFromUnknown(item.comment ?? item.description),
          color: typeof item.color === "string" ? item.color : undefined,
          icon: typeof item.icon === "string" ? item.icon : undefined,
          tags: Array.isArray(item.tags)
            ? item.tags.map((tag) => stringFromUnknown(tag))
            : [],
        }))
        .filter((item) => item.id && item.name);
    };

    const objectTypes = mapImportedMembers(payload.object_types);
    const relationTypes = mapImportedMembers(payload.relation_types);
    const actionTypes = mapImportedMembers(payload.action_types);
    const nextId = id || crypto.randomUUID();

    const imported: ConceptGroupDetail = enrichConceptGroupDetail(networkId, {
      actionTypes,
      actionTypesTotal: actionTypes.length,
      color: typeof payload.color === "string" ? payload.color : "#1677ff",
      description: stringFromUnknown(payload.comment ?? payload.description),
      id: nextId,
      name: name || nextId,
      objectTypes,
      objectTypesTotal: objectTypes.length,
      relationTypes,
      relationTypesTotal: relationTypes.length,
      tags: Array.isArray(payload.tags)
        ? payload.tags.map((tag) => stringFromUnknown(tag))
        : [],
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Import",
    });

    if (importMode === "overwrite" && existingById) {
      mockConceptGroups[networkId] = groups.map((item) =>
        item.id === existingById.id ? imported : item,
      );
    } else if (!existingById) {
      mockConceptGroups[networkId] = [imported, ...groups];
    }

    objectTypes.forEach((objectType) => {
      mockObjectTypes[networkId] = (mockObjectTypes[networkId] ?? []).map((item) => {
        if (item.id !== objectType.id) {
          return item;
        }

        return {
          ...item,
          conceptGroupIds: [...new Set([...item.conceptGroupIds, nextId])],
          conceptGroupNames: [...new Set([...(item.conceptGroupNames ?? []), imported.name])],
        };
      });
    });

    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  try {
    await http.post(
      `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups`,
      requestBody,
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
