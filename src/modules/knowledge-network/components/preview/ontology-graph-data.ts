/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/*
 * What the ontology canvas hands to G6, split in two. The structure (positions, colours, concept
 * group boxes) changes only with the graph, the arrangement or the theme. The decorations (names,
 * the index badge, relation names and the highlight states) change with the selection and the
 * zoom, and are applied as updates, so a node the user dragged stays where it was dropped.
 */

import type { ComboData, EdgeData, GraphData, NodeData } from "@antv/g6";

import { GRAPH_PALETTE, type GraphTokens } from "@/modules/knowledge-network/lib/graph-style";
import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import {
  GROUP_HULL_PAD,
  HUB_RADIUS,
  NODE_RADIUS,
  conceptGroupClusters,
  type OntologyLayout,
  type OntologyRenderMode,
} from "@/modules/knowledge-network/utils/ontology-graph-layout";

const DEFAULT_NODE_COLOR = "#2e68ff";
/**
 * What the object type mapping fills in when the definition sets no colour. Taken as no colour:
 * a network whose types all carry it would otherwise be drawn in one blue.
 */
const UNSET_COLOR = "#1677ff";

/** Each type's colour: its own, or a palette slot by its place in the network when it sets none. */
export function typeColors(nodes: readonly { id: string; color?: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  let slot = 0;
  for (const node of nodes) {
    const own = node.color?.trim();
    if (own && own.toLowerCase() !== UNSET_COLOR) out.set(node.id, own);
    else {
      out.set(node.id, GRAPH_PALETTE[slot % GRAPH_PALETTE.length]);
      slot += 1;
    }
  }
  return out;
}
/** Drawn dot radius of an object type with no relation, and the largest an ordinary / hub one gets. */
const MIN_DRAWN_RADIUS = 10;
const MAX_DRAWN_RADIUS = 24;
const MAX_DRAWN_HUB_RADIUS = 30;

/**
 * Drawn dot radius by degree, growing with its square root so a type with many relations stands
 * out. Small dots with the name beside them, so a graph of dozens of types stays readable.
 */
export function drawnRadius(degree: number, hub: boolean): number {
  const radius = MIN_DRAWN_RADIUS + 2.8 * Math.sqrt(Math.max(0, degree));
  return Math.min(hub ? MAX_DRAWN_HUB_RADIUS : MAX_DRAWN_RADIUS, radius);
}
/** Characters of a name drawn under its disc. */
const NAME_CHARS = 10;
const INDEX_BADGE_COLOR = "#34d399";
/** Font sizes of names, as drawn at 100% and kept on screen when zoomed out. */
const NAME_FONT = 11;
const HUB_NAME_FONT = 12;
const RELATION_FONT = 9;
/** Gap between a disc and the name under it. */
const NAME_OFFSET = 3;

function truncate(value: string, max = 6) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export type OntologyStructureInput = {
  graph: KnowledgeNetworkPreviewGraph;
  layout: OntologyLayout;
  renderMode: OntologyRenderMode;
  groupOf?: Map<string, string>;
  groupNames?: Map<string, string>;
  tokens: GraphTokens;
  /** Label of the box around object types in no concept group. */
  ungroupedLabel: string;
};

/** Nodes at their arranged positions, plain relations, and a box per concept group. */
export function buildOntologyStructure(input: OntologyStructureInput): Required<GraphData> {
  const { graph, layout, renderMode, groupOf, groupNames, tokens } = input;
  const grouped = renderMode === "group" && groupOf !== undefined && groupOf.size > 0;
  const clusters = grouped
    ? conceptGroupClusters(
        graph.nodes.map((node) => node.id),
        groupOf,
      )
    : [];
  const comboOf = new Map<string, string>();
  const comboLabel = new Map(
    clusters.map((cluster) => [
      cluster.id,
      cluster.ungrouped ? input.ungroupedLabel : (groupNames?.get(cluster.id) ?? cluster.id),
    ]),
  );
  clusters.forEach((cluster) => cluster.ids.forEach((id) => comboOf.set(id, cluster.id)));

  const degree = new Map<string, number>();
  graph.edges.forEach((edge) => {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
  });

  const colorOf = typeColors(graph.nodes);
  const nodes: NodeData[] = graph.nodes.map((node) => {
    const position = layout.positions.get(node.id);
    const hub = (layout.radiusById.get(node.id) ?? NODE_RADIUS) === HUB_RADIUS;
    const color = colorOf.get(node.id) ?? DEFAULT_NODE_COLOR;
    const combo = comboOf.get(node.id);
    return {
      id: node.id,
      ...(combo ? { combo } : {}),
      data: {
        name: node.name,
        hub: node.id === layout.hubId,
        ...(combo ? { group: comboLabel.get(combo) } : {}),
      },
      style: {
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        size: drawnRadius(degree.get(node.id) ?? 0, hub) * 2,
        fill: color,
        // Stated so G6 has a value to return to when the dimmed state is cleared.
        opacity: 1,
        stroke: tokens.inverse,
        lineWidth: 1.5,
        haloStroke: color,
        // Under the dot, clear of the index badge at its top right and of the next type in a row.
        labelPlacement: "bottom",
        labelOffsetY: NAME_OFFSET,
        labelFill: tokens.text,
        labelFontSize: hub ? HUB_NAME_FONT : NAME_FONT,
        labelFontWeight: hub ? 600 : 500,
        cursor: "grab",
      },
    };
  });

  const edges: EdgeData[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    data: { name: edge.name },
    style: {
      // Stated so G6 has a value to return to when the dimmed state is cleared.
      opacity: 1,
      // Relations stay one quiet grey: the types carry the colour.
      stroke: tokens.faint,
      lineWidth: 1,
      endArrow: true,
      endArrowSize: 6,
      labelFill: tokens.text,
      labelFontSize: RELATION_FONT,
      labelFontWeight: 500,
      labelBackground: true,
      labelBackgroundFill: tokens.surface,
      labelBackgroundStroke: tokens.border,
      labelBackgroundLineWidth: 1,
      labelBackgroundRadius: 8,
      labelPadding: [2, 6],
      labelAutoRotate: false,
      // Right on the line's midpoint: G6 nudges it aside by default, which the overlap test
      // does not know about.
      labelOffsetX: 0,
      labelOffsetY: 0,
    },
  }));

  const combos: ComboData[] = clusters.map((cluster) => ({
    id: cluster.id,
    data: { ungrouped: cluster.ungrouped },
    style: {
      radius: 22,
      padding: GROUP_HULL_PAD,
      fill: cluster.color,
      fillOpacity: 0.06,
      stroke: cluster.color,
      strokeOpacity: 0.85,
      lineWidth: 1.4,
      lineDash: [7, 5],
      labelText: cluster.ungrouped
        ? input.ungroupedLabel
        : (groupNames?.get(cluster.id) ?? cluster.id),
      labelFill: cluster.color,
      labelFontSize: 14,
      labelFontWeight: 600,
      // The name sits inside the box at its top-left corner, as the boundary's caption.
      labelPlacement: "top-left",
      labelTextAlign: "left",
      labelOffsetX: 14,
      labelOffsetY: 30,
      cursor: "move",
    },
  }));

  return { nodes, edges, combos };
}

