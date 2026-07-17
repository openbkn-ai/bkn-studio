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

export function validateActionTypeExecutionConfig(
  t: (key: string) => string,
  value: ActionTypeExecutionConfig,
): string | null {
  const sourceLabel =
    getActionSourceDisplayName(value.actionSource) || value.sourceName.trim();

  if (!sourceLabel) {
    return t("knowledgeNetwork.actionTypeExecutionSourceNameRequired");
  }

  const validParameters = value.parameters.filter((item) => {
    if (!item.name.trim()) {
      return false;
    }

    const valueFrom = item.valueFrom ?? "input";
    if (valueFrom === "input") {
      return true;
    }

    return Boolean(item.value?.trim() || item.sourcePropertyName?.trim());
  });

  if (validParameters.length === 0) {
    return t("knowledgeNetwork.actionTypeExecutionParameterRequired");
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
  const sourceName =
    getActionSourceDisplayName(actionSource) || value.sourceName.trim();
  const parameters = value.parameters
    .filter((item) => {
      if (!item.name.trim()) {
        return false;
      }

      const valueFrom = item.valueFrom ?? "input";
      if (valueFrom === "input") {
        return true;
      }

      return Boolean(item.value?.trim() || item.sourcePropertyName?.trim());
    })
    .map((item) => {
      const valueFrom = item.valueFrom ?? "input";
      const resolvedValue = item.value ?? item.sourcePropertyName ?? "";

      return {
        description: item.description,
        name: item.name.trim(),
        source: item.source,
        sourcePropertyName: valueFrom === "property" ? resolvedValue : "",
        type: item.type,
        value: valueFrom === "input" ? undefined : resolvedValue,
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
