/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ActionTypeActionSource,
  ActionTypeCondition,
  ActionTypeExecutionConfig,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";

const JSON_CONSTANT_TYPES = new Set([
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
]);

export function parseActionConstantValue(type: string | undefined, value: string): unknown {
  const normalizedType = type?.toLowerCase() ?? "";
  if (!JSON_CONSTANT_TYPES.has(normalizedType)) return value;
  const text = value.trim();
  if (["integer", "int", "int32", "int64", "long"].includes(normalizedType)) {
    if (!/^-?(?:0|[1-9]\d*)$/.test(text)) throw new Error("Expected an integer");
  } else if (["number", "double", "float"].includes(normalizedType)) {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text))
      throw new Error("Expected a number");
  }
  const parsed: unknown = parsePrecisionPreservingJSON(text);
  if (["boolean", "bool"].includes(normalizedType) && typeof parsed !== "boolean")
    throw new Error("Expected a boolean");
  if (normalizedType === "array" && !Array.isArray(parsed)) throw new Error("Expected an array");
  if (
    normalizedType === "object" &&
    (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
  )
    throw new Error("Expected an object");
  return parsed;
}

export function isInvalidActionConstantValue(type: string | undefined, value: string): boolean {
  if (!value.trim()) return true;
  try {
    parseActionConstantValue(type, value);
    return false;
  } catch {
    return true;
  }
}

export function firstInvalidActionConstantParameter(
  parameters: ActionTypeExecutionParameter[],
): string | null {
  const invalid = parameters.find(
    (item) =>
      (item.valueFrom ?? "input") === "const" &&
      isInvalidActionConstantValue(item.type, item.value ?? ""),
  );
  return invalid?.name.trim() || null;
}

export function createEmptyExecutionParameter(): ActionTypeExecutionParameter {
  return {
    name: "",
    value: "",
    valueFrom: "input",
  };
}

export function createDefaultActionTypeExecutionConfig(): ActionTypeExecutionConfig {
  return {
    parameters: [],
    sourceName: "",
    sourceType: "tool",
  };
}

export function cloneActionTypeExecutionConfig(
  config: ActionTypeExecutionConfig,
): ActionTypeExecutionConfig {
  return {
    actionSource: config.actionSource ? { ...config.actionSource } : undefined,
    parameters: config.parameters.map((item) => ({ ...item })),
    sourceName: config.sourceName,
    sourceType: config.sourceType,
  };
}

export function getActionSourceDisplayName(actionSource?: ActionTypeActionSource): string {
  if (!actionSource) {
    return "";
  }

  if (actionSource.type === "manual") {
    return actionSource.toolName?.trim() ?? "";
  }

  const containerName =
    actionSource.boxName || actionSource.mcpName || actionSource.boxId || actionSource.mcpId || "";
  const toolName = actionSource.toolName?.trim() || actionSource.toolId || "";

  if (containerName && toolName) {
    return `${containerName}/${toolName}`;
  }

  return toolName || containerName;
}

export function getReadableActionSourceDisplayName(actionSource?: ActionTypeActionSource): string {
  if (!actionSource) {
    return "";
  }

  if (actionSource.type === "manual") {
    return actionSource.toolName?.trim() ?? "";
  }

  const containerName =
    actionSource.type === "mcp" ? actionSource.mcpName?.trim() : actionSource.boxName?.trim();
  const toolName = actionSource.toolName?.trim();

  if (containerName && toolName) {
    return `${containerName}/${toolName}`;
  }

  return toolName || containerName || "";
}

export function isActionConditionEmpty(condition?: ActionTypeCondition | null): boolean {
  if (!condition) {
    return true;
  }

  if (condition.field && condition.operation) {
    return false;
  }

  return !(condition.subConditions?.length ?? 0);
}

export function normalizeActionTypeCondition(
  condition?: ActionTypeCondition | null,
  objectTypeId?: string,
): ActionTypeCondition | undefined {
  if (!condition || isActionConditionEmpty(condition)) {
    return undefined;
  }

  return {
    ...condition,
    objectTypeId: condition.objectTypeId || objectTypeId,
    valueFrom: condition.valueFrom ?? "const",
  };
}

