/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ActionTypeActionSource,
  ActionTypeAffect,
  ActionTypeCondition,
  ActionTypeConditionOperation,
  ActionTypeDetail,
  ActionTypeExecutionConfig,
  ActionTypeExecutionParameter,
  ActionTypeSourceKind,
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkActionTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";

import {
  createDefaultActionTypeExecutionConfig,
  getActionSourceDisplayName,
} from "@/modules/knowledge-network/utils/action-type-execution";

export type BackendActionCondition = {
  field?: string;
  object_type_id?: string;
  operation?: ActionTypeConditionOperation;
  sub_conditions?: BackendActionCondition[];
  value?: string | string[];
  value_from?: "const";
};

export type BackendActionAffect = {
  comment?: string;
  object_type_id?: string;
};

export type BackendActionSource = {
  box_id?: string;
  mcp_id?: string;
  tool_id?: string;
  tool_name?: string;
  type?: "tool" | "mcp" | "manual";
};

export type BackendActionParameter = {
  name: string;
  value?: string;
  value_from?: "property" | "input" | "const";
};

export type BackendActionTypeCreateEntry = {
  action_source?: BackendActionSource;
  action_type: "add" | "modify" | "delete" | "notify";
  affect?: BackendActionAffect;
  branch: "main";
  color?: string;
  comment?: string;
  condition?: BackendActionCondition;
  id?: string;
  name: string;
  object_type_id: string;
  parameters?: BackendActionParameter[];
  tags?: string[];
};

export type BackendActionTypeUpdatePayload = BackendActionTypeCreateEntry;

import type { BackendActionType } from "./backend-types";

export function toBackendActionTypeEnum(
  actionKind: KnowledgeNetworkActionTypeKind,
): BackendActionTypeCreateEntry["action_type"] {
  switch (actionKind) {
    case "update":
      return "modify";
    case "delete":
      return "delete";
    case "notify":
      return "notify";
    case "create":
    default:
      return "add";
  }
}

function toBackendActionCondition(
  condition?: ActionTypeCondition,
): BackendActionCondition | undefined {
  if (!condition?.field || !condition.operation) {
    return undefined;
  }

  return {
    field: condition.field,
    object_type_id: condition.objectTypeId,
    operation: condition.operation,
    sub_conditions: condition.subConditions?.map((item) => toBackendActionCondition(item)!),
    value: condition.value,
    value_from: condition.valueFrom ?? "const",
  };
}

function toBackendActionAffect(affect?: ActionTypeAffect): BackendActionAffect | undefined {
  if (!affect?.objectTypeId && !affect?.comment?.trim()) {
    return undefined;
  }

  return {
    comment: affect.comment?.trim() || undefined,
    object_type_id: affect.objectTypeId,
  };
}

function toBackendActionSource(
  actionSource?: ActionTypeActionSource,
): BackendActionSource | undefined {
  if (!actionSource) {
    return undefined;
  }

  if (actionSource.type === "manual") {
    return actionSource.toolName
      ? {
          tool_name: actionSource.toolName,
          type: "manual",
        }
      : undefined;
  }

  if (actionSource.type === "mcp") {
    return actionSource.mcpId && actionSource.toolName
      ? {
          mcp_id: actionSource.mcpId,
          tool_name: actionSource.toolName,
          type: "mcp",
        }
      : undefined;
  }

  return actionSource.boxId && actionSource.toolId
    ? {
        box_id: actionSource.boxId,
        tool_id: actionSource.toolId,
        type: "tool",
      }
    : undefined;
}

function toBackendActionParameters(
  parameters?: ActionTypeExecutionParameter[],
): BackendActionParameter[] | undefined {
  const nextParameters = (parameters ?? [])
    .map((item) => {
      const valueFrom = item.valueFrom ?? "input";
      const value =
        valueFrom === "property"
          ? item.value ?? item.sourcePropertyName ?? ""
          : item.value;

      return {
        name: item.name.trim(),
        value: valueFrom === "input" ? undefined : value,
        value_from: valueFrom,
      };
    })
    .filter(
      (item) =>
        item.name.length > 0 &&
        (item.value_from === "input" || Boolean(item.value?.trim())),
    );

  return nextParameters.length > 0 ? nextParameters : undefined;
}

