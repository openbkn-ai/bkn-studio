/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  unwrapSingleEntryResponse,
  type SingleEntryResponse,
} from "@/framework/request/normalize";
import type {
  ActionTypeDetail,
  ActionTypeExecutionLogDetail,
  ActionTypeExecutionLogListResult,
  ActionTypeExecutionLogQuery,
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkImportMode,
  KnowledgeNetworkActionTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { BackendActionExecutionLog } from "@/modules/knowledge-network/services/mappers/action-execution.mapper";
import type {
  BackendActionType,
  BackendListResponse,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  buildActionExecutionLogQueryParams,
  mapActionType,
  mapActionTypeDetail,
  mapActionTypeExecutionLogDetail,
  mapActionTypeExecutionLogList,
  toBackendActionTypeCreateEntry,
  toBackendActionTypeUpdatePayload,
} from "@/modules/knowledge-network/services/mappers";
import {
  cancelMockActionTypeExecutionLog,
  cloneActionTypeExecutionConfig,
  completeMockActionTypeExecutionLog,
  createDefaultActionTypeExecutionConfig,
  createMockActionTypeExecutionLog,
  getMockActionTypeExecutionLogDetail,
  listMockActionTypeExecutionLogs,
  mockActionTypeDetailExtras,
  mockActionTypeExecutionConfigs,
  mockActionTypes,
  mockObjectTypes,
  persistMockActionTypeDetailExtras,
  persistMockActionTypeExecutionConfig,
  removeMockActionTypeDetailExtras,
  removeMockActionTypeExecutionConfig,
  removeMockActionTypeExecutionLogs,
  syncKnowledgeNetworkStatistics,
} from "@/modules/knowledge-network/services/mock/state";
import {
  formatTimestamp,
  rethrowImportConflict,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

function resolveActionTypeMutationResultId(
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

function isBackendActionTypeRecord(value: unknown): value is BackendActionType {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

export async function listKnowledgeNetworkActionTypes(networkId: string) {
  if (useMock) {
    return wait((mockActionTypes[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types`,
    {
      params: {
        direction: "desc",
        limit: 100,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapActionType);
}

export async function getKnowledgeNetworkActionType(
  networkId: string,
  actionTypeId: string,
) {
  if (useMock) {
    return wait(
      (mockActionTypes[networkId] ?? []).find((item) => item.id === actionTypeId) ?? null,
    );
  }

  const response = await http.get<SingleEntryResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapActionType(record) : null;
}

export async function getKnowledgeNetworkActionTypeDetail(
  networkId: string,
  actionTypeId: string,
): Promise<ActionTypeDetail | null> {
  if (useMock) {
    const record = await getKnowledgeNetworkActionType(networkId, actionTypeId);
    if (!record) {
      return null;
    }

    const extras = mockActionTypeDetailExtras[networkId]?.[actionTypeId];
    return {
      ...record,
      affect: extras?.affect ? { ...extras.affect } : undefined,
      condition: extras?.condition ? { ...extras.condition } : undefined,
      executionConfig: cloneActionTypeExecutionConfig(
        mockActionTypeExecutionConfigs[networkId]?.[actionTypeId] ??
          createDefaultActionTypeExecutionConfig(),
      ),
    };
  }

  const response = await http.get<SingleEntryResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapActionTypeDetail(record) : null;
}

export async function listKnowledgeNetworkActionTypeExecutionLogs(
  networkId: string,
  query: ActionTypeExecutionLogQuery,
): Promise<ActionTypeExecutionLogListResult> {
  if (useMock) {
    await wait(undefined);
    return listMockActionTypeExecutionLogs(networkId, query);
  }

  const response = await http.get<{
    entries?: BackendActionExecutionLog[];
    total_count?: number;
  }>(`/bkn-backend/v1/knowledge-networks/${networkId}/action-logs`, {
    params: buildActionExecutionLogQueryParams(query),
  });

  return mapActionTypeExecutionLogList(response.data);
}

export async function getKnowledgeNetworkActionTypeExecutionLogDetail(
  networkId: string,
  logId: string,
): Promise<ActionTypeExecutionLogDetail | null> {
  if (useMock) {
    await wait(undefined);
    return getMockActionTypeExecutionLogDetail(networkId, logId);
  }

  const response = await http.get<BackendActionExecutionLog>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-logs/${logId}`,
  );

  return mapActionTypeExecutionLogDetail(response.data);
}

export async function executeKnowledgeNetworkActionTypeNow(
  networkId: string,
  actionTypeId: string,
) {
  if (useMock) {
    const record = (mockActionTypes[networkId] ?? []).find((item) => item.id === actionTypeId);
    if (!record) {
      throw new Error("Action type not found");
    }

    const created = createMockActionTypeExecutionLog(networkId, {
      actionTypeId: record.id,
      actionTypeName: record.name,
    });
    completeMockActionTypeExecutionLog(networkId, created.id);
    await wait(undefined);
    return getMockActionTypeExecutionLogDetail(networkId, created.id);
  }

  const response = await http.post<{ execution_id?: string }>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}/execute`,
    {
      unique_identities: [],
    },
  );

  return response.data;
}

export async function cancelKnowledgeNetworkActionTypeExecution(
  networkId: string,
  logId: string,
) {
  if (useMock) {
    cancelMockActionTypeExecutionLog(networkId, logId);
    await wait(undefined);
    return;
  }

  await http.post(`/bkn-backend/v1/knowledge-networks/${networkId}/action-logs/${logId}/cancel`);
}

export async function createKnowledgeNetworkActionType(
  networkId: string,
  input: KnowledgeNetworkActionTypeMutationPayload,
) {
  if (useMock) {
    const relatedObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.objectTypeId,
    );
    const nextItem: KnowledgeNetworkActionTypeRecord = {
      id: input.id?.trim() || crypto.randomUUID(),
      name: input.name,
      description: input.description,
      color: input.color,
      actionKind: input.actionKind,
      objectTypeId: input.objectTypeId,
      objectTypeName: relatedObject?.name ?? input.objectTypeId,
      tags: input.tags,
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Local Admin",
    };

    mockActionTypes[networkId] = [nextItem, ...(mockActionTypes[networkId] ?? [])];
    persistMockActionTypeExecutionConfig(
      networkId,
      nextItem.id,
      input.executionConfig ?? createDefaultActionTypeExecutionConfig(),
    );
    persistMockActionTypeDetailExtras(networkId, nextItem.id, {
      affect: input.affect,
      condition: input.condition,
    });
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return nextItem;
  }

  const response = await http.post<SingleEntryResponse<BackendActionType> | Array<{ id?: string }>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types`,
    {
      entries: [toBackendActionTypeCreateEntry(input)],
    },
  );

  const record = unwrapSingleEntryResponse(response.data);
  if (isBackendActionTypeRecord(record)) {
    return mapActionType(record);
  }

  const createdId = resolveActionTypeMutationResultId(response.data, input.id);
  return createdId ? getKnowledgeNetworkActionType(networkId, createdId) : null;
}

export async function updateKnowledgeNetworkActionType(
  networkId: string,
  actionTypeId: string,
  input: KnowledgeNetworkActionTypeMutationPayload,
) {
  if (useMock) {
    const relatedObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.objectTypeId,
    );
    mockActionTypes[networkId] = (mockActionTypes[networkId] ?? []).map((item) =>
      item.id === actionTypeId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            actionKind: input.actionKind,
            objectTypeId: input.objectTypeId,
            objectTypeName: relatedObject?.name ?? input.objectTypeId,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    if (input.executionConfig) {
      persistMockActionTypeExecutionConfig(networkId, actionTypeId, input.executionConfig);
    }
    persistMockActionTypeDetailExtras(networkId, actionTypeId, {
      affect: input.affect,
      condition: input.condition,
    });
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return (mockActionTypes[networkId] ?? []).find((item) => item.id === actionTypeId) ?? null;
  }

  const response = await http.put<SingleEntryResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
    toBackendActionTypeUpdatePayload(input),
  );

  const record = unwrapSingleEntryResponse(response.data);
  return isBackendActionTypeRecord(record)
    ? mapActionType(record)
    : getKnowledgeNetworkActionType(networkId, actionTypeId);
}

export async function deleteKnowledgeNetworkActionType(
  networkId: string,
  actionTypeId: string,
) {
  if (useMock) {
    mockActionTypes[networkId] = (mockActionTypes[networkId] ?? []).filter(
      (item) => item.id !== actionTypeId,
    );
    removeMockActionTypeExecutionConfig(networkId, actionTypeId);
    removeMockActionTypeDetailExtras(networkId, actionTypeId);
    removeMockActionTypeExecutionLogs(networkId, actionTypeId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`);
}

export async function importKnowledgeNetworkActionTypes(
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
      `/bkn-backend/v1/knowledge-networks/${networkId}/action-types`,
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