export type ActionTypeExecutionValidationOptions = {
  allowEmptyParameters?: boolean;
};

export const ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY =
  "knowledgeNetwork.actionTypeExecutionToolRequired";

export const ACTION_TYPE_EXECUTION_PARAMETER_REQUIRED_KEY =
  "knowledgeNetwork.actionTypeExecutionParameterRequired";

export const ACTION_TYPE_EXECUTION_CONSTANT_INVALID_KEY =
  "knowledgeNetwork.actionTypeExecutionConstantInvalid";

export const ACTION_TYPE_EXECUTION_PROPERTY_REQUIRED_KEY =
  "knowledgeNetwork.actionTypeExecutionPropertyRequired";

export function firstUnmappedActionPropertyParameter(
  parameters: ActionTypeExecutionParameter[],
): string | null {
  const invalid = parameters.find(
    (item) =>
      item.name.trim() &&
      item.valueFrom === "property" &&
      !(item.value?.trim() || item.sourcePropertyName?.trim()),
  );
  return invalid?.name.trim() || null;
}

export function validateActionTypeExecutionConfig(
  value: ActionTypeExecutionConfig,
  options: ActionTypeExecutionValidationOptions = {},
): string | null {
  const sourceLabel = getActionSourceDisplayName(value.actionSource) || value.sourceName.trim();

  if (!sourceLabel) {
    return ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY;
  }

  const validParameters = value.parameters.filter((item) => {
    if (!item.name.trim()) {
      return false;
    }

    const valueFrom = item.valueFrom ?? "input";
    if (
      valueFrom === "input" ||
      valueFrom === "source_identity" ||
      valueFrom === "target_identity"
    ) {
      return true;
    }

    return Boolean(item.value?.trim() || item.sourcePropertyName?.trim());
  });

  if (firstInvalidActionConstantParameter(value.parameters)) {
    return ACTION_TYPE_EXECUTION_CONSTANT_INVALID_KEY;
  }

  if (firstUnmappedActionPropertyParameter(value.parameters)) {
    return ACTION_TYPE_EXECUTION_PROPERTY_REQUIRED_KEY;
  }

  if (validParameters.length === 0 && !options.allowEmptyParameters) {
    return ACTION_TYPE_EXECUTION_PARAMETER_REQUIRED_KEY;
  }

  return null;
}

export function normalizeActionTypeExecutionConfig(
  value: ActionTypeExecutionConfig,
): ActionTypeExecutionConfig {
  const actionSource = value.actionSource
    ? {
        ...value.actionSource,
        toolName: value.actionSource.toolName?.trim(),
      }
    : undefined;
  const sourceName = getActionSourceDisplayName(actionSource) || value.sourceName.trim();
  const parameters = value.parameters
    .filter((item) => {
      if (!item.name.trim()) {
        return false;
      }

      const valueFrom = item.valueFrom ?? "input";
      if (
        valueFrom === "input" ||
        valueFrom === "source_identity" ||
        valueFrom === "target_identity"
      ) {
        return true;
      }

      return Boolean(item.value?.trim() || item.sourcePropertyName?.trim());
    })
    .map((item) => {
      const valueFrom = item.valueFrom ?? "input";
      const resolvedValue = item.value || item.sourcePropertyName || "";

      return {
        description: item.description,
        name: item.name.trim(),
        source: item.source,
        sourcePropertyName: valueFrom === "property" ? resolvedValue : "",
        type: item.type,
        value:
          valueFrom === "input" ||
          valueFrom === "source_identity" ||
          valueFrom === "target_identity"
            ? undefined
            : resolvedValue,
        valueFrom,
      };
    });

  return {
    actionSource,
    parameters: parameters.length > 0 ? parameters : [],
    sourceName,
    sourceType: actionSource?.type ?? value.sourceType,
  };
}
