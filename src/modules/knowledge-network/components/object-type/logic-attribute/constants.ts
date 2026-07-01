/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectTypeLogicParameterValueFrom } from "@/modules/knowledge-network/types/knowledge-network";

export const LOGIC_ATTRIBUTE_TYPE_OPTIONS = [
  { labelKey: "objectTypeLogicAttributeTypeMetric", value: "metric" },
  { labelKey: "objectTypeLogicAttributeTypeOperator", value: "operator" },
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

export const FIELD_TYPE_INPUT = {
  boolean: ["boolean"],
  number: ["integer", "double", "number"],
};

export const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function isEmptyExceptZero(value: unknown) {
  return value === undefined || value === null || value === "";
}

export function deduplicateByName<T extends { name: string }>(items: T[]) {
  const map = new Map<string, T>();
  items.forEach((item) => {
    map.set(item.name, item);
  });
  return Array.from(map.values());
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
