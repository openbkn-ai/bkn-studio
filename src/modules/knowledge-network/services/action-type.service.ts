/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { filterMockOperations } from "@/framework/runtime/mock-user";
import { getActionTypeOperationKind } from "../utils/action-type-operation";
import { getActionTypeToolboxMetadataType } from "./action-type-tool.service";
import type { ActionTypeOperationKind } from "../types/action-type";

import { isRequestNotFound } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { throwIfStillReferenced } from "@/modules/knowledge-network/services/shared/definition-refusals";
import { withMockDefinitionDeclarations } from "@/modules/knowledge-network/services/shared/mock-declarations";
import { unwrapSingleEntryResponse, type SingleEntryResponse } from "@/framework/request/normalize";
import { ensureKnowledgeNetworkChildOperations } from "@/modules/knowledge-network/services/child-resource-operations.service";
import type {
  ActionTypeDetail,
  ActionTypeExecutionLogDetail,
  ActionTypeExecutionLogListResult,
  ActionTypeExecutionLogQuery,
  ActionTypeExecutionResultPage,
  ActionTypeExecutionResultQuery,
  ActionTypeExecutionToolCategory,
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkImportMode,
  KnowledgeNetworkActionTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendActionExecutionLog,
  BackendActionExecutionResultList,
} from "@/modules/knowledge-network/services/mappers/action-execution.mapper";
import type {
  BackendActionType,
  BackendListResponse,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  buildActionExecutionLogQueryParams,
  buildActionExecutionResultQueryParams,
  mapActionType,
  mapActionTypeDetail,
  mapActionTypeExecutionLogDetail,
  mapActionTypeExecutionLogList,
  mapActionTypeExecutionResultPage,
  toBackendActionTypeEnum,
  toBackendActionTypeCreateEntry,
  toBackendActionTypeUpdatePayload,
} from "@/modules/knowledge-network/services/mappers";
import {
  buildMockObjectTypeDetail,
  mockRelationTypes,
  cancelMockActionTypeExecutionLog,
  cloneActionTypeExecutionConfig,
  completeMockActionTypeExecutionLog,
  createDefaultActionTypeExecutionConfig,
  createMockActionTypeExecutionLog,
  getMockActionTypeExecutionLogDetail,
  listMockActionTypeExecutionLogs,
  listMockActionTypeExecutionResults,
  mockActionTypeDetailExtras,
  mockActionTypeExecutionConfigs,
  mockActionTypes,
  mockKnowledgeNetworkChildOperations,
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
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { resolveKnReadParams } from "@/modules/knowledge-network/services/shared/kn-version-context";
import type { ActionExecutionInput, ActionExecutionSchema } from "../utils/action-execution-input";

function requireActionOperation(input: KnowledgeNetworkActionTypeMutationPayload) {
  if (!input.operationConfig)
    throw new Error("operation_config is required; migrate existing actions before editing");
}

function resolveActionTypeMutationResultId(value: unknown, fallbackId?: string): string | null {
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
  return typeof value === "object" && value !== null && "id" in value && "name" in value;
}

export async function listKnowledgeNetworkActionTypes(
  networkId: string,
  options: { skipErrorToast?: boolean } = {},
) {
  if (useMock) {
    return wait(
      (mockActionTypes[networkId] ?? []).map((item) => ({
        ...item,
        operations: filterMockOperations(mockKnowledgeNetworkChildOperations),
      })),
    );
  }

  const response = await http.get<BackendListResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types`,
    {
      params: {
        direction: "desc",
        // Callers filter client-side — the object type detail page keeps only
        // the actions bound to it — so a truncated page silently hides bound
        // action types. `limit=-1` disables backend pagination.
        limit: -1,
        offset: 0,
        sort: "update_time",
      },
      skipErrorToast: options.skipErrorToast,
    },
  );

  return response.data.entries.map(mapActionType);
}

export type KnowledgeNetworkActionTypePageQuery = {
  executionToolCategory?: ActionTypeExecutionToolCategory;
  actionKind?: KnowledgeNetworkActionTypeKind;
  direction?: "asc" | "desc";
  independentOnly?: boolean;
  limit: number;
  namePattern?: string;
  objectTypeId?: string;
  offset: number;
  operationKind?: ActionTypeOperationKind;
  relationOperation?: "create" | "delete";
  sort?: "name" | "update_time";
};

async function filterByExecutionToolCategory(
  records: KnowledgeNetworkActionTypeRecord[],
  category?: ActionTypeExecutionToolCategory,
): Promise<KnowledgeNetworkActionTypeRecord[]> {
  if (!category) return records;
  if (category === "mcp") {
    return records.filter((record) => record.actionSource?.type === "mcp");
  }

  const boxIds = [
    ...new Set(
      records.flatMap((record) =>
        record.actionSource?.type === "tool" && record.actionSource.boxId
          ? [record.actionSource.boxId]
          : [],
      ),
    ),
  ];
  const metadata = new Map(
    await Promise.all(
      boxIds.map(async (boxId) => [boxId, await getActionTypeToolboxMetadataType(boxId)] as const),
    ),
  );
  return records.filter(
    (record) =>
      record.actionSource?.type === "tool" &&
      metadata.get(record.actionSource.boxId || "") === category,
  );
}

export type KnowledgeNetworkActionTypePage = {
  entries: KnowledgeNetworkActionTypeRecord[];
  totalCount: number;
};

/** Reads one authorization-filtered server page for action-type lists and related resources. */
export async function listKnowledgeNetworkActionTypePage(
  networkId: string,
  query: KnowledgeNetworkActionTypePageQuery,
): Promise<KnowledgeNetworkActionTypePage> {
  if (useMock) {
    const keyword = query.namePattern?.trim().toLowerCase() ?? "";
    const filtered = (mockActionTypes[networkId] ?? []).filter(
      (item) =>
        (!keyword ||
          item.id.toLowerCase().includes(keyword) ||
          item.name.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword)) &&
        (!query.actionKind || item.actionKind === query.actionKind) &&
        (!query.objectTypeId || item.objectTypeId === query.objectTypeId) &&
        (!query.operationKind || getActionTypeOperationKind(item) === query.operationKind) &&
        (!query.independentOnly || !item.objectTypeId) &&
        (!query.relationOperation ||
          (item.operationConfig?.type === "relation" &&
            item.operationConfig.relationOperation === query.relationOperation)),
    );
    const categoryFiltered = await filterByExecutionToolCategory(
      filtered,
      query.executionToolCategory,
    );
    const sorted = [...categoryFiltered].sort((left, right) => {
      const leftValue = query.sort === "name" ? left.name : left.updateTime;
      const rightValue = query.sort === "name" ? right.name : right.updateTime;
      const result = leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return query.direction === "asc" ? result : -result;
    });
    return wait({
      entries: sorted.slice(query.offset, query.offset + query.limit).map((item) => ({
        ...item,
        operations: filterMockOperations(mockKnowledgeNetworkChildOperations),
      })),
      totalCount: sorted.length,
    });
  }

  const requiresLocalFilter = Boolean(query.independentOnly || query.executionToolCategory);
  const response = await http.get<BackendListResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types`,
    {
      params: {
        action_type: query.actionKind ? toBackendActionTypeEnum(query.actionKind) : undefined,
        direction: query.direction ?? "desc",
        // Tool categories still require toolbox metadata; operation filters are applied by the server.
        limit: requiresLocalFilter ? -1 : query.limit,
        name_pattern: query.namePattern?.trim() || undefined,
        object_type_id: query.objectTypeId || undefined,
        operation_kind: query.operationKind,
        relation_operation: query.relationOperation,
        offset: requiresLocalFilter ? 0 : query.offset,
        sort: query.sort ?? "update_time",
      },
    },
  );

  const entries = response.data.entries.map(mapActionType);
  if (!requiresLocalFilter) {
    return { entries, totalCount: response.data.total_count };
  }

  const scoped = entries.filter(
    (entry) =>
      (!query.operationKind || getActionTypeOperationKind(entry) === query.operationKind) &&
      (!query.independentOnly || !entry.objectTypeId) &&
      (!query.relationOperation ||
        (entry.operationConfig?.type === "relation" &&
          entry.operationConfig.relationOperation === query.relationOperation)),
  );
  const categoryFiltered = await filterByExecutionToolCategory(scoped, query.executionToolCategory);
  return {
    entries: categoryFiltered.slice(query.offset, query.offset + query.limit),
    totalCount: categoryFiltered.length,
  };
}

