/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Sample queries the schema panel runs for one object type or relation type. */

/** Quotes a label or relationship type unless it is a plain identifier. */
export function cypherName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `\`${name.replace(/`/g, "``")}\``;
}

export function objectTypeSample(objectTypeId: string): string {
  return `MATCH (n:${cypherName(objectTypeId)}) RETURN n LIMIT 25`;
}

export function relationTypeSample(relation: {
  id: string;
  sourceId: string;
  targetId: string;
}): string {
  return `MATCH (a:${cypherName(relation.sourceId)})-[r:${cypherName(relation.id)}]->(b:${cypherName(relation.targetId)}) RETURN a, r, b LIMIT 25`;
}

/** A value as a Cypher literal: strings escape `\\` and `'` with a backslash, as run_cypher reads them. */
export function cypherLiteral(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  return null;
}

/** The query that reads one node back by its key, or null when a key value has no literal. */
export function nodeLookupQuery(objectTypeId: string, key: Record<string, unknown>): string | null {
  const conditions: string[] = [];
  for (const [name, value] of Object.entries(key)) {
    const literal = cypherLiteral(value);
    if (literal === null) return null;
    conditions.push(`n.${cypherName(name)} = ${literal}`);
  }
  if (conditions.length === 0) return null;
  return `MATCH (n:${cypherName(objectTypeId)}) WHERE ${conditions.join(" AND ")} RETURN n LIMIT 1`;
}
