/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { BaseLayout, CanvasEvent, ExtensionCategory, Graph, GraphEvent, NodeEvent, register, type EdgeData, type GraphData, type IElementEvent, type LayoutOptions, type NodeData } from "@antv/g6";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

import { stringifyValue, type GEdge, type GNode } from "@/modules/knowledge-network/services/graph-explorer.service";
import type { DragMode, ExplorerLayout, ExplorerShape, NodePosition } from "@/modules/knowledge-network/utils/graph-explorer-cache";

import { MENU_ORDER, type MenuAction } from "./constants";
import { chainPositions } from "./chain-layout";
import { RING_NODE_SPACING, ringPositions } from "./ring-layout";
import styles from "./GraphCanvas.module.css";

/** Visual marks layered on top of the data: path endpoints, pinned nodes, and a highlighted chain. */
export type CanvasMarks = {
  pathStart: string | null;
  pathEnd: string | null;
  pinned: ReadonlySet<string>;
  highlightNodes: ReadonlySet<string>;
  highlightEdges: ReadonlySet<string>;
};

export type GraphCanvasHandle = {
  /** Adds elements; new nodes without a stored position are scattered around `anchorId` when given. */
  addElements(nodes: GNode[], edges: GEdge[], anchorId?: string): Promise<void>;
  removeNode(id: string): Promise<void>;
  clear(): Promise<void>;
  relayout(): Promise<void>;
  fitView(): Promise<void>;
  setLayout(layout: ExplorerLayout): void;
  setShape(shape: ExplorerShape): Promise<void>;
  /** Replaces node data (labels, colours) for nodes already on the canvas. */
  updateNodes(nodes: GNode[]): Promise<void>;
  /** Shows or hides node and edge labels without touching the data. */
  setLabelVisibility(nodeLabels: boolean, edgeLabels: boolean): Promise<void>;
  applyMarks(marks: CanvasMarks): Promise<void>;
  getPositions(): Record<string, NodePosition>;
  /** Replaces the whole canvas (undo): nodes without a stored position get laid out. */
  replaceAll(nodes: GNode[], edges: GEdge[], positions: Record<string, NodePosition>): Promise<void>;
  /** PNG data URL of the whole graph, not just the viewport. */
  exportImage(): Promise<string>;
  /** Ids of nodes currently in the `selected` state (shift+click / shift+drag). */
  getSelectedIds(): string[];
  setDragMode(mode: DragMode): void;
  /** Groups nodes into combos per concept group, or removes the combos with null. */
  setGrouping(grouping: ConceptGrouping | null): Promise<void>;
};

/** Concept-group combos: which combo each object type belongs to, and the combo labels. */
export type ConceptGrouping = {
  combos: { id: string; name: string }[];
  comboByOt: Record<string, string>;
};

export type GraphCanvasProps = {
  initialNodes: GNode[];
  initialEdges: GEdge[];
  initialPositions: Record<string, NodePosition>;
  layout: ExplorerLayout;
  shape: ExplorerShape;
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  dragMode: DragMode;
  colorOf: (otId: string) => string;
  menuLabels: Record<MenuAction, string>;
  /** Context-menu entries to offer; every action by default. */
  menuActions?: MenuAction[];
  onNodeClick?: (id: string) => void;
  onNodeDoubleClick?: (id: string) => void;
  onCanvasClick?: () => void;
  onMenu?: (action: MenuAction, id: string) => void;
  onPositionsChange?: (positions: Record<string, NodePosition>) => void;
};

const LABEL_MAX = 18;
const SCATTER_RADIUS = 140;

function truncate(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text;
}

const NODE_DIAMETER = 64;
const NODE_GAP = 24;
/** Above this the single ring stops fitting a screen and concentric rings take over. */
const SINGLE_RING_MAX_RADIUS = 1200;
/** Neighbours on a ring sit side by side, so they need less room than a force layout leaves. */
const RING_GAP = 8;

