/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cypherName } from "@/modules/knowledge-network/cypher/cypher-samples";
import { cypherCode, labeledNodeVariables } from "@/modules/knowledge-network/cypher/graph-values";

/** What the editor can suggest: the network's types and each object type's properties. */
export type CypherCompletionSchema = {
  objectTypes: { id: string; name: string }[];
  relationTypes: { id: string; name: string; sourceId: string; targetId: string }[];
  /** Per object type id, its property names with their display names. */
  properties: Record<string, { name: string; displayName?: string }[]>;
};

export type CypherSuggestion = {
  kind: "label" | "relation" | "property" | "keyword" | "function";
  /** Text to insert. */
  insert: string;
  /** Shown in the list. */
  label: string;
  detail?: string;
};

export const CYPHER_KEYWORDS = [
  "MATCH",
  "OPTIONAL MATCH",
  "WHERE",
  "RETURN",
  "WITH",
  "DISTINCT",
  "ORDER BY",
  "SKIP",
  "LIMIT",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS NULL",
  "IS NOT NULL",
  "DESC",
  "ASC",
];

export const CYPHER_FUNCTIONS = ["count", "collect", "sum", "avg", "min", "max"];

/**
 * Suggestions for the text before the cursor:
 * - `(x:` → object types; `[r:` or `[:` → relation types;
 * - `x.` → the properties of x's object type, when the query labels x;
 * - otherwise keywords and functions.
 */
export function cypherSuggestions(
  textBeforeCursor: string,
  fullText: string,
  schema: CypherCompletionSchema,
): CypherSuggestion[] {
  const code = cypherCode(textBeforeCursor, { keepNames: true });
  if (/\(\s*[A-Za-z_]?\w*\s*:\s*`?[^\s:)`]*$/.test(code)) {
    return schema.objectTypes.map((item) => ({
      kind: "label",
      insert: cypherName(item.id),
      label: item.id,
      detail: item.name,
    }));
  }
  if (/\[\s*[A-Za-z_]?\w*\s*:\s*`?[^\s:\]`]*$/.test(code)) {
    return schema.relationTypes.map((item) => ({
      kind: "relation",
      insert: cypherName(item.id),
      label: item.id,
      detail: `${item.name} (${item.sourceId} → ${item.targetId})`,
    }));
  }
  const member = /([A-Za-z_]\w*)\.`?[^\s.`]*$/.exec(code);
  if (member) {
    const label = labeledNodeVariables(fullText)[member[1]];
    const otId =
      schema.objectTypes.find((item) => item.id === label)?.id ??
      schema.objectTypes.find((item) => item.name === label)?.id;
    return (otId ? (schema.properties[otId] ?? []) : []).map((property) => ({
      kind: "property",
      insert: cypherName(property.name),
      label: property.name,
      ...(property.displayName ? { detail: property.displayName } : {}),
    }));
  }
  return [
    ...CYPHER_KEYWORDS.map((keyword) => ({
      kind: "keyword" as const,
      insert: keyword,
      label: keyword,
    })),
    ...CYPHER_FUNCTIONS.map((name) => ({
      kind: "function" as const,
      insert: `${name}()`,
      label: name,
    })),
  ];
}
