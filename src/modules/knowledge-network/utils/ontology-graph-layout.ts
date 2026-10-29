/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/*
 * Where the ontology graph puts each object type: force (a grid past FORCE_LAYOUT_NODE_LIMIT), circle, or
 * clustered by concept group. Pure, so the arrangement is tested apart from the canvas that draws it.
 */

import { GRAPH_PALETTE } from "@/modules/knowledge-network/lib/graph-style";
import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

/** The arrangement's base canvas; larger graphs grow past it. */
const PREVIEW_LAYOUT_WIDTH = 1000;
const PREVIEW_LAYOUT_HEIGHT = 720;
/**
 * Width to height the arrangements aim for: the graph sits in wide panels, so clusters go side by
 * side before they stack, and the force arrangement is pulled flatter than tall.
 */
const TARGET_ASPECT = 2;

export const HUB_RADIUS = 34;
export const NODE_RADIUS = 28;
/** Low enough that a graph of a thousand types still fits the view. */
export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 3;
export const GROUP_HULL_PAD = 28;
const GROUP_CELL_GAP = 32;
const GROUP_CANVAS_PAD = 32;
/** Types beyond which force gives way to a grid: the drawing slows past a thousand. */
const FORCE_LAYOUT_NODE_LIMIT = 1_000;
export const UNGROUPED_ID = "__ungrouped";
const UNGROUPED_COLOR = "#64748b";
/** Group-boundary colors, assigned stably after sorting by group ID. */
export const GROUP_COLORS = GRAPH_PALETTE.slice(0, 8);

export type OntologyLayoutMode = "force" | "circle" | "group";
export type OntologyRenderMode = OntologyLayoutMode | "grid";
const EMPTY_GROUP_MAP = new Map<string, string>();

const CLAMP_PAD = 64;
const clamp = (value: number, max: number) => Math.max(CLAMP_PAD, Math.min(max - CLAMP_PAD, value));

function scalableCanvas(nodeCount: number) {
  if (nodeCount <= FORCE_LAYOUT_NODE_LIMIT) {
    return { width: PREVIEW_LAYOUT_WIDTH, height: PREVIEW_LAYOUT_HEIGHT };
  }
  const columns = Math.ceil(Math.sqrt(nodeCount * (PREVIEW_LAYOUT_WIDTH / PREVIEW_LAYOUT_HEIGHT)));
  const rows = Math.ceil(nodeCount / columns);
  return {
    width: Math.max(PREVIEW_LAYOUT_WIDTH, columns * NODE_SPACING + CLAMP_PAD * 2),
    height: Math.max(PREVIEW_LAYOUT_HEIGHT, rows * NODE_SPACING + CLAMP_PAD * 2),
  };
}

/** Radius of the innermost ring, and how many types fit on a ring of radius r. */
const RING_RADIUS = 260;
const ringCapacity = (radius: number) =>
  Math.max(1, Math.floor((2 * Math.PI * radius) / NODE_SPACING));

/**
 * Rings for `count` types: one ring while they fit at RING_RADIUS, else concentric rings a type's
 * spacing apart, filled from the inside, so a large graph stays a disc rather than a huge circle.
 */
function ringsFor(count: number): { radius: number; size: number }[] {
  const rings: { radius: number; size: number }[] = [];
  let left = count;
  for (let radius = RING_RADIUS; left > 0; radius += NODE_SPACING) {
    const size = Math.min(left, ringCapacity(radius));
    rings.push({ radius, size });
    left -= size;
  }
  // The last ring takes what is left; spread it evenly instead of crowding one side.
  return rings;
}

/** A canvas that holds the rings. */
function circleCanvas(count: number) {
  const rings = ringsFor(Math.max(1, count));
  const side = 2 * (rings.at(-1)?.radius ?? RING_RADIUS) + CLAMP_PAD * 4;
  return {
    width: Math.max(PREVIEW_LAYOUT_WIDTH, side),
    height: Math.max(PREVIEW_LAYOUT_HEIGHT, side),
  };
}

