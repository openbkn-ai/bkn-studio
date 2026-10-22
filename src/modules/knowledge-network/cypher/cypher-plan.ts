/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * run_cypher's plan: what a query would match, test, group and return, without running it
 * (`explain: true`). It names object types, relation types and properties only; the SQL a
 * query becomes is never part of it. Fields follow bkn-backend's `CypherPlan`.
 */
export type CypherPlan = {
  /** match, aggregate, totals, semi_join, list_comparison or carried. */
  shape: string;
  graph?: boolean;
  objects: { alias: string; object_type_id: string }[];
  /** Source and target follow the relation's direction: outgoing, incoming or undirected. */
  relations?: { relation_type_id: string; source: string; target: string; direction: string }[];
  conditions?: { operator?: string; expression?: string; properties?: string[]; where?: string }[];
  grouping?: string[];
  columns: { name: string; kind: string; type?: unknown }[];
  ordering?: { column?: string; property?: string; descending?: boolean }[];
  limit: number;
  /** "explicit" when the query wrote LIMIT, "default" otherwise. */
  limit_source: string;
  /** Every property the query reads, as object_type_id.property. */
  reads: string[];
  /** Object types whose rows the caller's access policy narrows. */
  row_filtered?: string[];
  warnings?: string[];
};

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list<T>(value: unknown, pick: (item: Rec) => T | null): T[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const picked = isRec(item) ? pick(item) : null;
        return picked ? [picked] : [];
      })
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Reads the plan from run_cypher's body, or null when the body holds none. */
export function cypherPlanFrom(value: unknown): CypherPlan | null {
  if (!isRec(value) || typeof value.shape !== "string") return null;
  return {
    shape: value.shape,
    ...(value.graph === true ? { graph: true } : {}),
    objects: list(value.objects, (item) => ({
      alias: text(item.alias),
      object_type_id: text(item.object_type_id),
    })),
    relations: list(value.relations, (item) => ({
      relation_type_id: text(item.relation_type_id),
      source: text(item.source),
      target: text(item.target),
      direction: text(item.direction),
    })),
    conditions: list(value.conditions, (item) => ({
      ...(typeof item.operator === "string" ? { operator: item.operator } : {}),
      ...(typeof item.expression === "string" ? { expression: item.expression } : {}),
      properties: strings(item.properties),
      ...(typeof item.where === "string" ? { where: item.where } : {}),
    })),
    grouping: strings(value.grouping),
    columns: list(value.columns, (item) => ({
      name: text(item.name),
      kind: text(item.kind),
      ...(item.type !== undefined ? { type: item.type } : {}),
    })),
    ordering: list(value.ordering, (item) => ({
      ...(typeof item.column === "string" ? { column: item.column } : {}),
      ...(typeof item.property === "string" ? { property: item.property } : {}),
      ...(item.descending === true ? { descending: true } : {}),
    })),
    limit: typeof value.limit === "number" ? value.limit : 0,
    limit_source: text(value.limit_source),
    reads: strings(value.reads),
    row_filtered: strings(value.row_filtered),
    warnings: strings(value.warnings),
  };
}

const EXPLAIN_PREFIX = /^\s*EXPLAIN\b\s*/i;

/**
 * Splits off a leading `EXPLAIN`, as in Neo4j Browser: the rest is the query, sent with
 * `explain: true` so it is checked and planned but reads nothing.
 */
export function splitExplain(query: string): { query: string; explain: boolean } {
  return EXPLAIN_PREFIX.test(query)
    ? { query: query.replace(EXPLAIN_PREFIX, ""), explain: true }
    : { query, explain: false };
}

/** The query with `EXPLAIN` in front, once. */
export function withExplain(query: string): string {
  return splitExplain(query).explain ? query : `EXPLAIN ${query}`;
}
