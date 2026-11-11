/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";

import type {
  ActionTypeActionSource,
  ActionTypeAffect,
  ActionTypeDetail,
  ActionTypeExecutionConfig,
  ActionTypeExecutionParameter,
  ActionTypeSourceKind,
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeMutationPayload,
} from "@/modules/knowledge-network/types/knowledge-network";

import {
  mapActionOperationConfig,
  toBackendActionOperationConfig,
  type BackendActionOperationConfig,
} from "../../utils/action-type-operation";

import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";

import {
  createDefaultActionTypeExecutionConfig,
  getActionSourceDisplayName,
} from "@/modules/knowledge-network/utils/action-type-execution";
import {
  toBackendActionCondition,
  mapActionTypeConditionFromBackend,
  type BackendActionCondition,
} from "@/modules/knowledge-network/utils/action-type-condition";
export type { BackendActionCondition } from "@/modules/knowledge-network/utils/action-type-condition";

export type BackendActionAffect = {
  comment?: string;
  object_type_id?: string;
};

export type BackendActionSource = {
  box_id?: string;
  box_name?: string;
  mcp_id?: string;
  mcp_name?: string;
  tool_id?: string;
  tool_name?: string;
  type?: "tool" | "mcp" | "manual";
};

export type BackendActionParameter = {
  name: string;
  type?: string;
  value?: unknown;
  value_from?: "property" | "input" | "const" | "source_identity" | "target_identity";
};

export type BackendActionTypeCreateEntry = BackendDefinitionDeclarationFields & {
  operation_config?: BackendActionOperationConfig;
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
import {
  type BackendDefinitionDeclarationFields,
  definitionDeclarationPatch,
  mapDefinitionDeclarations,
} from "./declarations";

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
  const result = (parameters ?? [])
    .filter((item) => item.name.trim())
    .map((item) => {
      const source = item.valueFrom ?? "input";
      let value: unknown;
      if (source === "property") value = item.value ?? item.sourcePropertyName;
      if (source === "const") {
        value = item.value;
        if (
          typeof value === "string" &&
          [
            "boolean",
            "bool",
            "integer",
            "int",
            "int32",
            "int64",
            "long",
            "number",
            "double",
            "float",
            "array",
            "object",
          ].includes(item.type?.toLowerCase() ?? "")
        ) {
          value = parsePrecisionPreservingJSON(value);
        }
      }
      return { name: item.name.trim(), type: item.type, value_from: source, value };
    });
  return result.length ? result : undefined;
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

export function mapActionTypeActionSourceFromBackend(
  actionSource?: BackendActionSource,
): ActionTypeActionSource | undefined {
  if (!actionSource) {
    return undefined;
  }

  return {
    boxId: actionSource.box_id,
    boxName: actionSource.box_name,
    mcpId: actionSource.mcp_id,
    mcpName: actionSource.mcp_name,
    toolId: actionSource.tool_id,
    toolName: actionSource.tool_name,
    type: mapActionSourceKind(actionSource.type),
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
      type: entry.type,
      sourcePropertyName:
        entry.value_from === "property" && typeof entry.value === "string" ? entry.value : "",
      value:
        entry.value === undefined
          ? undefined
          : typeof entry.value === "string"
            ? entry.value
            : transformPrecisionSafeJSONRequest(entry.value),
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
  const declarations = mapDefinitionDeclarations(item);
  return {
    ...(declarations ? { declarations } : {}),
    id: item.id,
    ...(item.operation_config
      ? { operationConfig: mapActionOperationConfig(item.operation_config) }
      : {}),
    name: item.name,
    description: item.comment ?? "",
    color: item.color ?? "#16a34a",
    actionKind: mapActionKindFromBackend(item.action_type),
    objectTypeId: item.object_type_id ?? item.object_type?.id ?? "",
    objectTypeName: item.object_type?.name ?? item.object_type_id ?? "-",
    operations: item.operations,
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
    ...(input.operationConfig
      ? { operation_config: toBackendActionOperationConfig(input.operationConfig) }
      : {}),
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
    ...(input.definitionDeclarationEdit
      ? definitionDeclarationPatch(
          input.definitionDeclarationEdit.current,
          input.definitionDeclarationEdit.baseline,
        )
      : {}),
  };
}

export function toBackendActionTypeUpdatePayload(
  input: KnowledgeNetworkActionTypeMutationPayload,
): BackendActionTypeUpdatePayload {
  return toBackendActionTypeCreateEntry(input);
}
