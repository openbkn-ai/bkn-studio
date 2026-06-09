import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import {
  unwrapSingleEntryResponse,
  type SingleEntryResponse,
} from "@/framework/request/normalize";
import type {
  KnowledgeNetworkImportMode,
  KnowledgeNetworkListQuery,
  KnowledgeNetworkListResult,
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkPreviewGraph,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendKnowledgeNetwork,
  BackendListResponse,
  BackendObjectType,
  BackendSubgraphResponse,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  mapKnowledgeNetwork,
  mapRecentObject,
} from "@/modules/knowledge-network/services/mappers";
import {
  toBackendKnowledgeNetworkCreatePayload,
  toBackendKnowledgeNetworkUpdatePayload,
} from "@/modules/knowledge-network/services/mappers/network.mapper";
import {
  mockActionTypes,
  mockConceptGroups,
  mockKnowledgeNetworks,
  mockObjectTypes,
  mockPreviewGraphs,
  mockRecentObjects,
  mockRelationTypes,
  replaceMockKnowledgeNetworks,
} from "@/modules/knowledge-network/services/mock/state";
import {
  downloadJsonFile,
  emptyStatistics,
  filterKnowledgeNetworks,
  formatTimestamp,
  stringFromUnknown,
  throwImportConflict,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

const DEFAULT_BUSINESS_DOMAIN_ID = "bd_public";

function getKnowledgeNetworkDomainHeaders() {
  const runtimeConfig = getRuntimeConfig();
  const businessDomainId =
    runtimeConfig.currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN_ID;

  return {
    "x-business-domain": businessDomainId,
  };
}

export async function listKnowledgeNetworks(
  query: KnowledgeNetworkListQuery,
): Promise<KnowledgeNetworkListResult> {
  if (useMock) {
    const filtered = filterKnowledgeNetworks(mockKnowledgeNetworks, query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  const response = await http.get<BackendListResponse<BackendKnowledgeNetwork>>(
    "/bkn-backend/v1/knowledge-networks",
    {
      headers: getKnowledgeNetworkDomainHeaders(),
      params: {
        direction: query.direction === "asc" ? "asc" : "desc",
        limit: query.pageSize,
        name_pattern: query.keyword.trim() || undefined,
        offset: (query.page - 1) * query.pageSize,
        sort: query.sortBy === "name" ? "name" : "update_time",
        tag: query.tag || undefined,
      },
    },
  );

  return {
    items: response.data.entries.map(mapKnowledgeNetwork),
    total: response.data.total_count,
  };
}

export async function listKnowledgeNetworkTags() {
  if (useMock) {
    return wait([...new Set(mockKnowledgeNetworks.flatMap((item) => item.tags))].sort());
  }

  const response = await http.get<BackendListResponse<BackendKnowledgeNetwork>>(
    "/bkn-backend/v1/knowledge-networks",
    {
      headers: getKnowledgeNetworkDomainHeaders(),
      params: {
        limit: 200,
        offset: 0,
        sort: "update_time",
        direction: "desc",
      },
    },
  );

  const tagSet = new Set<string>();
  response.data.entries.forEach((item) => {
    (item.tags ?? []).forEach((tag) => tagSet.add(tag));
  });

  return [...tagSet].sort((left, right) => left.localeCompare(right));
}

export async function getKnowledgeNetwork(networkId: string) {
  if (useMock) {
    return wait(mockKnowledgeNetworks.find((item) => item.id === networkId) ?? null);
  }

  try {
    const response = await http.get<SingleEntryResponse<BackendKnowledgeNetwork>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}`,
      {
        headers: getKnowledgeNetworkDomainHeaders(),
        params: { include_statistics: true },
      },
    );

    const record = unwrapSingleEntryResponse(response.data);
    return record ? mapKnowledgeNetwork(record) : null;
  } catch {
    const response = await http.get<SingleEntryResponse<BackendKnowledgeNetwork>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}`,
      {
        headers: getKnowledgeNetworkDomainHeaders(),
      },
    );

    const record = unwrapSingleEntryResponse(response.data);
    return record ? mapKnowledgeNetwork(record) : null;
  }
}

export async function createKnowledgeNetwork(input: KnowledgeNetworkMutationPayload) {
  if (useMock) {
    const nextRecord: KnowledgeNetworkRecord = {
      id: crypto.randomUUID(),
      identifier: input.identifier,
      name: input.name,
      description: input.description,
      color: input.color,
      icon: "deployment-unit",
      tags: input.tags,
      createTime: formatTimestamp(Date.now()),
      updateTime: formatTimestamp(Date.now()),
      creatorName: "Local Admin",
      updaterName: "Local Admin",
      statistics: emptyStatistics(),
    };

    mockKnowledgeNetworks.unshift(nextRecord);
    mockRecentObjects[nextRecord.id] = [];
    mockConceptGroups[nextRecord.id] = [];
    mockPreviewGraphs[nextRecord.id] = { nodes: [], edges: [] };
    mockObjectTypes[nextRecord.id] = [];
    mockRelationTypes[nextRecord.id] = [];
    mockActionTypes[nextRecord.id] = [];

    await wait(undefined);
    return nextRecord;
  }

  const response = await http.post<{ id: string }>(
    "/bkn-backend/v1/knowledge-networks",
    toBackendKnowledgeNetworkCreatePayload(input),
    {
      headers: getKnowledgeNetworkDomainHeaders(),
      params: {
        validate_dependency: false,
      },
    },
  );

  return getKnowledgeNetwork(response.data.id);
}

export async function updateKnowledgeNetwork(
  networkId: string,
  input: KnowledgeNetworkMutationPayload,
) {
  if (useMock) {
    replaceMockKnowledgeNetworks(
      mockKnowledgeNetworks.map((item) =>
        item.id === networkId
          ? {
              ...item,
              identifier: input.identifier,
              name: input.name,
              description: input.description,
              color: input.color,
              tags: input.tags,
              updateTime: formatTimestamp(Date.now()),
              updaterName: "Local Admin",
            }
          : item,
      ),
    );

    await wait(undefined);
    return mockKnowledgeNetworks.find((item) => item.id === networkId) ?? null;
  }

  await http.put(
    `/bkn-backend/v1/knowledge-networks/${networkId}`,
    toBackendKnowledgeNetworkUpdatePayload(input),
    {
      headers: getKnowledgeNetworkDomainHeaders(),
      params: {
        validate_dependency: false,
      },
    },
  );

  return getKnowledgeNetwork(networkId);
}

export async function deleteKnowledgeNetwork(networkId: string) {
  if (useMock) {
    replaceMockKnowledgeNetworks(
      mockKnowledgeNetworks.filter((item) => item.id !== networkId),
    );
    delete mockRecentObjects[networkId];
    delete mockConceptGroups[networkId];
    delete mockPreviewGraphs[networkId];
    delete mockObjectTypes[networkId];
    delete mockRelationTypes[networkId];
    delete mockActionTypes[networkId];
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}`, {
    headers: getKnowledgeNetworkDomainHeaders(),
  });
}

export async function listKnowledgeNetworkRecentObjects(networkId: string) {
  if (useMock) {
    return wait(mockRecentObjects[networkId] ?? []);
  }

  const response = await http.get<BackendListResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
    {
      params: {
        direction: "desc",
        limit: 5,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapRecentObject);
}

export async function getKnowledgeNetworkPreviewGraph(networkId: string) {
  if (useMock) {
    return wait(mockPreviewGraphs[networkId] ?? { nodes: [], edges: [] });
  }

  const emptyGraph = {
    edges: [] as KnowledgeNetworkPreviewGraph["edges"],
    nodes: [] as KnowledgeNetworkPreviewGraph["nodes"],
  };

  try {
    const response = await http.post<BackendSubgraphResponse>(
      `/ontology-query/v1/knowledge-networks/${networkId}/subgraph`,
      {},
      { skipErrorToast: true } as Parameters<typeof http.post>[2],
    );

    const subgraph = response.data;
    const rawNodes = (subgraph.nodes ?? subgraph.objects ?? []) as Array<{
      color?: string;
      id?: string;
      name?: string;
    }>;
    const rawEdges = (subgraph.edges ?? subgraph.relations ?? []) as Array<{
      id?: string;
      name?: string;
      source?: string;
      source_id?: string;
      source_object_type_id?: string;
      target?: string;
      target_id?: string;
      target_object_type_id?: string;
    }>;

    return {
      nodes: rawNodes
        .filter((item) => item.id)
        .map((item) => ({
          id: item.id as string,
          name: item.name ?? item.id ?? "-",
          color: item.color ?? "#1677ff",
        })),
      edges: rawEdges
        .filter(
          (item) =>
            item.id &&
            (item.source ?? item.source_id ?? item.source_object_type_id) &&
            (item.target ?? item.target_id ?? item.target_object_type_id),
        )
        .map((item) => ({
          id: item.id as string,
          name: item.name ?? "",
          sourceId:
            item.source ?? item.source_id ?? (item.source_object_type_id as string),
          targetId:
            item.target ?? item.target_id ?? (item.target_object_type_id as string),
        })),
    };
  } catch {
    return emptyGraph;
  }
}

export async function exportKnowledgeNetwork(networkId: string) {
  if (useMock) {
    const record = mockKnowledgeNetworks.find((item) => item.id === networkId);
    if (!record) {
      throw new Error("Knowledge network not found");
    }

    downloadJsonFile(record.name, {
      id: record.id,
      code: record.identifier,
      name: record.name,
      comment: record.description,
      color: record.color,
      tags: record.tags,
    });
    return;
  }

  const response = await http.get<Record<string, unknown>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}`,
    { params: { mode: "export" } },
  );

  const payload = response.data;
  downloadJsonFile(stringFromUnknown(payload.name, networkId), payload);
}

