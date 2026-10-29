/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  LABEL_CHAIN,
  buildInstanceId,
  identityKey,
  isLabelTemplate,
  pickDisplay,
  templateProperties,
} from "@/modules/knowledge-network/lib/instance-label";

import {
  MAX_CYPHER_LIMIT,
  quoteIdentifier,
  type CypherQuery,
  type ObjectTypeMeta,
} from "./overview.service";

/*
 * Queries of the network overview. Every query reads only the
 * primary keys and the properties a name is made of, so ten thousand rows stay small.
 */

type Rec = Record<string, unknown>;

/** One instance as the overview draws it: no properties beyond the ones its name needs. */
export type OverviewNode = {
  /** The instance id ontology-query gives (`<object type>-<key>`), so a hand-over finds the same instance. */
  id: string;
  otId: string;
  identity: Rec;
  display: string;
};

export type OverviewEdge = {
  id: string;
  source: string;
  target: string;
  relTypeId: string;
};

export type OverviewRelation = {
  id: string;
  name: string;
  sourceOtId: string;
  targetOtId: string;
};

/** Columns a row needs to name an instance: its keys, then what its label reads. */
export function labelColumns(meta: ObjectTypeMeta, labelKey?: string): string[] {
  const declared = new Set(meta.properties.map((property) => property.name));
  const columns = [...meta.primaryKeys];
  const add = (name: string) => {
    if (declared.has(name) && !columns.includes(name)) columns.push(name);
  };
  if (labelKey && isLabelTemplate(labelKey)) {
    for (const name of templateProperties(labelKey)) add(name);
  } else if (labelKey) {
    add(labelKey);
  }
  // The fallback chain of pickDisplay, matched without regard to case as it does.
  const byLower = new Map(
    meta.properties.map((property) => [property.name.toLowerCase(), property.name]),
  );
  for (const key of LABEL_CHAIN) {
    const name = byLower.get(key);
    if (name) {
      add(name);
      break;
    }
  }
  // Last resort before the id: the first property that is not a key.
  if (columns.length === meta.primaryKeys.length) {
    const first = meta.properties.find(
      (property) => !property.name.startsWith("_") && !meta.primaryKeys.includes(property.name),
    );
    if (first) add(first.name);
  }
  return columns;
}

function alias(prefix: string, property: string): string {
  return `${prefix}__${property}`;
}

function projection(variable: string, columns: readonly string[]): string[] {
  return columns.map(
    (column) =>
      `${variable}.${quoteIdentifier(column)} AS ${quoteIdentifier(alias(variable, column))}`,
  );
}

function clampLimit(limit: number): number {
  return Math.min(MAX_CYPHER_LIMIT, Math.max(1, Math.floor(limit)));
}

function relationPattern(rel: OverviewRelation): string {
  return `MATCH (a:${quoteIdentifier(rel.sourceOtId)})-[:${quoteIdentifier(rel.id)}]->(b:${quoteIdentifier(rel.targetOtId)})`;
}

export function buildTypeCountQuery(otId: string): CypherQuery {
  return {
    query: `MATCH (t:${quoteIdentifier(otId)})\nRETURN count(*) AS ${quoteIdentifier("n")}`,
    parameters: {},
  };
}

export function buildRelationCountQuery(rel: OverviewRelation): CypherQuery {
  return {
    query: `${relationPattern(rel)}\nRETURN count(*) AS ${quoteIdentifier("n")}`,
    parameters: {},
  };
}

/**
 * One page of a relation type's instances with both ends named. Ordered by both ends' keys, since
 * SKIP/LIMIT over a partial order repeats and skips rows.
 */
export function buildEdgePageQuery(
  rel: OverviewRelation,
  source: { meta: ObjectTypeMeta; columns: readonly string[] },
  target: { meta: ObjectTypeMeta; columns: readonly string[] },
  page: { skip: number; limit: number },
): CypherQuery {
  const order = [
    ...source.meta.primaryKeys.map((pk) => quoteIdentifier(alias("a", pk))),
    ...target.meta.primaryKeys.map((pk) => quoteIdentifier(alias("b", pk))),
  ];
  const lines = [
    relationPattern(rel),
    `RETURN ${[...projection("a", source.columns), ...projection("b", target.columns)].join(", ")}`,
    `ORDER BY ${order.join(", ")}`,
  ];
  if (page.skip > 0) lines.push(`SKIP ${Math.floor(page.skip)}`);
  lines.push(`LIMIT ${clampLimit(page.limit)}`);
  return { query: lines.join("\n"), parameters: {} };
}

/** One page of an object type's instances, for instances no relation reaches. */
export function buildTypePageQuery(
  meta: ObjectTypeMeta,
  columns: readonly string[],
  page: { skip: number; limit: number },
): CypherQuery {
  const lines = [
    `MATCH (t:${quoteIdentifier(meta.id)})`,
    `RETURN ${projection("t", columns).join(", ")}`,
    `ORDER BY ${meta.primaryKeys.map((pk) => quoteIdentifier(alias("t", pk))).join(", ")}`,
  ];
  if (page.skip > 0) lines.push(`SKIP ${Math.floor(page.skip)}`);
  lines.push(`LIMIT ${clampLimit(page.limit)}`);
  return { query: lines.join("\n"), parameters: {} };
}

export function parseCount(entries: readonly Rec[]): number | null {
  const value = Number(entries[0]?.n);
  return Number.isFinite(value) ? value : null;
}

/** The instance one variable of a row names, or null when a key value is missing. */
export function nodeFromRow(
  meta: ObjectTypeMeta,
  row: Rec,
  variable: string,
  labelKey?: string,
): OverviewNode | null {
  const prefix = `${variable}__`;
  const props: Rec = {};
  for (const [column, value] of Object.entries(row))
    if (column.startsWith(prefix)) props[column.slice(prefix.length)] = value;
  const identity: Rec = {};
  for (const pk of meta.primaryKeys) identity[pk] = props[pk];
  if (identityKey(meta.primaryKeys, identity) === null) return null;
  const id = buildInstanceId(meta.id, meta.primaryKeys, identity);
  if (!id) return null;
  return {
    id,
    otId: meta.id,
    identity,
    display: pickDisplay(props, id, labelKey, meta.name),
  };
}

export function edgeId(source: string, relTypeId: string, target: string): string {
  return `${source}|${relTypeId}|${target}`;
}