/** Circular layout: types around a circle, on concentric rings once one ring is full. */
function circleLayout(
  ids: string[],
  canvasWidth: number,
  canvasHeight: number,
): { id: string; x: number; y: number }[] {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const out: { id: string; x: number; y: number }[] = [];
  let index = 0;
  for (const ring of ringsFor(ids.length)) {
    for (let k = 0; k < ring.size; k += 1) {
      const a = (k / ring.size) * 2 * Math.PI - Math.PI / 2;
      out.push({
        id: ids[index],
        x: cx + ring.radius * Math.cos(a),
        y: cy + ring.radius * Math.sin(a),
      });
      index += 1;
    }
  }
  return out;
}

const NODE_GAP = 14; // 网格相邻节点中心最小距离之外的留白
const NODE_SPACING = NODE_RADIUS * 2 + NODE_GAP; // 理想中心距
const MIN_SPACING = NODE_RADIUS * 2; // 最小中心距：相切，绝不重叠
const CELL_INSET = GROUP_HULL_PAD + NODE_RADIUS; // cell 边到节点中心可用区的内缩（留出 hull 边距）

export type PositionedNode = { id: string; x: number; y: number };
type ClusterCell = {
  height: number;
  ids: string[];
  width: number;
};

/** Arrange nodes in each group as an almost-square grid centered in its cell. Compress spacing only to MIN_SPACING, preserving non-overlap. */
function placeCluster(
  gids: string[],
  gcx: number,
  gcy: number,
  cellW: number,
  cellH: number,
  canvasWidth: number,
  canvasHeight: number,
): PositionedNode[] {
  const n = gids.length;
  if (n <= 1) {
    return gids.map((id) => ({
      id,
      x: clamp(gcx, canvasWidth),
      y: clamp(gcy, canvasHeight),
    }));
  }
  const availW = Math.max(0, cellW - CELL_INSET * 2);
  const availH = Math.max(0, cellH - CELL_INSET * 2);
  // Choose a near-square column count from the available area's aspect ratio.
  const aspect = availW / Math.max(1, availH);
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspect)) || 1));
  const rows = Math.ceil(n / cols);
  // Prefer NODE_SPACING; compress when space is limited but never below MIN_SPACING, where nodes touch.
  const spacingX =
    cols > 1 ? Math.max(MIN_SPACING, Math.min(NODE_SPACING, availW / (cols - 1))) : 0;
  const spacingY =
    rows > 1 ? Math.max(MIN_SPACING, Math.min(NODE_SPACING, availH / (rows - 1))) : 0;
  const startX = gcx - ((cols - 1) * spacingX) / 2;
  const startY = gcy - ((rows - 1) * spacingY) / 2;
  return gids.map((id, i) => ({
    id,
    x: startX + (i % cols) * spacingX,
    y: startY + Math.floor(i / cols) * spacingY,
  }));
}

/**
 * Clusters by concept group using cells sized from their actual node grids. Cells are packed into
 * rows with a fixed gutter, so small adjacent groups cannot overflow proportional cells and overlap.
 */