export async function importKnowledgeNetwork(
  payload: Record<string, unknown>,
  importMode?: KnowledgeNetworkImportMode,
) {
  const requestBody = {
    ...payload,
    validate_dependency: false,
  };

  if (useMock) {
    const identifier = stringFromUnknown(
      payload.id,
      stringFromUnknown(payload.code, crypto.randomUUID()),
    );
    const exists = mockKnowledgeNetworks.some(
      (item) => item.id === identifier || item.identifier === identifier,
    );

    if (exists && !importMode) {
      throwImportConflict("知识网络 ID 或名称已存在。");
    }

    if (exists && importMode === "ignore") {
      await wait(undefined);
      return;
    }

    const nextRecord: KnowledgeNetworkRecord = {
      id: identifier,
      identifier: stringFromUnknown(payload.code, identifier),
      name: stringFromUnknown(payload.name, identifier),
      description: stringFromUnknown(
        payload.comment,
        stringFromUnknown(payload.description),
      ),
      color: stringFromUnknown(payload.color, "#1677ff"),
      icon: stringFromUnknown(payload.icon, "deployment-unit"),
      tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
      createTime: formatTimestamp(Date.now()),
      updateTime: formatTimestamp(Date.now()),
      creatorName: "Imported User",
      updaterName: "Imported User",
      statistics: emptyStatistics(),
    };

    if (exists && importMode === "overwrite") {
      replaceMockKnowledgeNetworks(
        mockKnowledgeNetworks.map((item) =>
          item.id === identifier ? nextRecord : item,
        ),
      );
    } else {
      mockKnowledgeNetworks.unshift(nextRecord);
    }

    await wait(undefined);
    return;
  }

  try {
    await http.post("/bkn-backend/v1/knowledge-networks", requestBody, {
      params: {
        import_mode: importMode,
        validate_dependency: false,
      },
    });
  } catch (error) {
    const response = (
      error as { response?: { data?: { error_code?: string; description?: string } } }
    ).response?.data;

    if (
      response?.error_code === "OntologyManager.KnowledgeNetwork.KNIDExisted" ||
      response?.error_code === "OntologyManager.KnowledgeNetwork.KNNameExisted"
    ) {
      throwImportConflict(response.description ?? "导入冲突");
    }

    throw error;
  }
}