/**
 * Concentric rings, registered as a layout G6 can run. The built-in circular layout draws one
 * ring however many nodes it holds, and the concentric layout groups by degree, which puts a
 * star's identical leaves back on a single ring; this fills rings from the inside out.
 */
class RingsLayout extends BaseLayout {
  public id = "rings";

  public execute(model: GraphData): Promise<GraphData> {
    const nodes = model.nodes ?? [];
    const points = ringPositions(nodes.length, RING_NODE_SPACING);
    return Promise.resolve({
      nodes: nodes.map((node, index) => ({ ...node, style: { ...node.style, x: points[index]?.x ?? 0, y: points[index]?.y ?? 0 } })),
      edges: model.edges ?? [],
      combos: model.combos ?? [],
    });
  }
}

register(ExtensionCategory.LAYOUT, "rings", RingsLayout);

/**
 * Each connected part on its own band, running left to right along the relations. Exploring an
 * id list tends to produce several short chains that share no node, and a force layout scatters
 * them; this lets a path read as a line.
 */
class ChainsLayout extends BaseLayout {
  public id = "chains";

  public execute(model: GraphData): Promise<GraphData> {
    const nodes = model.nodes ?? [];
    const edges = model.edges ?? [];
    const points = chainPositions(
      nodes.map((node) => String(node.id)),
      edges.map((edge) => ({ source: String(edge.source), target: String(edge.target) })),
    );
    return Promise.resolve({
      nodes: nodes.map((node) => {
        const point = points.get(String(node.id));
        return { ...node, style: { ...node.style, x: point?.x ?? 0, y: point?.y ?? 0 } };
      }),
      edges,
      combos: model.combos ?? [],
    });
  }
}

register(ExtensionCategory.LAYOUT, "chains", ChainsLayout);

/** Ring radius that fits `count` nodes side by side at NODE_DIAMETER plus the given gap. */
function ringRadiusFor(count: number, gap: number = NODE_GAP): number {
  return (count * (NODE_DIAMETER + gap)) / (2 * Math.PI);
}

/** Degree per node and the busiest node, read from the current graph data. */
function degreeStats(graph: Graph): { count: number; degree: Map<string, number>; hubId: string | null; maxDegree: number } {
  const degree = new Map<string, number>();
  for (const edge of graph.getEdgeData()) {
    degree.set(String(edge.source), (degree.get(String(edge.source)) ?? 0) + 1);
    degree.set(String(edge.target), (degree.get(String(edge.target)) ?? 0) + 1);
  }
  let hubId: string | null = null;
  let maxDegree = 0;
  for (const [id, value] of degree) {
    if (value > maxDegree) {
      maxDegree = value;
      hubId = id;
    }
  }
  return { count: graph.getNodeData().length, degree, hubId, maxDegree };
}

/**
 * Layout options tuned for the shapes exploration produces: stars with one hub and dozens of
 * leaves, and batches of unrelated instances. Edge length grows with the busier endpoint's
 * degree so a hub's leaves get a ring they fit on; radial takes the same radius per level.
 */