function groupLayout(
  ids: string[],
  groupOf: Map<string, string>,
): { canvasHeight: number; canvasWidth: number; positions: PositionedNode[] } {
  const buckets = new Map<string, string[]>();
  ids.forEach((id) => {
    const g = groupOf.get(id) ?? UNGROUPED_ID;
    const arr = buckets.get(g) ?? [];
    arr.push(id);
    buckets.set(g, arr);
  });

  const cells: ClusterCell[] = [...buckets.entries()]
    .sort(([left], [right]) => {
      if (left === UNGROUPED_ID) return -1;
      if (right === UNGROUPED_ID) return 1;
      return left.localeCompare(right);
    })
    .map(([, clusterIds]) => {
      const columns = Math.max(1, Math.ceil(Math.sqrt(clusterIds.length)));
      const rows = Math.ceil(clusterIds.length / columns);
      return {
        height: (rows - 1) * NODE_SPACING + CELL_INSET * 2,
        ids: clusterIds,
        width: (columns - 1) * NODE_SPACING + CELL_INSET * 2,
      };
    });

  const baseCanvas = { width: PREVIEW_LAYOUT_WIDTH, height: PREVIEW_LAYOUT_HEIGHT };
  // Rows as wide as a TARGET_ASPECT box of the cells' total area, so the clusters spread sideways.
  const area = cells.reduce(
    (sum, cell) => sum + (cell.width + GROUP_CELL_GAP) * (cell.height + GROUP_CELL_GAP),
    0,
  );
  const widest = Math.max(0, ...cells.map((cell) => cell.width));
  const targetRowWidth = Math.max(widest, baseCanvas.width, Math.sqrt(area * TARGET_ASPECT));
  const rows: ClusterCell[][] = [];
  cells.forEach((cell) => {
    const row = rows.at(-1);
    const rowWidth = row?.reduce((sum, item) => sum + item.width, 0) ?? 0;
    const gaps = row ? row.length * GROUP_CELL_GAP : 0;
    if (row && rowWidth + gaps + cell.width <= targetRowWidth) {
      row.push(cell);
    } else {
      rows.push([cell]);
    }
  });

  const rowWidths = rows.map(
    (row) =>
      row.reduce((sum, cell) => sum + cell.width, 0) + Math.max(0, row.length - 1) * GROUP_CELL_GAP,
  );
  const rowHeights = rows.map((row) => Math.max(...row.map((cell) => cell.height)));
  const contentWidth = Math.max(0, ...rowWidths);
  const contentHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, rows.length - 1) * GROUP_CELL_GAP;
  const canvasWidth = Math.max(baseCanvas.width, contentWidth + GROUP_CANVAS_PAD * 2);
  const canvasHeight = Math.max(baseCanvas.height, contentHeight + GROUP_CANVAS_PAD * 2);
  const positions: PositionedNode[] = [];
  let y = (canvasHeight - contentHeight) / 2;

  rows.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];
    let x = (canvasWidth - rowWidths[rowIndex]) / 2;
    row.forEach((cell) => {
      positions.push(
        ...placeCluster(
          cell.ids,
          x + cell.width / 2,
          y + rowHeight / 2,
          cell.width,
          cell.height,
          canvasWidth,
          canvasHeight,
        ),
      );
      x += cell.width + GROUP_CELL_GAP;
    });
    y += rowHeight + GROUP_CELL_GAP;
  });

  return { canvasHeight, canvasWidth, positions };
}

/** Link length and the room each type keeps for its dot and the name under it. */
const FORCE_LINK_DISTANCE = 110;
const FORCE_COLLIDE_RADIUS = NODE_RADIUS + 18;

/**
 * The force arrangement: d3-force with collision, so dots and names never overlap, and a weak pull
 * to the middle that keeps types without relations near the rest. No canvas bounds: a large graph
 * takes more room. Deterministic, so a type keeps its place across visits.
 */
function forceLayout(graph: KnowledgeNetworkPreviewGraph): PositionedNode[] {
  type SimNode = { id: string; x: number; y: number };
  // A sunflower spiral to start from: spread out, and the same every time.
  const nodes: SimNode[] = graph.nodes.map((node, i) => {
    const r = FORCE_LINK_DISTANCE * 0.6 * Math.sqrt(i + 0.5);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    return { id: node.id, x: r * Math.cos(a) * Math.sqrt(TARGET_ASPECT), y: r * Math.sin(a) };
  });
  const known = new Set(nodes.map((node) => node.id));
  const links = graph.edges
    .filter(
      (edge) =>
        edge.sourceId !== edge.targetId && known.has(edge.sourceId) && known.has(edge.targetId),
    )
    .map((edge) => ({ source: edge.sourceId, target: edge.targetId }));
  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, { source: string; target: string }>(links)
        .id((node) => node.id)
        .distance(FORCE_LINK_DISTANCE),
    )
    .force("charge", forceManyBody().strength(-260).distanceMax(900))
    .force("collide", forceCollide(FORCE_COLLIDE_RADIUS))
    // A stronger pull up and down than sideways: wide rather than long.
    .force("x", forceX(0).strength(0.03))
    .force("y", forceY(0).strength(0.03 * TARGET_ASPECT))
    .stop();
  simulation.tick(Math.min(400, 120 + graph.nodes.length));
  return nodes.map((node) => ({ id: node.id, x: node.x, y: node.y }));
}

/** The arrangement actually drawn: a large graph falls back from force to a grid. */
export function renderModeOf(
  nodeCount: number,
  mode: OntologyLayoutMode,
  logicalGroupingAvailable: boolean,
): OntologyRenderMode {
  const selected: OntologyLayoutMode =
    mode === "group" && !logicalGroupingAvailable ? "force" : mode;
  return nodeCount > FORCE_LAYOUT_NODE_LIMIT && selected === "force" ? "grid" : selected;
}

