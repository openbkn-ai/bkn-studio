/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeLogicParameter,
  ObjectTypeLogicParameterValueFrom,
} from "@/modules/knowledge-network/types/knowledge-network";

import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";

export const LOGIC_ATTRIBUTE_TYPE_OPTIONS = [
  { labelKey: "objectTypeLogicAttributeTypeTool", value: "tool" },
] as const;

export const VALUE_FROM_OPTIONS: Array<{
  labelKey: string;
  value: ObjectTypeLogicParameterValueFrom;
}> = [
  { labelKey: "objectTypeLogicValueFromProperty", value: "property" },
  { labelKey: "objectTypeLogicValueFromInput", value: "input" },
  { labelKey: "objectTypeLogicValueFromConst", value: "const" },
];

export const OPERATOR_TYPE_OPTIONS = [{ label: "==", value: "==" }];

export const PARAMETER_SOURCE_OPTIONS = [
  { labelKey: "objectTypeLogicParameterSourceHeader", value: "header" },
  { labelKey: "objectTypeLogicParameterSourceQuery", value: "query" },
  { labelKey: "objectTypeLogicParameterSourceBody", value: "body" },
  { labelKey: "objectTypeLogicParameterSourcePath", value: "path" },
];

export const FIELD_TYPE_INPUT = {
  boolean: ["boolean"],
  number: ["integer", "double", "number"],
};

export const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function isEmptyExceptZero(value: unknown) {
  return value === undefined || value === null || value === "";
}

export function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export type LogicAttributeToolBinding = {
  boxId?: string;
  resourceName?: string;
  toolId?: string;
};

/**
 * Read tool binding from Ant Design form values.
 * Callers must pass values that include unregistered store fields
 * (`getFieldsValue(true)` or registered hidden `Form.Item`s). Default
 * `getFieldsValue()` omits `boxId`/`toolId` and looks like a silent no-op submit.
 */
export function readLogicAttributeToolBinding(
  formValues: Record<string, unknown>,
): LogicAttributeToolBinding {
  return {
    boxId: asOptionalString(formValues.boxId),
    resourceName: asOptionalString(formValues.resourceName),
    toolId: asOptionalString(formValues.toolId),
  };
}

export function isToolLogicBindingComplete(binding: LogicAttributeToolBinding) {
  return Boolean(binding.boxId && binding.toolId);
}

export function deduplicateByName<T extends { name: string }>(items: T[]) {
  const map = new Map<string, T>();
  items.forEach((item) => {
    map.set(item.name, item);
  });
  return Array.from(map.values());
}

export function removeParameterById<T extends { children?: T[]; id: string }>(
  items: T[],
  id: string,
): T[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) =>
      item.children?.length
        ? { ...item, children: removeParameterById(item.children, id) }
        : item,
    );
}

export function extractLeafParams<T extends { children?: T[] }>(items: T[]): T[] {
  const leafParams: T[] = [];

  const traverse = (nodes: T[]) => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        traverse(node.children);
      } else {
        leafParams.push(node);
      }
    });
  };

  traverse(items);
  return leafParams;
}

export function buildToolLogicParameterSettings(
  schema: ActionTypeToolInputParam[],
  saved: ObjectTypeLogicParameter[] = [],
  createId: () => string,
): ObjectTypeLogicParameter[] {
  if (schema.length === 0) {
    return saved.map((item) => ({
      ...item,
      id: item.id || createId(),
      valueFrom: item.valueFrom ?? "input",
    }));
  }

  const savedByName = new Map(saved.map((item) => [item.name, item]));

  const buildNode = (node: ActionTypeToolInputParam): ObjectTypeLogicParameter => {
    const matched = savedByName.get(node.key);

    return {
      children: node.children?.length ? node.children.map(buildNode) : undefined,
      description: node.description,
      id: matched?.id || createId(),
      name: node.key,
      source: node.source,
      type: node.type,
      value: matched?.value,
      valueFrom: matched?.valueFrom ?? "input",
    };
  };

  return schema.map(buildNode);
}