export async function getKnowledgeNetworkActionType(
  networkId: string,
  actionTypeId: string,
  options: { skipErrorToast?: boolean } = {},
) {
  if (useMock) {
    return wait(
      (() => {
        const record = (mockActionTypes[networkId] ?? []).find((item) => item.id === actionTypeId);
        return record
          ? { ...record, operations: filterMockOperations(mockKnowledgeNetworkChildOperations) }
          : null;
      })(),
    );
  }

  const response = await http.get<SingleEntryResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
    { skipErrorToast: options.skipErrorToast },
  );

  const record = unwrapSingleEntryResponse(response.data);
  return record ? mapActionType(record) : null;
}

export async function getKnowledgeNetworkActionTypeDetail(
  networkId: string,
  actionTypeId: string,
  options: { skipErrorToast?: boolean } = {},
): Promise<ActionTypeDetail | null> {
  if (useMock) {
    const record = await getKnowledgeNetworkActionType(networkId, actionTypeId);
    if (!record) {
      return null;
    }

    const extras = mockActionTypeDetailExtras[networkId]?.[actionTypeId];
    const detail: ActionTypeDetail = {
      ...record,
      affect: extras?.affect ? { ...extras.affect } : undefined,
      condition: extras?.condition ? { ...extras.condition } : undefined,
      executionConfig: cloneActionTypeExecutionConfig(
        mockActionTypeExecutionConfigs[networkId]?.[actionTypeId] ??
          createDefaultActionTypeExecutionConfig(),
      ),
    };

    return detail;
  }

  const response = await http.get<SingleEntryResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
    { skipErrorToast: options.skipErrorToast },
  );

  const record = unwrapSingleEntryResponse(response.data);
  if (!record) {
    return null;
  }

  return ensureKnowledgeNetworkChildOperations(
    networkId,
    "action-types",
    mapActionTypeDetail(record),
    options,
  );
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
  }>(`/ontology-query/v1/knowledge-networks/${networkId}/action-logs`, {
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
    `/ontology-query/v1/knowledge-networks/${networkId}/action-logs/${logId}`,
  );

  return mapActionTypeExecutionLogDetail(response.data);
}