export type OntologyDecorationInput = {
  graph: KnowledgeNetworkPreviewGraph;
  /** The best-connected type, drawn larger (OntologyLayout.hubId). */
  hubId: string | null;
  /** Arranged positions, to keep relation names from piling up where lines meet. */
  positions?: OntologyLayout["positions"];
  selectedId: string | null;
  indexedIds: Set<string>;
  edgeLabelsVisible: boolean;
  /** The toolbar's object type names switch; the selected type is named either way. */
  nodeLabelsVisible?: boolean;
  zoom: number;
  defaultEdgeName: string;
};

export type OntologyDecorations = {
  nodes: NodeData[];
  edges: EdgeData[];
  /** Highlight states by element id: the selection, the relations it takes part in, the rest. */
  states: Record<string, string[]>;
};

/**
 * Canvas units per screen pixel for names. Zoomed out, names keep their size on screen instead of
 * shrinking past reading with the graph. Zoomed in, they grow with it, more slowly than the dots
 * (by the square root of the zoom), so they stay in proportion without swelling.
 */
export function labelScale(zoom: number): number {
  if (zoom <= 0) return 1;
  return zoom < 1 ? 1 / zoom : 1 / Math.sqrt(zoom);
}

/** Approximate width of a line of text: CJK characters are square, the rest about half as wide. */
function textWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) width += (char.codePointAt(0) ?? 0) > 0x2e7f ? fontSize : fontSize * 0.6;
  return width;
}

