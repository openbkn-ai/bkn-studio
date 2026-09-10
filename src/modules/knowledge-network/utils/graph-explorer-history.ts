/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { GEdge, GNode } from "@/modules/knowledge-network/services/graph-explorer.service";
import type { NodePosition } from "@/modules/knowledge-network/utils/graph-explorer-cache";

/* ============================ Undo ============================ */

/** Full canvas state before a mutation; restoring it is the undo. */
export type CanvasSnapshot = {
  nodes: GNode[];
  edges: GEdge[];
  positions: Record<string, NodePosition>;
};

export const UNDO_LIMIT = 30;

/** Pushes a snapshot, dropping the oldest beyond the limit. Returns the new depth. */
export function pushSnapshot(stack: CanvasSnapshot[], snapshot: CanvasSnapshot, limit = UNDO_LIMIT): number {
  stack.push(snapshot);
  while (stack.length > limit) stack.shift();
  return stack.length;
}

export function takeSnapshot(nodes: Iterable<GNode>, edges: Iterable<GEdge>, positions: Record<string, NodePosition>): CanvasSnapshot {
  const copied: Record<string, NodePosition> = {};
  for (const [id, position] of Object.entries(positions)) copied[id] = { ...position };
  return { nodes: [...nodes], edges: [...edges], positions: copied };
}

/* ============================ Call history ============================ */

export type HistoryKind = "search" | "query" | "browse" | "locate" | "ids" | "expand" | "path" | "cypher" | "ai";

export type HistoryEntry = {
  id: string;
  at: number;
  kind: HistoryKind;
  /** Human title, e.g. the query text or the expanded node label. */
  title: string;
  /** Tool / endpoint and its arguments as sent. */
  input: unknown;
  /** Raw result, truncated when large; an error message when the call failed. */
  output: unknown;
  ok: boolean;
  ms: number;
  /** One-line result summary, e.g. "12 nodes · 4 edges". */
  summary: string;
  /** Data needed to run the same call again, when the entry supports it. */
  rerun?: { kind: "expand"; id: string; direction: "forward" | "backward" | "bidirectional" } | { kind: "path" };
};

export const HISTORY_LIMIT = 100;
export const OUTPUT_CHAR_LIMIT = 100_000;

let counter = 0;

export function newHistoryId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

/** Adds an entry at the front, keeping the list bounded. */
export function pushHistory(list: HistoryEntry[], entry: HistoryEntry, limit = HISTORY_LIMIT): HistoryEntry[] {
  return [entry, ...list].slice(0, limit);
}

/** Serialises a payload for display, cutting it off with a marker once it grows past the limit. */
export function truncateForDisplay(value: unknown, limit = OUTPUT_CHAR_LIMIT): string {
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value, null, 2) ?? String(value);
    } catch {
      text = String(value);
    }
  }
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n… (${text.length - limit} more characters)`;
}
