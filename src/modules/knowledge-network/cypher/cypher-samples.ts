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