export type OntologyLayout = {
  positions: Map<string, PositionedNode>;
  radiusById: Map<string, number>;
  hubId: string | null;
  canvasWidth: number;
  canvasHeight: number;
};

/** Positions and sizes of every object type for one arrangement. */
export function layoutOntologyGraph(
  graph: KnowledgeNetworkPreviewGraph,
  renderMode: OntologyRenderMode,
  groupOf: Map<string, string> | undefined,
): OntologyLayout {
  const ids = graph.nodes.map((node) => node.id);
  const grouped = renderMode === "group" ? groupLayout(ids, groupOf ?? EMPTY_GROUP_MAP) : undefined;
  const canvas = grouped
    ? { width: grouped.canvasWidth, height: grouped.canvasHeight }
    : renderMode === "circle"
      ? circleCanvas(ids.length)
      : renderMode === "grid"
        ? scalableCanvas(ids.length)
        : { width: PREVIEW_LAYOUT_WIDTH, height: PREVIEW_LAYOUT_HEIGHT };
  const layout =
    grouped?.positions ??
    (renderMode === "circle"
      ? circleLayout(ids, canvas.width, canvas.height)
      : renderMode === "grid"
        ? placeCluster(
            ids,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width,
            canvas.height,
            canvas.width,
            canvas.height,
          )
        : forceLayout(graph));
  const positionMap = new Map(
    layout.map((node) => [node.id, { id: node.id, x: node.x, y: node.y }]),
  );

  const degree = new Map<string, number>();
  graph.nodes.forEach((node) => degree.set(node.id, 0));
  graph.edges.forEach((edge) => {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
  });
  let topId: string | null = null;
  let topDegree = 0;
  degree.forEach((value, id) => {
    if (value > topDegree) {
      topDegree = value;
      topId = id;
    }
  });

  const radius = new Map<string, number>();
  graph.nodes.forEach((node) => radius.set(node.id, node.id === topId ? HUB_RADIUS : NODE_RADIUS));

  return {
    positions: positionMap,
    radiusById: radius,
    hubId: topId,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
  };
}

export type ConceptGroupCluster = {
  /** Concept group id, or UNGROUPED_ID for the object types in none. */
  id: string;
  ungrouped: boolean;
  /** Boundary colour: ungrouped is grey, named groups take the palette in id order. */
  color: string;
  ids: string[];
};

/** The clusters of the group arrangement, ungrouped first, then by group id. */
export function conceptGroupClusters(
  nodeIds: readonly string[],
  groupOf: Map<string, string>,
): ConceptGroupCluster[] {
  const buckets = new Map<string, string[]>();
  nodeIds.forEach((id) => {
    const gid = groupOf.get(id) ?? UNGROUPED_ID;
    const arr = buckets.get(gid) ?? [];
    arr.push(id);
    buckets.set(gid, arr);
  });
  const gids = [...buckets.keys()].sort((left, right) => {
    if (left === UNGROUPED_ID) return -1;
    if (right === UNGROUPED_ID) return 1;
    return left.localeCompare(right);
  });
  let namedGroupIndex = 0;
  return gids.map((gid) => {
    const ungrouped = gid === UNGROUPED_ID;
    return {
      id: gid,
      ungrouped,
      color: ungrouped ? UNGROUPED_COLOR : GROUP_COLORS[namedGroupIndex++ % GROUP_COLORS.length],
      ids: buckets.get(gid) ?? [],
    };
  });
}

/** A cluster's boundary around its members' discs, padded as the canvas draws it. */
export function clusterBounds(
  ids: readonly string[],
  layout: Pick<OntologyLayout, "positions" | "radiusById">,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  ids.forEach((id) => {
    const p = layout.positions.get(id);
    if (!p) return;
    const r = layout.radiusById.get(id) ?? NODE_RADIUS;
    minX = Math.min(minX, p.x - r);
    minY = Math.min(minY, p.y - r);
    maxX = Math.max(maxX, p.x + r);
    maxY = Math.max(maxY, p.y + r);
  });
  if (!Number.isFinite(minX)) return null;
  return {
    x: minX - GROUP_HULL_PAD,
    y: minY - GROUP_HULL_PAD,
    w: maxX - minX + GROUP_HULL_PAD * 2,
    h: maxY - minY + GROUP_HULL_PAD * 2,
  };
}
