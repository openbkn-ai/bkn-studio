import type {
  ActionTypeActionSource,
  ActionTypeCondition,
  ActionTypeExecutionConfig,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  findCatalogTool,
  flattenCatalogTools,
  MOCK_EXECUTION_FACTORY_CATALOG,
} from "@/modules/knowledge-network/services/mock/action-type-tool-catalog";

export type MockActionToolParameter = {
  name: string;
  required?: boolean;
  type?: string;
};

export type MockActionTool = {
  boxId: string;
  boxName: string;
  parameters: MockActionToolParameter[];
  toolId: string;
  toolName: string;
  type: "tool";
};

export const MOCK_ACTION_TOOLS: MockActionTool[] = flattenCatalogTools(MOCK_EXECUTION_FACTORY_CATALOG);

export function createEmptyExecutionParameter(): ActionTypeExecutionParameter {
  return {
    name: "",
    sourcePropertyName: "",
    valueFrom: "property",
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

  const containerName = actionSource.boxName || actionSource.mcpName || "";
  const toolName = actionSource.toolName?.trim() ?? "";

  if (containerName && toolName) {
    return `${containerName}/${toolName}`;
  }

  return toolName || containerName;
}

export function buildActionSourceFromMockTool(tool: MockActionTool): ActionTypeActionSource {
  return {
    boxId: tool.boxId,
    boxName: tool.boxName,
    toolId: tool.toolId,
    toolName: tool.toolName,
    type: "tool",
  };
}

export function buildParametersFromMockTool(
  tool: MockActionTool,
): ActionTypeExecutionParameter[] {
  if (tool.parameters.length === 0) {
    return [createEmptyExecutionParameter()];
  }

  return tool.parameters.map((item) => ({
    name: item.name,
    sourcePropertyName: "",
    valueFrom: "property" as const,
  }));
}

export function buildMockToolFromSelection(
  source: ActionTypeActionSource,
  parameters: MockActionToolParameter[],
): MockActionTool {
  return {
    boxId: source.boxId ?? source.mcpId ?? "",
    boxName: source.boxName ?? source.mcpName ?? "",
    parameters,
    toolId: source.toolId ?? "",
    toolName: source.toolName ?? "",
    type: "tool",
  };
}

export function findMockActionTool(
  actionSource?: ActionTypeActionSource,
): MockActionTool | undefined {
  const resolved = findCatalogTool(MOCK_EXECUTION_FACTORY_CATALOG, actionSource);
  if (!resolved || !actionSource?.toolId) {
    return undefined;
  }

  return {
    boxId: actionSource.boxId ?? actionSource.mcpId ?? "",
    boxName: actionSource.boxName ?? actionSource.mcpName ?? "",
    parameters: resolved.parameters.map((item) => ({ ...item })),
    toolId: actionSource.toolId,
    toolName: actionSource.toolName ?? resolved.tool.toolName,
    type: "tool",
  };
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

  const validParameters = value.parameters.filter(
    (item) => item.name.trim() && item.sourcePropertyName,
  );

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
    .filter((item) => item.name.trim() && item.sourcePropertyName)
    .map((item) => ({
      name: item.name.trim(),
      sourcePropertyName: item.sourcePropertyName,
      valueFrom: "property" as const,
    }));

  return {
    actionSource,
    parameters: parameters.length > 0 ? parameters : [createEmptyExecutionParameter()],
    sourceName,
    sourceType: actionSource?.type ?? value.sourceType,
  };
}
