/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * How the result graph draws each type, set from the graph's overview like Neo4j Browser's
 * styling: per object type a color, a size and the property shown as the node's caption; per
 * relationship a color. Kept in this browser per network and shared by every frame.
 */

export type NodeSize = "s" | "m" | "l";

export type EdgeLabels = "auto" | "on" | "off";

/** "fixed" moves only the node dragged; "force" pulls its neighbours along, as in Neo4j Browser. */
export type DragMode = "fixed" | "force";

export type GraphStyle = {
  nodes: Record<string, { color?: string; size?: NodeSize; caption?: string }>;
  edges: Record<string, { color?: string }>;
  /** How many nodes a graph draws before it asks; GRAPH_NODE_LIMIT when unset. */
  nodeLimit?: number;
};

/** How one frame's graph draws and moves; kept with the frame, unset means the default. */
export type FrameGraphSettings = {
  /** Relationship names on the lines: "auto" shows them while the graph is small. */
  edgeLabels?: EdgeLabels;
  /** How dragging a node moves the graph; "fixed" when unset. */
  dragMode?: DragMode;
};

export const EMPTY_GRAPH_STYLE: GraphStyle = { nodes: {}, edges: {} };

/** Relative to the size the graph picks for its node count. */
export const NODE_SIZE_SCALE: Record<NodeSize, number> = { s: 0.7, m: 1, l: 1.45 };

/** Colors offered for a type; readable on both themes. */
export const STYLE_COLORS = [
  "#5470c6",
  "#91cc75",
  "#fac858",
  "#ee6666",
  "#73c0de",
  "#3ba272",
  "#fc8452",
  "#9a60b4",
  "#ea7ccc",
  "#8c8c8c",
];

function storageKey(knId: string): string {
  return `bkn-studio.cypher-graph-style.${knId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadGraphStyle(knId: string): GraphStyle {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(knId)) ?? "null");
    if (!isRecord(parsed)) return EMPTY_GRAPH_STYLE;
    return {
      nodes: isRecord(parsed.nodes) ? (parsed.nodes as GraphStyle["nodes"]) : {},
      edges: isRecord(parsed.edges) ? (parsed.edges as GraphStyle["edges"]) : {},
      ...(typeof parsed.nodeLimit === "number" && parsed.nodeLimit > 0
        ? { nodeLimit: parsed.nodeLimit }
        : {}),
    };
  } catch {
    return EMPTY_GRAPH_STYLE;
  }
}

export function saveGraphStyle(knId: string, style: GraphStyle): void {
  try {
    localStorage.setItem(storageKey(knId), JSON.stringify(style));
  } catch {
    /* Private mode: the style lasts for this visit. */
  }
}

/** Changes one type's style; an empty value goes back to the default. */
export function setNodeStyle(
  style: GraphStyle,
  objectTypeId: string,
  change: Partial<GraphStyle["nodes"][string]>,
): GraphStyle {
  const next = { ...style.nodes[objectTypeId], ...change };
  for (const key of Object.keys(next) as (keyof typeof next)[]) if (!next[key]) delete next[key];
  return { ...style, nodes: { ...style.nodes, [objectTypeId]: next } };
}

export function setEdgeStyle(
  style: GraphStyle,
  name: string,
  color: string | undefined,
): GraphStyle {
  return { ...style, edges: { ...style.edges, [name]: color ? { color } : {} } };
}

/** The caption property per object type, where one was chosen. */
export function captionKeys(style: GraphStyle): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const [otId, item] of Object.entries(style.nodes))
    if (item.caption) keys[otId] = item.caption;
  return keys;
}
