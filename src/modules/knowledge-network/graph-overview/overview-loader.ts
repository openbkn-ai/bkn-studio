/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CypherQuery, CypherResult, ObjectTypeMeta } from "./overview.service";

import {
  buildEdgePageQuery,
  buildRelationCountQuery,
  buildTypeCountQuery,
  buildTypePageQuery,
  edgeId,
  labelColumns,
  nodeFromRow,
  parseCount,
  type OverviewEdge,
  type OverviewNode,
  type OverviewRelation,
} from "./overview-queries";

/*
 * Loads the network overview: totals first, then relations
 * page by page with their ends, smallest relation type first, until the point or line budget is
 * spent. Instances no relation reaches are added only when every relation was read to the end.
 */

export type OverviewLimits = {
  nodes: number;
  edges: number;
  /** Rows per relation or object type page, at most. */
  pageSize: number;
  /** The smallest page a relation type is read in, so a nearly spent budget still moves. */
  minPageSize: number;
  /** Queries in flight at once. */
  concurrency: number;
};

export const DEFAULT_LIMITS: OverviewLimits = {
  nodes: 10_000,
  edges: 30_000,
  pageSize: 10_000,
  minPageSize: 200,
  concurrency: 6,
};

function uniqueFailures(failures: OverviewFailure[]): OverviewFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.kind}:${failure.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type OverviewFailure = {
  kind: "type" | "relation";
  id: string;
  message: string;
};

export type OverviewData = {
  nodes: OverviewNode[];
  edges: OverviewEdge[];
  /** Instances per object type, null when the count failed. */
  typeTotals: Record<string, number | null>;
  /** Instances per relation type, null when the count failed. */
  relationTotals: Record<string, number | null>;
  /** True when every instance and every relation of the network is drawn. */
  complete: boolean;
  /** Which budget cut the load short, if any. */
  limitedBy: "nodes" | "edges" | null;
  failures: OverviewFailure[];
  /** Relation types whose reading stopped early because their pages brought no new points. */
  saturated?: string[];
  loadedAt: number;
};

export type OverviewProgress = {
  nodes: number;
  edges: number;
  /** What is being read: a relation or object type id, or null while counting. */
  current: { kind: "type" | "relation"; id: string } | null;
};

export type OverviewInput = {
  metas: Record<string, ObjectTypeMeta>;
  relations: OverviewRelation[];
  /** Object type id -> label property or template in effect. */
  labels: Record<string, string>;
  runCypher: (query: CypherQuery, signal?: AbortSignal) => Promise<CypherResult>;
  limits?: Partial<OverviewLimits>;
  signal?: AbortSignal;
  onProgress?: (progress: OverviewProgress) => void;
  /** Called after every merged page, so the canvas can draw what has arrived. */
  onPartial?: (nodes: OverviewNode[], edges: OverviewEdge[]) => void;
  now?: () => number;
};

async function runLimited(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      await task();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === "AbortError");
}

type RelationCursor = {
  rel: OverviewRelation;
  skip: number;
  done: boolean;
  /** A page of it is being read. */
  busy: boolean;
  pages: number;
};

/**
 * A relation with more rows than this many times its larger end type's instances is read for one
 * page only: a one-to-many relation has at most as many rows as its many side.
 */
const EXPLOSION = 20;

