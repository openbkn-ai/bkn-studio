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

/** How many properties a sample returns per node in place of the node. */
export const SAMPLE_PROPERTIES = 8;

/** One node's columns: `variable.property AS prefix_property`, at most `limit` of them. */
function propertyColumns(variable: string, properties: readonly string[], limit: number): string[] {
  return properties
    .slice(0, limit)
    .map((name) => `${variable}.${cypherName(name)} AS ${cypherName(`${variable}_${name}`)}`);
}

/**
 * The object type sample with properties in place of the node, for object types whose data
 * cannot be returned as nodes (a dataset or an index). Without known properties it counts.
 */
export function objectTypePropertySample(
  objectTypeId: string,
  properties: readonly string[],
): string {
  const columns = propertyColumns("n", properties, SAMPLE_PROPERTIES);
  if (columns.length === 0) return `MATCH (n:${cypherName(objectTypeId)}) RETURN count(*) AS total`;
  return `MATCH (n:${cypherName(objectTypeId)}) RETURN ${columns.join(", ")} LIMIT 25`;
}

/** The relation type sample with the two ends' properties in place of nodes and the relationship. */
export function relationTypePropertySample(
  relation: { id: string; sourceId: string; targetId: string },
  sourceProperties: readonly string[],
  targetProperties: readonly string[],
): string {
  const half = SAMPLE_PROPERTIES / 2;
  const columns = [
    ...propertyColumns("a", sourceProperties, half),
    ...propertyColumns("b", targetProperties, half),
  ];
  const pattern = `MATCH (a:${cypherName(relation.sourceId)})-[:${cypherName(relation.id)}]->(b:${cypherName(relation.targetId)})`;
  if (columns.length === 0) return `${pattern} RETURN count(*) AS total`;
  return `${pattern} RETURN ${columns.join(", ")} LIMIT 25`;
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
