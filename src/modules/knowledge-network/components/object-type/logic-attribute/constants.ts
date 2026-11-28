/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { scanCypherParameters } from "@/modules/knowledge-network/cypher/cypher-parameters";
import { cypherName } from "@/modules/knowledge-network/cypher/cypher-samples";
import type {
  ObjectTypeLogicParameter,
  ObjectTypeLogicParameterValueFrom,
} from "@/modules/knowledge-network/types/knowledge-network";

export const VALUE_FROM_OPTIONS: Array<{
  labelKey: string;
  value: ObjectTypeLogicParameterValueFrom;
}> = [
  { labelKey: "objectTypeLogicValueFromProperty", value: "property" },
  { labelKey: "objectTypeLogicValueFromInput", value: "input" },
  { labelKey: "objectTypeLogicValueFromConst", value: "const" },
];

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

/**
 * The statement a new logic property starts from: the current instance, found by its primary
 * key, and one value of it. A composite key takes one `$<key>` parameter per key.
 */
export function buildDefaultLogicStatement(input: {
  objectTypeId: string;
  primaryKeys: readonly string[];
}): string {
  const label = cypherName(input.objectTypeId || "ObjectType");
  const keys = input.primaryKeys;
  const condition =
    keys.length <= 1
      ? `n.${cypherName(keys[0] ?? "id")} = $id`
      : keys.map((key) => `n.${cypherName(key)} = $${key}`).join(" AND ");
  return `MATCH (n:${label})\nWHERE ${condition}\nRETURN n.<property> AS value`;
}

/**
 * The parameters a statement uses, each kept as the user set it when there is one. A new one named
 * like a primary key (or `id` for a single key) is bound to the key property; the rest start as
 * input.
 */
export function syncLogicParameters(input: {
  createId: () => string;
  current: ObjectTypeLogicParameter[];
  primaryKeys: readonly string[];
  statement: string;
}): ObjectTypeLogicParameter[] {
  const byName = new Map(input.current.map((item) => [item.name, item]));
  const keyFor = (name: string) => {
    if (input.primaryKeys.length === 1 && name === "id") return input.primaryKeys[0];
    return input.primaryKeys.includes(name) ? name : undefined;
  };
  return scanCypherParameters(input.statement).names.map((name): ObjectTypeLogicParameter => {
    const saved = byName.get(name);
    if (saved) return saved;
    const key = keyFor(name);
    return key
      ? { id: input.createId(), name, type: "string", value: key, valueFrom: "property" }
      : { id: input.createId(), name, type: "string", valueFrom: "input" };
  });
}

/** What is wrong with a statement before it is sent to the backend, as a message key, or null. */
export function localStatementProblem(statement: string): string | null {
  if (!statement.trim()) return "objectTypeLogicStatementRequired";
  if (scanCypherParameters(statement).positional) return "objectTypeLogicStatementPositional";
  return null;
}