export async function loadOverview(input: OverviewInput): Promise<OverviewData> {
  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  const { metas, signal } = input;
  const now = input.now ?? Date.now;
  const failures: OverviewFailure[] = [];
  const nodes = new Map<string, OverviewNode>();
  const edges = new Map<string, OverviewEdge>();
  let limitedBy: OverviewData["limitedBy"] = null;

  const run = async (query: CypherQuery) => {
    signal?.throwIfAborted();
    return input.runCypher(query, signal);
  };
  const progress = (current: OverviewProgress["current"]) =>
    input.onProgress?.({ nodes: nodes.size, edges: edges.size, current });

  // Object types the overview can name: a type without a primary key has no instance id.
  const types = Object.values(metas).filter((meta) => meta.primaryKeys.length > 0);
  // Reported, not dropped in silence: its definition came back without a key (often a broken
  // data source), so none of its instances can be named.
  for (const meta of Object.values(metas))
    if (meta.primaryKeys.length === 0)
      failures.push({ kind: "type", id: meta.id, message: "no primary key" });
  const typeIds = new Set(types.map((meta) => meta.id));
  const relations = input.relations.filter(
    (rel) => typeIds.has(rel.sourceOtId) && typeIds.has(rel.targetOtId),
  );
  const columnsOf = new Map(
    types.map((meta) => [meta.id, labelColumns(meta, input.labels[meta.id])]),
  );

  /* ---------------------------- totals ---------------------------- */

  progress(null);
  const typeTotals: Record<string, number | null> = {};
  const relationTotals: Record<string, number | null> = {};
  // Object types first: they are quick, and the explosion check needs them early. Totals feed
  // the summary, that check and the last step only, so they run beside the paging on two slots
  // of their own: waiting for them first would keep the canvas empty for seconds on a busy backend.
  const countSlots = Math.min(2, limits.concurrency);
  const counts = runLimited(
    [
      ...types.map((meta) => async () => {
        try {
          typeTotals[meta.id] = parseCount((await run(buildTypeCountQuery(meta.id))).entries);
        } catch (error) {
          if (isAbort(error, signal)) throw error;
          typeTotals[meta.id] = null;
          failures.push({ kind: "type", id: meta.id, message: messageOf(error) });
        }
      }),
      ...relations.map((rel) => async () => {
        try {
          relationTotals[rel.id] = parseCount((await run(buildRelationCountQuery(rel))).entries);
        } catch (error) {
          if (isAbort(error, signal)) throw error;
          relationTotals[rel.id] = null;
          failures.push({ kind: "relation", id: rel.id, message: messageOf(error) });
        }
      }),
    ],
    countSlots,
  );
  let countsDone = false;
  counts.then(
    () => {
      countsDone = true;
    },
    () => undefined,
  );

  /* ---------------------------- relations ---------------------------- */

  const saturated: string[] = [];
  const exploded = (rel: OverviewRelation): boolean => {
    const total = relationTotals[rel.id];
    const source = typeTotals[rel.sourceOtId];
    const target = typeTotals[rel.targetOtId];
    if (total == null || source == null || target == null) return false;
    return total > EXPLOSION * Math.max(1, source, target);
  };
  const cursors: RelationCursor[] = relations.map((rel) => ({
    rel,
    skip: 0,
    done: false,
    busy: false,
    pages: 0,
  }));

  const pageSlots = Math.max(1, limits.concurrency - countSlots);
  const nodesFull = () => nodes.size >= limits.nodes;
  const edgesFull = () => edges.size >= limits.edges;

  /** Adds one row; returns false once a budget is spent. */
  const mergeEdgeRow = (rel: OverviewRelation, row: Record<string, unknown>): boolean => {
    if (edgesFull()) {
      limitedBy ??= "edges";
      return false;
    }
    const a = nodeFromRow(metas[rel.sourceOtId], row, "a", input.labels[rel.sourceOtId]);
    const b = nodeFromRow(metas[rel.targetOtId], row, "b", input.labels[rel.targetOtId]);
    if (!a || !b) return true;
    const missing = (nodes.has(a.id) ? 0 : 1) + (nodes.has(b.id) || a.id === b.id ? 0 : 1);
    if (nodes.size + missing > limits.nodes) {
      // Out of points: a line between two points already drawn still fits.
      limitedBy ??= "nodes";
      return true;
    }
    if (!nodes.has(a.id)) nodes.set(a.id, a);
    if (!nodes.has(b.id)) nodes.set(b.id, b);
    const id = edgeId(a.id, rel.id, b.id);
    if (!edges.has(id)) edges.set(id, { id, source: a.id, target: b.id, relTypeId: rel.id });
    return true;
  };

  const readPage = async (cursor: RelationCursor, limit: number) => {
    const { rel } = cursor;
    progress({ kind: "relation", id: rel.id });
    const source = {
      meta: metas[rel.sourceOtId],
      columns: columnsOf.get(rel.sourceOtId) ?? [],
    };
    const target = {
      meta: metas[rel.targetOtId],
      columns: columnsOf.get(rel.targetOtId) ?? [],
    };
    try {
      const result = await run(
        buildEdgePageQuery(rel, source, target, { skip: cursor.skip, limit }),
      );
      return result.entries;
    } catch (error) {
      if (isAbort(error, signal)) throw error;
      cursor.done = true;
      failures.push({
        kind: "relation",
        id: rel.id,
        message: messageOf(error),
      });
      return null;
    }
  };

  // A pool of page slots. A free slot takes the open relation type with the fewest pages read, so
  // they take turns; each page is that type's fair share of what budget is left (a row adds at
  // most two points), so one read early cannot crowd out the rest. A page merges as soon as it
  // arrives: waiting for a batch made every query wait for the slowest one in it.
  const shareOf = () => {
    const open = cursors.filter((cursor) => !cursor.done).length;
    return Math.min(
      limits.pageSize,
      Math.max(
        limits.minPageSize,
        Math.ceil(
          Math.min((limits.nodes - nodes.size) / 2, limits.edges - edges.size) / Math.max(1, open),
        ),
      ),
    );
  };
  const nextCursor = () => {
    let best: RelationCursor | null = null;
    for (const cursor of cursors) {
      if (cursor.done || cursor.busy) continue;
      // Its count may have landed since its last page: one page is all it gets.
      if (cursor.pages > 0 && exploded(cursor.rel)) {
        cursor.done = true;
        saturated.push(cursor.rel.id);
        continue;
      }
      if (!best || cursor.pages < best.pages) best = cursor;
    }
    return best;
  };
  const inFlight = new Set<Promise<void>>();
  const readNext = (cursor: RelationCursor) => {
    cursor.busy = true;
    const share = shareOf();
    const task = (async () => {
      const rows = await readPage(cursor, share);
      cursor.busy = false;
      cursor.pages += 1;
      if (rows === null) return;
      for (const row of rows) if (!mergeEdgeRow(cursor.rel, row)) break;
      cursor.skip += rows.length;
      if (rows.length < share) cursor.done = true;
      else if (exploded(cursor.rel)) {
        // Far more rows than either end has instances: joined on a key that is not unique, so
        // nearly every pair is linked. Each further page costs seconds and adds nothing a
        // reader could tell apart; the page already read stands for it.
        cursor.done = true;
        saturated.push(cursor.rel.id);
      }
      input.onPartial?.([...nodes.values()], [...edges.values()]);
    })();
    const tracked = task.finally(() => inFlight.delete(tracked));
    inFlight.add(tracked);
  };
  // A full point budget ends the load: further pages could only add lines among drawn points.
  while (!nodesFull() && !edgesFull()) {
    // The count slots join the paging once the totals are in.
    const slots = countsDone ? limits.concurrency : pageSlots;
    let cursor = inFlight.size < slots ? nextCursor() : null;
    while (cursor && inFlight.size < slots) {
      readNext(cursor);
      cursor = nextCursor();
    }
    if (inFlight.size === 0) break;
    await Promise.race(inFlight);
  }
  // Pages still running when a budget filled: their rows would only be cut off.
  await Promise.allSettled([...inFlight]);
  signal?.throwIfAborted();
  // The totals decide what is complete and how many instances are still missing.
  await counts;
  if (nodesFull() && cursors.some((cursor) => !cursor.done)) limitedBy ??= "nodes";
  const relationsComplete =
    limitedBy === null &&
    cursors.every((cursor) => cursor.done) &&
    saturated.length === 0 &&
    !failures.some((failure) => failure.kind === "relation");

  /* ---------------------------- instances no relation reaches ---------------------------- */

  // Only when every relation was read: an instance missing then truly has no relation. Before
  // that, it may simply sit on a page that was never read, and drawing it alone would mislead.
  if (relationsComplete) {
    const loadedPerType = new Map<string, number>();
    for (const node of nodes.values())
      loadedPerType.set(node.otId, (loadedPerType.get(node.otId) ?? 0) + 1);
    const pending = types
      .filter((meta) => (typeTotals[meta.id] ?? 0) > (loadedPerType.get(meta.id) ?? 0))
      .sort((a, b) => (typeTotals[a.id] ?? 0) - (typeTotals[b.id] ?? 0));
    for (const meta of pending) {
      const total = typeTotals[meta.id] ?? 0;
      for (let skip = 0; skip < total && !nodesFull(); skip += limits.pageSize) {
        progress({ kind: "type", id: meta.id });
        let rows: Record<string, unknown>[];
        try {
          rows = (
            await run(
              buildTypePageQuery(meta, columnsOf.get(meta.id) ?? meta.primaryKeys, {
                skip,
                limit: limits.pageSize,
              }),
            )
          ).entries;
        } catch (error) {
          if (isAbort(error, signal)) throw error;
          failures.push({
            kind: "type",
            id: meta.id,
            message: messageOf(error),
          });
          break;
        }
        for (const row of rows) {
          if (nodesFull()) {
            limitedBy ??= "nodes";
            break;
          }
          const node = nodeFromRow(meta, row, "t", input.labels[meta.id]);
          if (node && !nodes.has(node.id)) nodes.set(node.id, node);
        }
        input.onPartial?.([...nodes.values()], [...edges.values()]);
        if (rows.length < limits.pageSize) break;
      }
      if (nodesFull()) break;
    }
  }

  const drawnPerType = new Map<string, number>();
  for (const node of nodes.values())
    drawnPerType.set(node.otId, (drawnPerType.get(node.otId) ?? 0) + 1);
  const complete =
    relationsComplete &&
    limitedBy === null &&
    failures.length === 0 &&
    types.every((meta) => (typeTotals[meta.id] ?? 0) <= (drawnPerType.get(meta.id) ?? 0));
  // Filled up exactly as the last page ended, with instances still unread.
  if (!complete && limitedBy === null && nodesFull()) limitedBy = "nodes";

  progress(null);
  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    typeTotals,
    relationTotals,
    complete,
    limitedBy,
    failures: uniqueFailures(failures),
    saturated,
    loadedAt: now(),
  };
}