/** A taken area, and the object type whose dot it is, when it is one. */
/**
 * Where G6 draws a relation's name: halfway along the visible line, between the two dots' edges.
 * A relation from a type to itself is drawn as a loop above the dot, as tall as the dot is wide,
 * with the name at its top.
 */
export function relationNameAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  loop: boolean,
  radius: { source: number; target: number },
): { x: number; y: number } {
  if (loop) return { x: a.x, y: a.y - radius.source * 2.5 };
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const shift = (radius.source - radius.target) / 2 / length;
  return {
    x: (a.x + b.x) / 2 + (b.x - a.x) * shift,
    y: (a.y + b.y) / 2 + (b.y - a.y) * shift,
  };
}

type Box = { x0: number; y0: number; x1: number; y1: number; dot?: string };

/** Boxes already taken on the canvas, bucketed by area so a test looks only at its neighbours. */
class Occupancy {
  private readonly cells = new Map<string, Box[]>();

  constructor(private readonly cell: number) {}

  private keys(box: Box): string[] {
    const out: string[] = [];
    for (let cx = Math.floor(box.x0 / this.cell); cx <= Math.floor(box.x1 / this.cell); cx++) {
      for (let cy = Math.floor(box.y0 / this.cell); cy <= Math.floor(box.y1 / this.cell); cy++) {
        out.push(`${cx}:${cy}`);
      }
    }
    return out;
  }

  /** Whether the box overlaps a taken one, the dots of `except` aside. */
  covers(box: Box, except?: ReadonlySet<string>): boolean {
    return this.keys(box).some((key) =>
      (this.cells.get(key) ?? []).some(
        (other) =>
          !(other.dot !== undefined && except?.has(other.dot)) &&
          box.x0 < other.x1 &&
          box.x1 > other.x0 &&
          box.y0 < other.y1 &&
          box.y1 > other.y0,
      ),
    );
  }

  add(box: Box) {
    for (const key of this.keys(box)) {
      const list = this.cells.get(key);
      if (list) list.push(box);
      else this.cells.set(key, [box]);
    }
  }
}

/**
 * Names, index badges, relation names and highlight states for the current selection and zoom.
 *
 * Names are placed in order of importance: the selected type, its neighbours, then by how many
 * relations a type has; each relation name follows, the selection's first. A name whose box would
 * cover a name already placed is left out (a relation name also keeps off other types' dots), so
 * more names appear as the view zooms in and the important ones stay when it zooms out. Without
 * positions every eligible name is drawn.
 */