function layoutOptions(layout: ExplorerLayout, graph: Graph | null): LayoutOptions {
  const stats = graph ? degreeStats(graph) : { count: 0, degree: new Map<string, number>(), hubId: null, maxDegree: 0 };
  const clampRadius = (count: number) => Math.min(900, Math.max(180, ringRadiusFor(count)));
  switch (layout) {
    case "chain":
      return { type: "chains" };
    case "dagre":
      return { type: "dagre", rankdir: "TB", nodesep: 40, ranksep: 90 };
    case "radial":
      return {
        type: "radial",
        unitRadius: clampRadius(stats.maxDegree),
        focusNode: stats.hubId ?? undefined,
        preventOverlap: true,
        strictRadial: false,
        maxPreventOverlapIteration: 300,
        nodeSize: NODE_DIAMETER,
        nodeSpacing: NODE_GAP,
      };
    case "circular":
      // Without nodeSpacing the layout sizes the ring to the viewport and stacks the nodes on it;
      // given the node size it derives the radius from the circumference the nodes actually need.
      // One ring only while it still fits a screen: past that the ring is thousands of pixels
      // across with an empty middle, so the nodes go into concentric rings instead (see
      // RingsLayout; the library's own concentric layout groups by degree and would not split
      // a star's identical leaves).
      if (ringRadiusFor(stats.count, RING_GAP) <= SINGLE_RING_MAX_RADIUS) {
        return { type: "circular", nodeSize: NODE_DIAMETER, nodeSpacing: RING_GAP };
      }
      return { type: "rings" };
    case "grid":
      return { type: "grid", preventOverlap: true, nodeSize: NODE_DIAMETER, nodeSpacing: NODE_GAP };
    case "force":
    default:
      // d3-force: a real 2D simulation. Collide keeps nodes apart, link length follows the
      // busier endpoint's degree, and a weak link strength lets collide push a crowded ring
      // outwards into shells instead of stacking leaves.
      return {
        type: "d3-force",
        link: {
          distance: (edge: { source: string; target: string }) => clampRadius(Math.max(stats.degree.get(String(edge.source)) ?? 0, stats.degree.get(String(edge.target)) ?? 0)),
          strength: 0.3,
        },
        manyBody: { strength: -160, distanceMax: 700 },
        collide: { radius: NODE_DIAMETER / 2 + NODE_GAP / 2, strength: 1, iterations: 3 },
        alphaDecay: 0.03,
      };
  }
}

/** Fit only when the graph overflows the viewport, then centre it: one node must not fill the screen. */
async function fitGraph(graph: Graph): Promise<void> {
  await graph.fitView({ when: "overflow" }, false);
  await graph.fitCenter(false);
}

function toNodeData(node: GNode, position?: NodePosition, combo?: string): NodeData {
  const data: NodeData = { id: node.id, data: { otId: node.otId, otName: node.otName, display: node.display } };
  if (position) data.style = { x: position.x, y: position.y };
  if (combo) data.combo = combo;
  return data;
}

const COMBO_LAYOUT: LayoutOptions = { type: "combo-combined", comboPadding: 30, spacing: 40 };

