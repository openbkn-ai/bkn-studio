/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EdgeData, GraphData, NodeData } from "@antv/g6";

import {
  EMPTY_GRAPH_STYLE,
  NODE_SIZE_SCALE,
  STYLE_COLORS,
  type DragMode,
  type FrameGraphSettings,
  type GraphStyle,
} from "@/modules/knowledge-network/cypher/graph-style";
import type { CypherGraph } from "@/modules/knowledge-network/cypher/graph-values";

const LABEL_CHARS = 14;

function shorten(text: string): string {
  return text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS)}…` : text;
}

/** Past these counts, names show on hover only so the drawing stays readable. */
const NODE_LABEL_LIMIT = 80;
const EDGE_LABEL_LIMIT = 12;
/** Past this many edges the arrows only clutter the hubs; direction shows on hover. */
const ARROW_LIMIT = 60;

export const EDGE_COLOR = "#99a3b3";
export const DERIVED_EDGE_COLOR = "#d48806";

export type GraphDensity = { size: number; linkDistance: number; repulsion: number };

/**
 * Node size and spacing for the node count: a large result gets small nodes set close, so a
 * few hundred still read as clusters instead of overlapping discs.
 */
export function densityFor(nodeCount: number): GraphDensity {
  if (nodeCount <= 60) return { size: 28, linkDistance: 110, repulsion: 260 };
  if (nodeCount <= 200) return { size: 18, linkDistance: 70, repulsion: 120 };
  return { size: 12, linkDistance: 44, repulsion: 60 };
}

/** A palette color picked from the id, so a type keeps it whatever order the rows come in. */
function paletteColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return STYLE_COLORS[hash % STYLE_COLORS.length];
}

/** Each object type's color: the one chosen for it, else one from the palette. */
export function typeColors(
  graph: CypherGraph,
  style: GraphStyle = EMPTY_GRAPH_STYLE,
): Map<string, string> {
  const colors = new Map<string, string>();
  for (const node of graph.nodes)
    if (!colors.has(node.objectTypeId))
      colors.set(
        node.objectTypeId,
        style.nodes[node.objectTypeId]?.color ?? paletteColor(node.objectTypeId),
      );
  return colors;
}

export type GraphDrawing = { data: GraphData; density: GraphDensity; dragMode: DragMode };

/**
 * The force-directed drawing: nodes colored by object type, modeled relationships as solid
 * arrows, derived edges dashed with their count, each type drawn as `style` says.
 */
export function buildGraphOption(
  graph: CypherGraph,
  style: GraphStyle = EMPTY_GRAPH_STYLE,
  settings: FrameGraphSettings = {},
): GraphDrawing {
  const mode = settings.edgeLabels ?? "auto";
  const edgeLabels = mode === "on" || (mode === "auto" && graph.edges.length <= EDGE_LABEL_LIMIT);
  const nodeLabels = graph.nodes.length <= NODE_LABEL_LIMIT;
  const arrows = graph.edges.length <= ARROW_LIMIT;
  const density = densityFor(graph.nodes.length);
  const colors = typeColors(graph, style);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  const nodes: NodeData[] = graph.nodes.map((node) => ({
    id: node.id,
    data: { label: node.label, typeName: node.objectTypeName },
    style: {
      size: density.size * NODE_SIZE_SCALE[style.nodes[node.objectTypeId]?.size ?? "m"],
      fill: colors.get(node.objectTypeId),
      labelText: nodeLabels ? shorten(node.label) : "",
    },
  }));
  const edgeIds = new Set<string>();
  const edges: EdgeData[] = [];
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edgeIds.has(edge.id)) continue;
    edgeIds.add(edge.id);
    const name = edge.count ? `${edge.name} (${edge.count})` : edge.name;
    // Derived edges always show their count; it is the answer.
    const labeled = mode !== "off" && (edgeLabels || edge.derived);
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: { name },
      style: {
        stroke: style.edges[edge.name]?.color ?? (edge.derived ? DERIVED_EDGE_COLOR : EDGE_COLOR),
        lineWidth: edge.derived ? 1.6 : arrows ? 1.2 : 0.8,
        lineDash: edge.derived ? [4, 3] : [0, 0],
        endArrow: arrows,
        labelText: labeled ? name : "",
      },
    });
  }
  return { data: { nodes, edges }, density, dragMode: settings.dragMode ?? "fixed" };
}
