/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Lays each connected part of the graph out on its own band, left to right along the direction
 * the relations point, and stacks the bands down the canvas.
 *
 * Exploring an id list usually produces several short chains that share no node. A force layout
 * scatters them and their labels collide; this gives every chain a straight run of its own, so a
 * two- or three-hop path reads as a line rather than a cloud.
 */
export type ChainEdge = { source: string; target: string };
export type ChainPoint = { x: number; y: number };

/** Horizontal step between hops. */
export const CHAIN_COL_GAP = 220;
/** Vertical step between nodes that sit at the same hop. */
export const CHAIN_ROW_GAP = 90;
/** Blank space between one connected part and the next. */
export const CHAIN_BAND_GAP = 70;

/** Connected parts of the graph, ignoring edge direction, each keeping the given node order. */
export function connectedParts(ids: string[], edges: ChainEdge[]): string[][] {
  const near = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of edges) {
    if (!near.has(edge.source) || !near.has(edge.target)) continue;
    near.get(edge.source)?.push(edge.target);
    near.get(edge.target)?.push(edge.source);
  }
  const seen = new Set<string>();
  const parts: string[][] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const queue = [id];
    seen.add(id);
    const part: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      part.push(current);
      for (const next of near.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    parts.push(part);
  }
  return parts;
}

/**
 * Hop number per node inside one connected part: a node no relation points at starts at zero,
 * and every step along a relation moves one to the right. Cycles keep the first number reached.
 */
export function hopLevels(part: string[], edges: ChainEdge[]): Map<string, number> {
  const inPart = new Set(part);
  const out = new Map<string, string[]>(part.map((id) => [id, []]));
  const incoming = new Map<string, number>(part.map((id) => [id, 0]));
  for (const edge of edges) {
    if (!inPart.has(edge.source) || !inPart.has(edge.target) || edge.source === edge.target) continue;
    out.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const roots = part.filter((id) => (incoming.get(id) ?? 0) === 0);
  // A part that is one cycle has no root; start from wherever it was first reached.
  const starts = roots.length > 0 ? roots : [part[0]];
  const level = new Map<string, number>();
  const queue: string[] = [];
  for (const id of starts) {
    level.set(id, 0);
    queue.push(id);
  }
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const next = (level.get(current) ?? 0) + 1;
    for (const target of out.get(current) ?? []) {
      if (level.has(target)) continue;
      level.set(target, next);
      queue.push(target);
    }
  }
  // Anything the walk never reached still needs a column.
  for (const id of part) if (!level.has(id)) level.set(id, 0);
  return level;
}

/** Positions every node: chains run left to right, connected parts stack top to bottom. */
export function chainPositions(ids: string[], edges: ChainEdge[]): Map<string, ChainPoint> {
  const points = new Map<string, ChainPoint>();
  let bandTop = 0;
  for (const part of connectedParts(ids, edges)) {
    const level = hopLevels(part, edges);
    const columns = new Map<number, string[]>();
    for (const id of part) {
      const column = level.get(id) ?? 0;
      columns.set(column, [...(columns.get(column) ?? []), id]);
    }
    const tallest = Math.max(...[...columns.values()].map((column) => column.length));
    const bandHeight = (tallest - 1) * CHAIN_ROW_GAP;
    for (const [column, members] of columns) {
      // Centre each column in the band so a chain comes out as one straight line.
      const offset = (bandHeight - (members.length - 1) * CHAIN_ROW_GAP) / 2;
      members.forEach((id, index) => {
        points.set(id, { x: column * CHAIN_COL_GAP, y: bandTop + offset + index * CHAIN_ROW_GAP });
      });
    }
    bandTop += bandHeight + CHAIN_BAND_GAP;
  }
  return points;
}