export function buildOntologyDecorations(input: OntologyDecorationInput): OntologyDecorations {
  const { graph, selectedId, indexedIds, positions } = input;
  const neighbours = new Set<string>();
  if (selectedId) {
    graph.edges.forEach((edge) => {
      if (edge.sourceId === selectedId) neighbours.add(edge.targetId);
      if (edge.targetId === selectedId) neighbours.add(edge.sourceId);
    });
  }
  const degree = new Map<string, number>();
  graph.edges.forEach((edge) => {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
  });
  const radiusOf = (id: string) => drawnRadius(degree.get(id) ?? 0, id === input.hubId);
  const scale = labelScale(input.zoom);
  const names = new Occupancy(80 * scale);
  // Relation names keep off other types' dots too. Type names do not: the best-connected types sit
  // among the dots of their neighbours, and would never be named.
  const dots = new Occupancy(80 * scale);
  graph.nodes.forEach((node) => {
    const at = positions?.get(node.id);
    if (!at) return;
    const radius = radiusOf(node.id);
    dots.add({
      x0: at.x - radius,
      y0: at.y - radius,
      x1: at.x + radius,
      y1: at.y + radius,
      dot: node.id,
    });
  });

  const rank = (id: string) => (id === selectedId ? 2 : neighbours.has(id) ? 1 : 0);
  const nodeNames = new Map<string, string>();
  graph.nodes
    .filter((node) => (input.nodeLabelsVisible ?? true) || rank(node.id) > 0)
    .sort(
      (a, b) =>
        rank(b.id) - rank(a.id) ||
        Number(b.id === input.hubId) - Number(a.id === input.hubId) ||
        (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0),
    )
    .forEach((node) => {
      const text = truncate(node.name, NAME_CHARS);
      const at = positions?.get(node.id);
      if (!at) {
        nodeNames.set(node.id, text);
        return;
      }
      const font = (node.id === input.hubId ? HUB_NAME_FONT : NAME_FONT) * scale;
      const halfW = textWidth(text, font) / 2 + 2 * scale;
      const top = at.y + radiusOf(node.id) + NAME_OFFSET * scale;
      const box = { x0: at.x - halfW, y0: top, x1: at.x + halfW, y1: top + font * 1.3 };
      // The selected type is always named.
      if (node.id !== selectedId && names.covers(box)) return;
      names.add(box);
      nodeNames.set(node.id, text);
    });

  const isActive = (edge: (typeof graph.edges)[number]) =>
    selectedId !== null && (edge.sourceId === selectedId || edge.targetId === selectedId);
  const weight = (edge: (typeof graph.edges)[number]) =>
    (degree.get(edge.sourceId) ?? 0) + (degree.get(edge.targetId) ?? 0);
  const relationNames = new Map<string, string>();
  graph.edges
    .filter((edge) => input.edgeLabelsVisible || isActive(edge))
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || weight(b) - weight(a))
    .forEach((edge) => {
      const text = edge.name || input.defaultEdgeName;
      const a = positions?.get(edge.sourceId);
      const b = positions?.get(edge.targetId);
      if (!a || !b) {
        relationNames.set(edge.id, text);
        return;
      }
      const font = RELATION_FONT * scale;
      // The drawn box: text, padding and outline, as measured on the canvas.
      const halfW = textWidth(text, font) / 2 + 8 * scale;
      const halfH = font * 1.15;
      const { x: mx, y: my } = relationNameAt(a, b, edge.sourceId === edge.targetId, {
        source: radiusOf(edge.sourceId),
        target: radiusOf(edge.targetId),
      });
      const box = { x0: mx - halfW, y0: my - halfH, x1: mx + halfW, y1: my + halfH };
      // A name may lie over its own two dots: between close types there is no room otherwise.
      if (names.covers(box) || dots.covers(box, new Set([edge.sourceId, edge.targetId]))) return;
      names.add(box);
      relationNames.set(edge.id, text);
    });

  const states: Record<string, string[]> = {};
  // A badge is placed at the corner of the node's box; pulled in along the diagonal, it sits on
  // the circle instead of floating beside a small disc.
  const indexBadge = (id: string) => {
    const inset = radiusOf(id) * (1 - Math.SQRT1_2);
    // A filled circle glyph: a badge's background follows the text's box and comes out a capsule,
    // while the glyph itself is round.
    return {
      text: "●",
      placement: "right-top" as const,
      fill: INDEX_BADGE_COLOR,
      stroke: "#ffffff",
      lineWidth: 1.5,
      fontSize: 11,
      backgroundFill: "transparent",
      padding: [0, 0],
      offsetX: -inset,
      offsetY: inset,
    };
  };

  const nodes: NodeData[] = graph.nodes.map((node) => {
    const selected = node.id === selectedId;
    const dim = selectedId !== null && !selected && !neighbours.has(node.id);
    states[node.id] = selected ? ["selected"] : dim ? ["inactive"] : [];
    return {
      id: node.id,
      style: {
        labelText: nodeNames.get(node.id) ?? "",
        labelFontSize: (node.id === input.hubId ? HUB_NAME_FONT : NAME_FONT) * scale,
        labelOffsetY: NAME_OFFSET * scale,
        // A small green dot on the disc's edge at its top right: the object type has an index.
        badges: indexedIds.has(node.id) ? [indexBadge(node.id)] : [],
      },
    };
  });

  const edges: EdgeData[] = graph.edges.map((edge) => {
    const active = isActive(edge);
    states[edge.id] = active ? ["active"] : selectedId !== null ? ["inactive"] : [];
    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      style: {
        labelText: relationNames.get(edge.id) ?? "",
        labelFontSize: RELATION_FONT * scale,
        labelPadding: [2 * scale, 6 * scale],
        labelBackgroundRadius: 8 * scale,
        labelBackgroundLineWidth: scale,
      },
    };
  });

  return { nodes, edges, states };
}