/**
 * Pages through one execution's per-instance results, paginated and filtered by the backend.
 * Resolves to null when the backend predates the results endpoint (404), so callers can fall
 * back to the first page of results embedded in the execution detail.
 */
export async function listKnowledgeNetworkActionTypeExecutionResults(
  networkId: string,
  logId: string,
  query: ActionTypeExecutionResultQuery,
): Promise<ActionTypeExecutionResultPage | null> {
  if (useMock) {
    await wait(undefined);
    return listMockActionTypeExecutionResults(networkId, logId, query);
  }

  try {
    const response = await http.get<BackendActionExecutionResultList>(
      `/ontology-query/v1/knowledge-networks/${networkId}/action-logs/${logId}/results`,
      { params: buildActionExecutionResultQueryParams(query) },
    );
    return mapActionTypeExecutionResultPage(response.data);
  } catch (error) {
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Discovery returns the execution contract without scanning objects. */
export async function getActionTypeExecutionSchema(
  networkId: string,
  actionTypeId: string,
): Promise<ActionExecutionSchema> {
  if (useMock) {
    const detail = await getKnowledgeNetworkActionTypeDetail(networkId, actionTypeId);
    if (!detail?.operationConfig) throw new Error("Action execution schema is unavailable");
    const fields: Record<string, ActionExecutionSchema> = {};
    const required: string[] = [];
    const valueSchema = (type?: string): ActionExecutionSchema => ({
      type: ["integer", "number", "boolean", "array", "object"].includes(type ?? "")
        ? type
        : "string",
    });
    const identity = (id: string): ActionExecutionSchema => {
      const object = buildMockObjectTypeDetail(networkId, id);
      if (!object?.primaryKeys?.length) throw new Error("Object identity is unavailable");
      return {
        type: "object",
        title: object.name,
        required: object.primaryKeys,
        properties: Object.fromEntries(
          object.primaryKeys.map((key) => {
            const property = object.dataProperties.find((item) => item.name === key);
            return [key, { ...valueSchema(property?.type), title: property?.displayName || key }];
          }),
        ),
      };
    };
    const parameters = detail.executionConfig.parameters.filter(
      (item) => item.valueFrom === "input",
    );
    if (parameters.length) {
      fields.dynamic_params = {
        type: "object",
        properties: Object.fromEntries(
          parameters.map((item) => [item.name, valueSchema(item.type)]),
        ),
        required: parameters.map((item) => item.name),
      };
      required.push("dynamic_params");
    }
    if (detail.operationConfig.type === "relation") {
      const relationId = detail.operationConfig.relationTypeId;
      const relation = (mockRelationTypes[networkId] ?? []).find((item) => item.id === relationId);
      if (!relation) throw new Error("Relation is unavailable");
      fields.relation_target = {
        type: "object",
        properties: {
          source_identity: identity(relation.sourceObjectTypeId),
          target_identity: identity(relation.targetObjectTypeId),
        },
        required: ["source_identity", "target_identity"],
      };
      required.push("relation_target");
    } else if (detail.operationConfig.type === "object") {
      if (detail.actionKind === "create") {
        const object = buildMockObjectTypeDetail(networkId, detail.objectTypeId);
        fields.object_input = {
          type: "object",
          title: object?.name,
          properties: Object.fromEntries(
            (object?.dataProperties ?? []).map((item) => [
              item.name,
              { ...valueSchema(item.type), title: item.displayName || item.name },
            ]),
          ),
        };
      } else {
        fields._instance_identities = {
          type: "array",
          minItems: 1,
          items: identity(detail.objectTypeId),
        };
        required.push("_instance_identities");
      }
    }
    return { type: "object", properties: fields, required };
  }
  const response = await http.post<{ execution_schema?: ActionExecutionSchema }>(
    `/ontology-query/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
    {},
    { headers: { "x-http-method-override": "GET" }, params: await resolveKnReadParams(networkId) },
  );
  if (
    response.data.execution_schema?.type !== "object" ||
    !response.data.execution_schema.properties
  ) {
    throw new Error("Action execution schema is unavailable");
  }
  return response.data.execution_schema;
}

export async function executeKnowledgeNetworkActionTypeNow(
  networkId: string,
  actionTypeId: string,
  input: ActionExecutionInput = {},
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
    `/ontology-query/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}/execute`,
    input,
    {
      headers: { "Content-Type": "application/json" },
      params: await resolveKnReadParams(networkId),
      transformRequest: [transformPrecisionSafeJSONRequest],
    },
  );

  return response.data;
}

export async function cancelKnowledgeNetworkActionTypeExecution(networkId: string, logId: string) {
  if (useMock) {
    cancelMockActionTypeExecutionLog(networkId, logId);
    await wait(undefined);
    return;
  }

  await http.post(`/ontology-query/v1/knowledge-networks/${networkId}/action-logs/${logId}/cancel`);
}

export async function createKnowledgeNetworkActionType(
  networkId: string,
  input: KnowledgeNetworkActionTypeMutationPayload,
) {
  requireActionOperation(input);
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
      operationConfig: input.operationConfig ? { ...input.operationConfig } : undefined,
      objectTypeId: input.objectTypeId,
      objectTypeName: relatedObject?.name ?? input.objectTypeId,
      tags: input.tags,
      ...withMockDefinitionDeclarations(undefined, input.definitionDeclarationEdit),
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
    // The form shows the refusal itself, with the definitions it names.
    {
      headers: { "Content-Type": "application/json" },
      skipErrorToast: true,
      transformRequest: [transformPrecisionSafeJSONRequest],
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
  requireActionOperation(input);
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
            ...(input.operationConfig ? { operationConfig: { ...input.operationConfig } } : {}),
            objectTypeId: input.objectTypeId,
            objectTypeName: relatedObject?.name ?? input.objectTypeId,
            tags: input.tags,
            ...withMockDefinitionDeclarations(item.declarations, input.definitionDeclarationEdit),
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
    {
      headers: { "Content-Type": "application/json" },
      skipErrorToast: true,
      transformRequest: [transformPrecisionSafeJSONRequest],
    },
  );

  const record = unwrapSingleEntryResponse(response.data);
  return isBackendActionTypeRecord(record)
    ? mapActionType(record)
    : getKnowledgeNetworkActionType(networkId, actionTypeId);
}

export async function deleteKnowledgeNetworkActionType(networkId: string, actionTypeId: string) {
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

  try {
    await http.delete(
      `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
      // The caller shows the refusal, with the definitions that still name this one.
      { skipErrorToast: true },
    );
  } catch (error) {
    throwIfStillReferenced(error, { id: actionTypeId, kind: "action_type" });
    throw error;
  }
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