function toEdgeData(edge: GEdge): EdgeData {
  return { id: edge.id, source: edge.source, target: edge.target, data: { relTypeName: edge.relTypeName } };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(props, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const readyRef = useRef<Promise<void>>(Promise.resolve());
  // Latest callbacks and lookups; the graph is built once and reads through these refs.
  const propsRef = useRef(props);
  propsRef.current = props;
  const marksRef = useRef<CanvasMarks>({ pathStart: null, pathEnd: null, pinned: new Set(), highlightNodes: new Set(), highlightEdges: new Set() });
  const layoutRef = useRef<ExplorerLayout>(props.layout);
  const labelsRef = useRef({ node: props.showNodeLabels, edge: props.showEdgeLabels });
  const groupingRef = useRef<ConceptGrouping | null>(null);
  const dragModeRef = useRef<DragMode>(props.dragMode);
  // Linked drag: neighbours of the dragged node (not themselves dragged) and how much they follow.
  const linkedDragRef = useRef<{ anchor: string; last: [number, number]; followers: Map<string, number> } | null>(null);
  const comboFor = (otId: string): string | undefined => groupingRef.current?.comboByOt[otId];
  const activeLayout = (): LayoutOptions => (groupingRef.current ? COMBO_LAYOUT : layoutOptions(layoutRef.current, graphRef.current));

  const readPositions = useCallback((): Record<string, NodePosition> => {
    const graph = graphRef.current;
    if (!graph) return {};
    const out: Record<string, NodePosition> = {};
    for (const node of graph.getNodeData()) {
      const x = node.style?.x;
      const y = node.style?.y;
      if (typeof x !== "number" || typeof y !== "number") continue;
      out[String(node.id)] = marksRef.current.pinned.has(String(node.id)) ? { x, y, fixed: true } : { x, y };
    }
    return out;
  }, []);

  const emitPositions = useCallback(() => {
    propsRef.current.onPositionsChange?.(readPositions());
  }, [readPositions]);

  const statesFor = useCallback((): Record<string, string[]> => {
    const graph = graphRef.current;
    if (!graph) return {};
    const marks = marksRef.current;
    const dimming = marks.highlightNodes.size > 0;
    const states: Record<string, string[]> = {};
    for (const node of graph.getNodeData()) {
      const id = String(node.id);
      const list: string[] = [];
      if (marks.pathStart === id) list.push("pathStart");
      if (marks.pathEnd === id) list.push("pathEnd");
      if (marks.pinned.has(id)) list.push("pinned");
      if (dimming) list.push(marks.highlightNodes.has(id) ? "highlight" : "inactive");
      states[id] = list;
    }
    for (const edge of graph.getEdgeData()) {
      const id = String(edge.id);
      states[id] = dimming ? [marks.highlightEdges.has(id) ? "highlight" : "inactive"] : [];
    }
    return states;
  }, []);

  // Positions captured when a node is pinned, so a relayout can put it back.
  const pinnedPositionsRef = useRef<Record<string, NodePosition>>({});

  const restorePinned = useCallback(async () => {
    const graph = graphRef.current;
    if (!graph) return;
    const stored = propsRef.current.initialPositions;
    const targets: Record<string, [number, number]> = {};
    for (const id of marksRef.current.pinned) {
      const position = pinnedPositionsRef.current[id] ?? stored[id];
      if (position) targets[id] = [position.x, position.y];
    }
    if (Object.keys(targets).length > 0) await graph.translateElementTo(targets, false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { initialNodes, initialEdges, initialPositions, layout, shape, colorOf, menuLabels } = propsRef.current;
    layoutRef.current = layout;

    const graph = new Graph({
      container,
      autoResize: false,
      animation: false,
      data: {
        nodes: initialNodes.map((node) => toNodeData(node, initialPositions[node.id])),
        edges: initialEdges.map(toEdgeData),
      },
      node: {
        type: shape,
        style: {
          size: 36,
          fill: (d: NodeData) => propsRef.current.colorOf(stringifyValue(d.data?.otId)) || colorOf(""),
          stroke: "#ffffff",
          lineWidth: 1.5,
          labelText: (d: NodeData) => (labelsRef.current.node ? truncate(stringifyValue(d.data?.display) || String(d.id)) : ""),
          labelPlacement: "bottom",
          labelFontSize: 12,
          labelFill: "#333333",
          labelBackground: true,
          labelBackgroundFill: "rgba(255,255,255,0.85)",
          labelBackgroundRadius: 3,
          labelPadding: [1, 4],
          cursor: "pointer",
        },
        state: {
          pathStart: { halo: true, haloStroke: "#52c41a", haloLineWidth: 8, haloStrokeOpacity: 0.55 },
          pathEnd: { halo: true, haloStroke: "#f5222d", haloLineWidth: 8, haloStrokeOpacity: 0.55 },
          pinned: { stroke: "#1f1f1f", lineWidth: 2.5, lineDash: [4, 2] },
        },
      },
      combo: {
        type: "rect",
        style: {
          labelText: (d: { data?: Record<string, unknown> }) => stringifyValue(d.data?.name),
          labelPlacement: "top",
          labelFontSize: 12,
          labelFill: "#5c6270",
          fillOpacity: 0.05,
          stroke: "#a3a9b8",
          lineDash: [4, 3],
          radius: 8,
        },
      },
      edge: {
        type: "line",
        style: {
          stroke: "#a3a9b8",
          lineWidth: 1.2,
          endArrow: true,
          endArrowSize: 8,
          labelText: (d: EdgeData) => (labelsRef.current.edge ? stringifyValue(d.data?.relTypeName) : ""),
          labelFontSize: 10,
          labelFill: "#5c6270",
          labelBackground: true,
          labelBackgroundFill: "rgba(255,255,255,0.9)",
          labelBackgroundRadius: 2,
          labelPadding: [0, 3],
          labelAutoRotate: true,
        },
      },
      layout: layoutOptions(layout, null),
      // Empty-canvas drag pans, wheel zooms; shift+click or shift+drag selects several nodes,
      // and dragging one selected node moves the whole selection.
      behaviors: [
        // Pan only from empty canvas (G6's default test, restated because a custom `enable` replaces
        // it) and never while Shift is held, which is the brush-select gesture.
        {
          type: "drag-canvas",
          key: "drag-canvas",
          enable: (event: { shiftKey?: boolean; targetType?: string }) => !event.shiftKey && (event.targetType === undefined || event.targetType === "canvas"),
        },
        "zoom-canvas",
        { type: "drag-element", key: "drag-element" },
        { type: "click-select", key: "click-select", multiple: true, trigger: ["shift"] },
        { type: "brush-select", key: "brush-select", trigger: ["shift"], mode: "union" },
      ],
      plugins: [
        {
          type: "contextmenu",
          trigger: "contextmenu",
          enable: (event: IElementEvent) => event.targetType === "node",
          getItems: (event: IElementEvent) => {
            const id = String(event.target.id);
            const labels = propsRef.current.menuLabels ?? menuLabels;
            const marks = marksRef.current;
            return (propsRef.current.menuActions ?? MENU_ORDER).map((action) => {
              // Toggle entries: a node that already carries the mark offers to clear it instead.
              let effective: MenuAction = action;
              if (action === "pin" && marks.pinned.has(id)) effective = "unpin";
              if (action === "setPathStart" && marks.pathStart === id) effective = "clearPathStart";
              if (action === "setPathEnd" && marks.pathEnd === id) effective = "clearPathEnd";
              return { name: labels[effective], value: effective };
            });
          },
          onClick: (value: string, _target: HTMLElement, current: { id: string | number }) => {
            propsRef.current.onMenu?.(value as MenuAction, String(current.id));
          },
        },
        {
          type: "tooltip",
          trigger: "hover",
          enable: (event: IElementEvent) => event.targetType === "node",
          getContent: (_event: IElementEvent, items: unknown[]) => {
            const datum = items[0] as NodeData | undefined;
            const display = escapeHtml(stringifyValue(datum?.data?.display) || String(datum?.id ?? ""));
            const otName = escapeHtml(stringifyValue(datum?.data?.otName));
            return Promise.resolve(`<div style="font-size:12px;line-height:1.5"><b>${display}</b><br/><span style="color:#8c8c8c">${otName}</span></div>`);
          },
        },
      ],
    });
    graphRef.current = graph;
    // Hook for browser drivers (the live verification spec): node positions in viewport space are
    // otherwise unreachable from outside the canvas. It only references the instance already
    // owned by this element.
    (container as HTMLDivElement & { __g6Graph?: Graph }).__g6Graph = graph;

    // A node click also bubbles a canvas click in some G6 builds; remember the node click so the
    // canvas handler does not close the drawer the node just opened.
    let lastNodeClickAt = 0;
    graph.on(NodeEvent.CLICK, (event: IElementEvent) => {
      lastNodeClickAt = Date.now();
      propsRef.current.onNodeClick?.(String(event.target.id));
    });
    graph.on(NodeEvent.DBLCLICK, (event: IElementEvent) => propsRef.current.onNodeDoubleClick?.(String(event.target.id)));
    graph.on(NodeEvent.DRAG_START, (event: IElementEvent) => {
      if (dragModeRef.current !== "linked") return;
      const id = String(event.target.id);
      const dragged = new Set(graph.getElementState(id).includes("selected") ? graph.getNodeData().filter((n) => graph.getElementState(n.id).includes("selected")).map((n) => String(n.id)) : [id]);
      // First ring follows at 0.5, second ring at 0.2; pinned nodes stay put.
      const followers = new Map<string, number>();
      const first = graph.getNeighborNodesData(id).map((n) => String(n.id)).filter((n) => !dragged.has(n) && !marksRef.current.pinned.has(n));
      for (const n of first) followers.set(n, 0.5);
      for (const n of first) {
        for (const second of graph.getNeighborNodesData(n).map((m) => String(m.id))) {
          if (!dragged.has(second) && !followers.has(second) && !marksRef.current.pinned.has(second)) followers.set(second, 0.2);
        }
      }
      const [x, y] = graph.getElementPosition(id);
      linkedDragRef.current = { anchor: id, last: [x, y], followers };
    });
    graph.on(NodeEvent.DRAG, () => {
      const state = linkedDragRef.current;
      if (!state) return;
      const [x, y] = graph.getElementPosition(state.anchor);
      const dx = x - state.last[0];
      const dy = y - state.last[1];
      state.last = [x, y];
      if (dx === 0 && dy === 0) return;
      const moves: Record<string, [number, number]> = {};
      for (const [id, weight] of state.followers) moves[id] = [dx * weight, dy * weight];
      void graph.translateElementBy(moves, false);
    });
    graph.on(NodeEvent.DRAG_END, () => {
      linkedDragRef.current = null;
      emitPositions();
    });
    graph.on(CanvasEvent.CLICK, () => {
      if (Date.now() - lastNodeClickAt < 150) return;
      propsRef.current.onCanvasClick?.();
    });
    graph.on(GraphEvent.AFTER_LAYOUT, () => emitPositions());

    const needsLayout = initialNodes.some((node) => !initialPositions[node.id]);
    readyRef.current = (async () => {
      await graph.draw();
      if (needsLayout && initialNodes.length > 0) await graph.layout();
      if (initialNodes.length > 0) await fitGraph(graph);
    })().catch(() => undefined);

    const observer = new ResizeObserver(() => {
      if (graphRef.current && !graphRef.current.destroyed) graphRef.current.resize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      graphRef.current = null;
      graph.destroy();
    };
    // The graph is created once per mount; later changes go through the imperative handle.
  }, [emitPositions]);

  useImperativeHandle(
    ref,
    (): GraphCanvasHandle => ({
      async addElements(nodes, edges, anchorId) {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        const existing = new Set(graph.getNodeData().map((node) => String(node.id)));
        const fresh = nodes.filter((node) => !existing.has(node.id));
        let anchor: [number, number] | null = null;
        if (anchorId && existing.has(anchorId)) {
          const [x, y] = graph.getElementPosition(anchorId);
          anchor = [x, y];
        } else if (existing.size > 0 && fresh.length > 0) {
          // Nothing to anchor on: drop the batch near the centre of what is already there.
          let sx = 0;
          let sy = 0;
          let count = 0;
          for (const node of graph.getNodeData()) {
            if (typeof node.style?.x === "number" && typeof node.style?.y === "number") {
              sx += node.style.x;
              sy += node.style.y;
              count += 1;
            }
          }
          if (count > 0) anchor = [sx / count + SCATTER_RADIUS * 1.5, sy / count];
        }
        const stored = propsRef.current.initialPositions;
        // Spread the batch over concentric rings sized so neighbouring nodes keep ~70px apart:
        // one ring of radius r fits about 2πr / 70 nodes; further rings step outwards.
        const RING_GAP = 70;
        const rings: { radius: number; slots: number }[] = [];
        let remaining = fresh.filter((node) => !stored[node.id]).length;
        let ringRadius = SCATTER_RADIUS;
        while (remaining > 0) {
          const slots = Math.max(6, Math.floor((2 * Math.PI * ringRadius) / RING_GAP));
          rings.push({ radius: ringRadius, slots: Math.min(slots, remaining) });
          remaining -= slots;
          ringRadius += RING_GAP + 10;
        }
        // Everything already on the canvas counts as an obstacle for the new ring positions.
        const taken: [number, number][] = graph
          .getNodeData()
          .map((item) => [item.style?.x, item.style?.y] as [unknown, unknown])
          .filter((pair): pair is [number, number] => typeof pair[0] === "number" && typeof pair[1] === "number");
        const MIN_GAP = 56;
        const clear = (x: number, y: number) => taken.every(([tx, ty]) => Math.hypot(tx - x, ty - y) >= MIN_GAP);
        let placed = 0;
        const nodeData = fresh.map((node) => {
          const kept = stored[node.id];
          if (kept) return toNodeData(node, kept, comboFor(node.otId));
          if (!anchor) return toNodeData(node, undefined, comboFor(node.otId));
          let ringIndex = 0;
          let offset = placed;
          while (ringIndex < rings.length && offset >= rings[ringIndex].slots) {
            offset -= rings[ringIndex].slots;
            ringIndex += 1;
          }
          const ring = rings[Math.min(ringIndex, rings.length - 1)];
          const angle = (2 * Math.PI * offset) / ring.slots + (ringIndex % 2) * (Math.PI / ring.slots);
          placed += 1;
          // Walk outwards along the same angle until the spot is free of existing nodes.
          let radius = ring.radius;
          let x = anchor[0] + Math.cos(angle) * radius;
          let y = anchor[1] + Math.sin(angle) * radius;
          for (let step = 0; step < 12 && !clear(x, y); step += 1) {
            radius += RING_GAP;
            x = anchor[0] + Math.cos(angle) * radius;
            y = anchor[1] + Math.sin(angle) * radius;
          }
          taken.push([x, y]);
          return toNodeData(node, { x, y }, comboFor(node.otId));
        });
        // A grouped canvas needs the combo of every new object type to exist before its nodes arrive.
        if (groupingRef.current) {
          const existingCombos = new Set(graph.getComboData().map((combo) => String(combo.id)));
          const needed = groupingRef.current.combos.filter((combo) => !existingCombos.has(combo.id) && nodeData.some((item) => item.combo === combo.id));
          if (needed.length > 0) graph.addComboData(needed.map((combo) => ({ id: combo.id, data: { name: combo.name } })));
        }
        const existingEdges = new Set(graph.getEdgeData().map((edge) => String(edge.id)));
        const edgeData = edges.filter((edge) => !existingEdges.has(edge.id)).map(toEdgeData);
        if (nodeData.length > 0) graph.addNodeData(nodeData);
        if (edgeData.length > 0) graph.addEdgeData(edgeData);
        const firstBatch = existing.size === 0;
        await graph.draw();
        if (firstBatch && nodeData.some((node) => !node.style)) {
          await graph.layout();
          await fitGraph(graph);
        } else {
          await graph.setElementState(statesFor(), false);
          emitPositions();
        }
      },
      async removeNode(id) {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        graph.removeNodeData([id]);
        delete pinnedPositionsRef.current[id];
        await graph.draw();
        emitPositions();
      },
      async clear() {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        pinnedPositionsRef.current = {};
        await graph.clear();
        emitPositions();
      },
      async relayout() {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph || graph.getNodeData().length === 0) return;
        graph.setLayout(activeLayout());
        await graph.layout();
        await restorePinned();
        await fitGraph(graph);
        emitPositions();
      },
      async fitView() {
        await readyRef.current;
        if (graphRef.current) await fitGraph(graphRef.current);
      },
      setLayout(layout) {
        layoutRef.current = layout;
        graphRef.current?.setLayout(groupingRef.current ? COMBO_LAYOUT : layoutOptions(layout, graphRef.current));
      },
      async setShape(shape) {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        graph.setNode({ ...graph.getOptions().node, type: shape });
        await graph.draw();
      },
      async updateNodes(nodes) {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        const existing = new Set(graph.getNodeData().map((node) => String(node.id)));
        const updates = nodes.filter((node) => existing.has(node.id)).map((node) => ({ id: node.id, data: { otId: node.otId, otName: node.otName, display: node.display } }));
        if (updates.length === 0) return;
        graph.updateNodeData(updates);
        await graph.draw();
      },
      async setLabelVisibility(nodeLabels, edgeLabels) {
        await readyRef.current;
        labelsRef.current = { node: nodeLabels, edge: edgeLabels };
        const graph = graphRef.current;
        if (!graph) return;
        // Re-setting the element options makes G6 re-evaluate the labelText callbacks on draw.
        const options = graph.getOptions();
        graph.setNode({ ...options.node });
        graph.setEdge({ ...options.edge });
        await graph.draw();
      },
      async applyMarks(marks) {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        for (const id of marks.pinned) {
          if (!pinnedPositionsRef.current[id]) {
            const node = graph.getNodeData().find((item) => String(item.id) === id);
            if (typeof node?.style?.x === "number" && typeof node?.style?.y === "number") {
              pinnedPositionsRef.current[id] = { x: node.style.x, y: node.style.y, fixed: true };
            }
          }
        }
        for (const id of Object.keys(pinnedPositionsRef.current)) {
          if (!marks.pinned.has(id)) delete pinnedPositionsRef.current[id];
        }
        marksRef.current = marks;
        await graph.setElementState(statesFor(), false);
      },
      getPositions: readPositions,
      async replaceAll(nodes, edges, positions) {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        pinnedPositionsRef.current = {};
        const grouping = groupingRef.current;
        const usedCombos = new Set(nodes.map((node) => comboFor(node.otId)).filter((id): id is string => Boolean(id)));
        graph.setData({
          nodes: nodes.map((node) => toNodeData(node, positions[node.id], comboFor(node.otId))),
          edges: edges.map(toEdgeData),
          combos: grouping ? grouping.combos.filter((combo) => usedCombos.has(combo.id)).map((combo) => ({ id: combo.id, data: { name: combo.name } })) : [],
        });
        await graph.draw();
        if (nodes.some((node) => !positions[node.id])) await graph.layout();
        await graph.setElementState(statesFor(), false);
        emitPositions();
      },
      setDragMode(mode) {
        dragModeRef.current = mode;
      },
      getSelectedIds() {
        const graph = graphRef.current;
        if (!graph) return [];
        return graph
          .getNodeData()
          .map((node) => String(node.id))
          .filter((id) => graph.getElementState(id).includes("selected"));
      },
      async setGrouping(grouping) {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) return;
        groupingRef.current = grouping;
        const nodes = graph.getNodeData();
        const edges = graph.getEdgeData();
        const usedCombos = new Set<string>();
        const nextNodes: NodeData[] = nodes.map((node) => {
          const otId = stringifyValue(node.data?.otId);
          const combo = grouping?.comboByOt[otId];
          if (combo) usedCombos.add(combo);
          const copy: NodeData = { ...node, data: { ...node.data } };
          if (combo) copy.combo = combo;
          else delete copy.combo;
          return copy;
        });
        graph.setData({
          nodes: nextNodes,
          edges,
          combos: grouping ? grouping.combos.filter((combo) => usedCombos.has(combo.id)).map((combo) => ({ id: combo.id, data: { name: combo.name } })) : [],
        });
        graph.setLayout(activeLayout());
        await graph.draw();
        if (nodes.length > 0) {
          await graph.layout();
          await fitGraph(graph);
        }
        await graph.setElementState(statesFor(), false);
        emitPositions();
      },
      async exportImage() {
        await readyRef.current;
        const graph = graphRef.current;
        if (!graph) throw new Error("canvas not ready");
        return graph.toDataURL({ mode: "overall", type: "image/png", encoderOptions: 1 });
      },
    }),
    [emitPositions, readPositions, restorePinned, statesFor],
  );

  return <div ref={containerRef} className={styles.canvas} data-testid="graph-explorer-canvas" />;
});
