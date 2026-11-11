/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ActionTypeOperationConfig,
  ActionTypeOperationKind,
  KnowledgeNetworkActionTypeRecord,
} from "../types/action-type";
import type { ActionTypeExecutionParameter } from "../types/action-type";
import type { ObjectTypeDetail } from "../types/object-type";
import type { KnowledgeNetworkRelationTypeRecord } from "../types/relation-type";
import { transformConditionFieldType } from "../constants/action-type-condition";
import {
  toBackendActionCondition,
  mapActionTypeConditionFromBackend,
  type BackendActionCondition,
} from "./action-type-condition";

export function getActionRelationAnchor(
  relation: Pick<KnowledgeNetworkRelationTypeRecord, "sourceObjectTypeId" | "targetObjectTypeId">,
  objectTypeId: string,
): "source" | "target" | undefined {
  const source = relation.sourceObjectTypeId === objectTypeId;
  const target = relation.targetObjectTypeId === objectTypeId;
  return source === target ? undefined : source ? "source" : "target";
}

export type ActionRelationIdentity = {
  objectTypeId: string;
  objectTypeName: string;
  properties: { name: string; label: string; type: string }[];
};

export type ActionRelationBindingContext = {
  relation: KnowledgeNetworkRelationTypeRecord | null;
};

export type ActionRelationTableContext = {
  sourceIdentity?: ActionRelationIdentity;
  targetIdentity?: ActionRelationIdentity;
};

export function getActionRelationIdentity(detail: ObjectTypeDetail): ActionRelationIdentity {
  const keys =
    detail.primaryKeys ??
    detail.dataProperties
      .filter((property) => property.primaryKey)
      .map((property) => property.name);
  const properties = keys.flatMap((name) => {
    const property = detail.dataProperties.find((item) => item.name === name);
    return property ? [{ name, label: property.displayName || name, type: property.type }] : [];
  });
  return {
    objectTypeId: detail.id,
    objectTypeName: detail.name,
    properties: properties.length === keys.length ? properties : [],
  };
}

export function canBindActionRelationIdentity(
  identity: ActionRelationIdentity | undefined,
  parameterType?: string,
) {
  if (identity?.properties.length !== 1) return false;
  return (
    !parameterType ||
    parameterType === "unknown" ||
    transformConditionFieldType(parameterType) ===
      transformConditionFieldType(identity.properties[0].type)
  );
}

export function inferActionRelationBindings(
  parameters: ActionTypeExecutionParameter[],
  context: ActionRelationTableContext,
): ActionTypeExecutionParameter[] {
  const match = (identity?: ActionRelationIdentity) => {
    if (identity?.properties.length !== 1) return undefined;
    const matches = parameters.filter(
      (parameter) =>
        (parameter.valueFrom ?? "input") === "input" &&
        parameter.name === identity.properties[0].name &&
        canBindActionRelationIdentity(identity, parameter.type),
    );
    return matches.length === 1 ? matches[0].name : undefined;
  };
  const source = parameters.some((item) => item.valueFrom === "source_identity")
    ? undefined
    : match(context.sourceIdentity);
  const target = parameters.some((item) => item.valueFrom === "target_identity")
    ? undefined
    : match(context.targetIdentity);
  if (source === target) return parameters;
  return parameters.map((parameter) =>
    parameter.name === source
      ? {
          ...parameter,
          valueFrom: "source_identity",
          value: undefined,
          sourcePropertyName: undefined,
        }
      : parameter.name === target
        ? {
            ...parameter,
            valueFrom: "target_identity",
            value: undefined,
            sourcePropertyName: undefined,
          }
        : parameter,
  );
}

export function validateActionRelationBindings(
  parameters: ActionTypeExecutionParameter[],
): string | null {
  if (
    !parameters.some((item) => item.valueFrom === "source_identity") ||
    !parameters.some((item) => item.valueFrom === "target_identity")
  )
    return "knowledgeNetwork.actionRelationBindingsRequired";
  return null;
}

export function readActionTypeOperationKind(value: unknown): ActionTypeOperationKind | undefined {
  return value === "object" || value === "relation" || value === "tool" ? value : undefined;
}

/** Legacy records have no operation metadata; object-free actions are tool invocations. */
export function getActionTypeOperationKind(
  record: Pick<KnowledgeNetworkActionTypeRecord, "objectTypeId" | "operationConfig">,
): ActionTypeOperationKind {
  return record.operationConfig?.type ?? (record.objectTypeId ? "object" : "tool");
}

export function actionTypeOperationLabelKey(kind: ActionTypeOperationKind): string {
  return {
    object: "knowledgeNetwork.actionOperationObject",
    relation: "knowledgeNetwork.actionOperationRelation",
    tool: "knowledgeNetwork.actionOperationTool",
  }[kind];
}

export function actionTypeSpecificOperationLabelKey(
  record: Pick<KnowledgeNetworkActionTypeRecord, "actionKind" | "objectTypeId" | "operationConfig">,
): string {
  const kind = getActionTypeOperationKind(record);
  if (kind === "tool") return "knowledgeNetwork.actionOperationExecuteTool";
  if (record.operationConfig?.type === "relation") {
    return record.operationConfig.relationOperation === "create"
      ? "knowledgeNetwork.actionRelationCreate"
      : "knowledgeNetwork.actionRelationDelete";
  }
  return {
    create: "knowledgeNetwork.actionObjectCreateInstance",
    update: "knowledgeNetwork.actionObjectUpdateInstance",
    delete: "knowledgeNetwork.actionObjectDeleteInstance",
    notify: "knowledgeNetwork.actionTypeKindNotify",
  }[record.actionKind];
}

export type BackendActionOperationConfig =
  | { type: "object" | "tool" }
  | {
      type: "relation";
      relation_type_id: string;
      relation_operation: "create" | "delete";
      anchor_role?: "source" | "target";
      other_object_condition?: BackendActionCondition;
    };

export function toBackendActionOperationConfig(
  config?: ActionTypeOperationConfig,
): BackendActionOperationConfig | undefined {
  if (!config) return undefined;
  if (config.type !== "relation") return { type: config.type };
  return {
    type: "relation",
    relation_type_id: config.relationTypeId,
    relation_operation: config.relationOperation,
    ...(config.anchorRole ? { anchor_role: config.anchorRole } : {}),
    ...(config.otherObjectCondition
      ? {
          other_object_condition: toBackendActionCondition(config.otherObjectCondition),
        }
      : {}),
  };
}

export function mapActionOperationConfig(
  config?: BackendActionOperationConfig,
): ActionTypeOperationConfig | undefined {
  if (!config) return undefined;
  if (config.type !== "relation")
    return readActionTypeOperationKind(config.type) ? { type: config.type } : undefined;
  return {
    type: "relation",
    relationTypeId: config.relation_type_id,
    relationOperation: config.relation_operation,
    ...(config.anchor_role ? { anchorRole: config.anchor_role } : {}),
    ...(config.other_object_condition
      ? {
          otherObjectCondition: mapActionTypeConditionFromBackend(config.other_object_condition),
        }
      : {}),
  };
}
