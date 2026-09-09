/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CanvasEvent, Graph, GraphEvent, NodeEvent, type EdgeData, type IElementEvent, type LayoutOptions, type NodeData } from "@antv/g6";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

import { stringifyValue, type GEdge, type GNode } from "@/modules/knowledge-network/services/graph-explorer.service";
import type { ExplorerLayout, ExplorerShape, NodePosition } from "@/modules/knowledge-network/utils/graph-explorer-cache";

import { MENU_ORDER, type MenuAction } from "./constants";
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
};

export type GraphCanvasProps = {
  initialNodes: GNode[];
  initialEdges: GEdge[];
  initialPositions: Record<string, NodePosition>;
  layout: ExplorerLayout;
  shape: ExplorerShape;
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  colorOf: (otId: string) => string;
  menuLabels: Record<MenuAction, string>;
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

function layoutOptions(layout: ExplorerLayout): LayoutOptions {
  switch (layout) {
    case "dagre":
      return { type: "dagre", rankdir: "TB", nodesep: 40, ranksep: 90 };
    case "radial":
      return { type: "radial", unitRadius: 130, preventOverlap: true, nodeSize: 48 };
    case "circular":
      return { type: "circular" };
    case "grid":
      return { type: "grid", preventOverlap: true, nodeSize: 48 };
    case "force":
    default:
      return { type: "force", preventOverlap: true, nodeSize: 48, linkDistance: 160 };
  }
}

/** Fit only when the graph overflows the viewport, then centre it: one node must not fill the screen. */
async function fitGraph(graph: Graph): Promise<void> {
  await graph.fitView({ when: "overflow" }, false);
  await graph.fitCenter(false);
}

function toNodeData(node: GNode, position?: NodePosition): NodeData {
  const data: NodeData = { id: node.id, data: { otId: node.otId, otName: node.otName, display: node.display } };
  if (position) data.style = { x: position.x, y: position.y };
  return data;
}

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
      layout: layoutOptions(layout),
      behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
      plugins: [
        {
          type: "contextmenu",
          trigger: "contextmenu",
          enable: (event: IElementEvent) => event.targetType === "node",
          getItems: (event: IElementEvent) => {
            const id = String(event.target.id);
            const labels = propsRef.current.menuLabels ?? menuLabels;
            const marks = marksRef.current;
            return MENU_ORDER.map((action) => {
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

    graph.on(NodeEvent.CLICK, (event: IElementEvent) => propsRef.current.onNodeClick?.(String(event.target.id)));
    graph.on(NodeEvent.DBLCLICK, (event: IElementEvent) => propsRef.current.onNodeDoubleClick?.(String(event.target.id)));
    graph.on(NodeEvent.DRAG_END, () => emitPositions());
    graph.on(CanvasEvent.CLICK, () => propsRef.current.onCanvasClick?.());
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
        const nodeData = fresh.map((node, index) => {
          const kept = stored[node.id];
          if (kept) return toNodeData(node, kept);
          if (!anchor) return toNodeData(node);
          const angle = (2 * Math.PI * index) / Math.max(fresh.length, 1) + Math.random() * 0.4;
          const radius = SCATTER_RADIUS + Math.random() * 60;
          return toNodeData(node, { x: anchor[0] + Math.cos(angle) * radius, y: anchor[1] + Math.sin(angle) * radius });
        });
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
        graph.setLayout(layoutOptions(layoutRef.current));
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
        graphRef.current?.setLayout(layoutOptions(layout));
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
    }),
    [emitPositions, readPositions, restorePinned, statesFor],
  );

  return <div ref={containerRef} className={styles.canvas} data-testid="graph-explorer-canvas" />;
});