function mapActionSourceKind(type?: BackendActionSource["type"]): ActionTypeSourceKind {
  switch (type) {
    case "mcp":
      return "mcp";
    case "manual":
      return "manual";
    case "tool":
    default:
      return "tool";
  }
}

function mapActionTypeActionSourceFromBackend(
  actionSource?: BackendActionSource,
): ActionTypeActionSource | undefined {
  if (!actionSource) {
    return undefined;
  }

  return {
    boxId: actionSource.box_id,
    mcpId: actionSource.mcp_id,
    toolId: actionSource.tool_id,
    toolName: actionSource.tool_name,
    type: mapActionSourceKind(actionSource.type),
  };
}

function mapActionTypeConditionFromBackend(
  condition?: BackendActionType["condition"],
): ActionTypeCondition | undefined {
  if (!condition) {
    return undefined;
  }

  if (!condition.field && !(condition.sub_conditions?.length ?? 0)) {
    return undefined;
  }

  return {
    field: condition.field,
    objectTypeId: condition.object_type_id,
    operation: condition.operation as ActionTypeConditionOperation | undefined,
    subConditions: condition.sub_conditions
      ?.map((item) => mapActionTypeConditionFromBackend(item))
      .filter((item): item is ActionTypeCondition => Boolean(item)),
    value: condition.value,
    valueFrom: condition.value_from ?? "const",
  };
}

function mapActionTypeAffectFromBackend(
  affect?: BackendActionType["affect"],
): ActionTypeAffect | undefined {
  if (!affect?.object_type_id && !affect?.comment) {
    return undefined;
  }

  return {
    comment: affect.comment,
    objectTypeId: affect.object_type_id,
  };
}

export function mapActionTypeExecutionConfigFromBackend(
  item: Pick<BackendActionType, "action_source" | "parameters">,
): ActionTypeExecutionConfig {
  const actionSource = mapActionTypeActionSourceFromBackend(item.action_source);
  const parameters = (item.parameters ?? [])
    .filter((entry) => entry.name)
    .map((entry) => ({
      name: entry.name,
      sourcePropertyName: entry.value_from === "property" ? entry.value ?? "" : "",
      value: entry.value,
      valueFrom: entry.value_from ?? "input",
    }));

  const sourceName = getActionSourceDisplayName(actionSource);

  if (parameters.length === 0 && !sourceName) {
    return createDefaultActionTypeExecutionConfig();
  }

  return {
    actionSource,
    parameters,
    sourceName,
    sourceType: actionSource?.type ?? "tool",
  };
}

export function mapActionTypeDetail(item: BackendActionType): ActionTypeDetail {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color ?? "#16a34a",
    actionKind: mapActionKindFromBackend(item.action_type),
    objectTypeId: item.object_type_id ?? item.object_type?.id ?? "",
    objectTypeName: item.object_type?.name ?? item.object_type_id ?? "-",
    tags: item.tags ?? [],
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
    affect: mapActionTypeAffectFromBackend(item.affect),
    condition: mapActionTypeConditionFromBackend(item.condition),
    executionConfig: mapActionTypeExecutionConfigFromBackend(item),
  };
}

function mapActionKindFromBackend(
  value?: BackendActionType["action_type"],
): KnowledgeNetworkActionTypeKind {
  switch (value) {
    case "modify":
    case "UPDATE":
      return "update";
    case "delete":
    case "DELETE":
      return "delete";
    case "notify":
    case "NOTIFY":
      return "notify";
    case "add":
    case "ADD":
    default:
      return "create";
  }
}

export function toBackendActionTypeCreateEntry(
  input: KnowledgeNetworkActionTypeMutationPayload,
): BackendActionTypeCreateEntry {
  const executionConfig = input.executionConfig;

  return {
    action_source: toBackendActionSource(executionConfig?.actionSource),
    action_type: toBackendActionTypeEnum(input.actionKind),
    affect: toBackendActionAffect(input.affect),
    branch: "main",
    color: input.color,
    comment: input.description,
    condition: toBackendActionCondition(input.condition),
    id: input.id?.trim() || undefined,
    name: input.name,
    object_type_id: input.objectTypeId,
    parameters: toBackendActionParameters(executionConfig?.parameters),
    tags: input.tags,
  };
}

export function toBackendActionTypeUpdatePayload(
  input: KnowledgeNetworkActionTypeMutationPayload,
): BackendActionTypeUpdatePayload {
  return toBackendActionTypeCreateEntry(input);
}
