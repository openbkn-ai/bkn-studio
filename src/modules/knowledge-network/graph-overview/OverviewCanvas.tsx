/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { MultiDirectedGraph } from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Sigma from "sigma";
import type { Settings } from "sigma/settings";

import styles from "./GraphOverviewPage.module.css";
import { isolatedBand, type Bounds } from "./isolated-band";
import type { OverviewEdge, OverviewNode } from "./overview-queries";

/*
 * The overview canvas: WebGL points and lines through sigma, laid out by ForceAtlas2
 * in a Web Worker. Names show where there is room for them and on hover.
 */

type NodeAttributes = {
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
  otId: string;
  /** Pinned where the user dropped it; ForceAtlas2 leaves a fixed node in place. */
  fixed?: boolean;
};
type EdgeAttributes = { relTypeId: string; size: number; color?: string };

/** How long the layout runs on its own before it stops; the toolbar can run it again. */
export const LAYOUT_RUN_MS = 20_000;

/*
 * Opaque colours only: sigma blends as premultiplied alpha (ONE, ONE_MINUS_SRC_ALPHA), so a plain
 * rgba line adds near full brightness and twenty thousand of them wash the canvas white. Each line
 * colour sits just off the page background instead.
 */
const THEME = {
  light: {
    edge: "#dde2ea",
    edgeStrong: "#4a5160",
    edgeMany: "#a3abb8",
    dim: "#e6e9ef",
    label: "#333333",
    hoverBg: "#ffffff",
    hoverBorder: "rgba(0, 0, 0, 0.12)",
  },
  dark: {
    edge: "#272b34",
    edgeStrong: "#c9ced8",
    edgeMany: "#5c6372",
    dim: "#2a2e37",
    label: "rgba(255, 255, 255, 0.92)",
    hoverBg: "#23262d",
    hoverBorder: "rgba(255, 255, 255, 0.18)",
  },
};

export type OverviewCanvasHandle = {
  fit(): void;
  focus(id: string): void;
  runLayout(): void;
  stopLayout(): void;
};

export type OverviewCanvasProps = {
  nodes: OverviewNode[];
  edges: OverviewEdge[];
  colorOf: (otId: string) => string;
  relationName: (relTypeId: string) => string;
  hiddenTypes: ReadonlySet<string>;
  /** The node whose neighbourhood is highlighted. */
  selectedId: string | null;
  /** Nodes picked by box or by type; highlighted when no node is selected. */
  picked: ReadonlySet<string>;
  dark: boolean;
  /** Starts the layout once, when loading has finished. */
  settled: boolean;
  onNodeClick: (id: string) => void;
  onStageClick: () => void;
  onBoxSelect: (ids: string[]) => void;
  onLayoutRunning: (running: boolean) => void;
};

/** How much of the dense middle's width the view shows once laid out: below 1 magnifies. */
const CORE_ZOOM = 0.6;

/** Highlighted points beyond which their lines are drawn thin and light. */
const MANY_LINES = 60;
/** Highlighted points up to which each line is labelled with its relation's name. */
const NAMED_LINES = 24;

/** A stable number in [0, 1) from a string, so a reload puts every point where it was. */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

/**
 * Where a new point starts: each object type gets its own sector of a ring, and its points spread
 * over a disc there. Starting apart by type is what lets the layout settle quickly.
 */
function seedPosition(
  node: OverviewNode,
  typeIndex: number,
  typeCount: number,
): { x: number; y: number } {
  const angle = (2 * Math.PI * typeIndex) / Math.max(1, typeCount);
  const ring = typeCount > 1 ? 100 : 0;
  const r = 40 * Math.sqrt(hash01(node.id));
  const theta = 2 * Math.PI * hash01(`${node.id}#`);
  return {
    x: ring * Math.cos(angle) + r * Math.cos(theta),
    y: ring * Math.sin(angle) + r * Math.sin(theta),
  };
}

/** Three sizes by degree on the canvas: leaves, ordinary points and hubs. */
function sizeFor(degree: number): number {
  if (degree > 20) return 4.5;
  if (degree > 3) return 2.5;
  return 1.5;
}

export const OverviewCanvas = forwardRef<OverviewCanvasHandle, OverviewCanvasProps>(
  function OverviewCanvas(props, ref) {
    const { nodes, edges, colorOf, relationName, hiddenTypes, selectedId, picked, dark, settled } =
      props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const graphRef = useRef(new MultiDirectedGraph<NodeAttributes, EdgeAttributes>());
    const sigmaRef = useRef<Sigma<NodeAttributes, EdgeAttributes> | null>(null);
    const layoutRef = useRef<FA2Layout | null>(null);
    const stopTimerRef = useRef<number | undefined>(undefined);
    const propsRef = useRef(props);
    propsRef.current = props;
    const [box, setBox] = useState<{
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    } | null>(null);
    const layoutStartedRef = useRef(false);
    /** Set when a box selection ends: the click the browser sends after it is not a stage click. */
    const boxEndedRef = useRef(false);

    /* ------------------------------ sigma ------------------------------ */

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const graph = graphRef.current;
      const sigma = new Sigma<NodeAttributes, EdgeAttributes>(graph, container, {
        allowInvalidContainer: true,
        defaultEdgeType: "line",
        hideEdgesOnMove: false,
        labelDensity: 0.6,
        labelGridCellSize: 120,
        // Hubs (4.5) are named in the fitted view; other names appear as the view zooms in.
        labelRenderedSizeThreshold: 4,
        labelFont: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        labelSize: 12,
        renderEdgeLabels: true,
        edgeLabelSize: 11,
        zIndex: true,
        // Sigma's default floor (1.7 px) lets twenty thousand lines paint the whole background.
        minEdgeThickness: 0.4,
        minCameraRatio: 0.01,
        maxCameraRatio: 4,
      });
      sigmaRef.current = sigma;
      // Dragging a point: the camera stays put, the point follows the pointer and stays where it
      // is dropped. A running layout stops first, or it would pull the point straight back.
      let dragged: string | null = null;
      let moved = false;
      sigma.on("downNode", ({ node }) => {
        dragged = node;
        moved = false;
        if (layoutRef.current?.isRunning()) {
          layoutRef.current.stop();
          window.clearTimeout(stopTimerRef.current);
          propsRef.current.onLayoutRunning(false);
        }
        // Without a fixed frame the view would rescale as the point leaves the old bounds.
        if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
      });
      sigma.getMouseCaptor().on("mousemovebody", (event) => {
        if (!dragged) return;
        const position = sigma.viewportToGraph(event);
        graph.mergeNodeAttributes(dragged, { x: position.x, y: position.y, fixed: true });
        moved = true;
        event.preventSigmaDefault();
        event.original.preventDefault();
        event.original.stopPropagation();
      });
      sigma.getMouseCaptor().on("mouseup", () => {
        dragged = null;
      });
      sigma.on("clickNode", ({ node }) => {
        // The click that ends a drag is not a selection.
        if (moved) {
          moved = false;
          return;
        }
        propsRef.current.onNodeClick(node);
      });
      sigma.on("clickStage", () => {
        if (boxEndedRef.current) {
          boxEndedRef.current = false;
          return;
        }
        propsRef.current.onStageClick();
      });
      sigma.on("enterNode", () => {
        container.style.cursor = "pointer";
      });
      sigma.on("leaveNode", () => {
        container.style.cursor = "";
      });
      return () => {
        window.clearTimeout(stopTimerRef.current);
        layoutRef.current?.kill();
        layoutRef.current = null;
        sigma.kill();
        sigmaRef.current = null;
      };
    }, []);

    /**
     * Lays the points with no relation out as a band under the connected part and fixes them,
     * so the layout cannot push them out to its edges. The gap between them is the connected
     * part's average spacing.
     */
    const placeIsolated = () => {
      const graph = graphRef.current;
      const isolated: string[] = [];
      let connected = 0;
      let bounds: Bounds | null = null;
      graph.forEachNode((id, attributes) => {
        if (graph.degree(id) === 0) {
          isolated.push(id);
          return;
        }
        connected += 1;
        const { x, y } = attributes;
        bounds = bounds
          ? {
              minX: Math.min(bounds.minX, x),
              minY: Math.min(bounds.minY, y),
              maxX: Math.max(bounds.maxX, x),
              maxY: Math.max(bounds.maxY, y),
            }
          : { minX: x, minY: y, maxX: x, maxY: y };
      });
      const above = bounds as Bounds | null;
      if (isolated.length === 0 || !above) return;
      const area = Math.max(1, (above.maxX - above.minX) * (above.maxY - above.minY));
      const spacing = Math.max(0.5, Math.sqrt(area / connected) * 0.8);
      const band = isolatedBand(
        isolated.map((_, i) => i),
        (i) => graph.getNodeAttribute(isolated[i], "otId"),
        above,
        spacing,
        { yDown: false },
      );
      band.order.forEach((i, k) => {
        graph.mergeNodeAttributes(isolated[i], {
          x: band.positions[k * 2],
          y: band.positions[k * 2 + 1],
          fixed: true,
        });
      });
    };

    /* ------------------------------ data ------------------------------ */

    useEffect(() => {
      const graph = graphRef.current;
      const keep = new Set(nodes.map((node) => node.id));
      // A layout, running or stopped, listens to every change and restarts its worker on each one;
      // it is rebuilt when the layout next runs, which a finished load does by itself.
      if (layoutRef.current) {
        if (layoutRef.current.isRunning()) {
          window.clearTimeout(stopTimerRef.current);
          propsRef.current.onLayoutRunning(false);
        }
        layoutRef.current.kill();
        layoutRef.current = null;
      }
      // A reload with other results drops what is no longer there. Dropping ten thousand points
      // one by one froze the page for seconds, so a reload that keeps none of them clears at once.
      let kept = 0;
      graph.forEachNode((id) => {
        if (keep.has(id)) kept += 1;
      });
      if (kept === 0) graph.clear();
      else
        graph.forEachNode((id) => {
          if (!keep.has(id)) graph.dropNode(id);
        });
      const typeOrder = [...new Set(nodes.map((node) => node.otId))];
      const typeIndex = new Map(typeOrder.map((otId, index) => [otId, index]));
      for (const node of nodes) {
        if (graph.hasNode(node.id)) {
          graph.mergeNodeAttributes(node.id, {
            label: node.display,
            color: colorOf(node.otId),
          });
          continue;
        }
        graph.addNode(node.id, {
          ...seedPosition(node, typeIndex.get(node.otId) ?? 0, typeOrder.length),
          size: 1.5,
          color: colorOf(node.otId),
          label: node.display,
          otId: node.otId,
        });
      }
      for (const edge of edges) {
        if (graph.hasEdge(edge.id) || !graph.hasNode(edge.source) || !graph.hasNode(edge.target))
          continue;
        graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
          relTypeId: edge.relTypeId,
          size: 0.6,
        });
      }
      graph.forEachNode((id) => graph.setNodeAttribute(id, "size", sizeFor(graph.degree(id))));
      placeIsolated();
      sigmaRef.current?.refresh();
    }, [nodes, edges, colorOf]);

    /* ------------------------------ theme and highlight ------------------------------ */

    useEffect(() => {
      const sigma = sigmaRef.current;
      if (!sigma) return;
      const theme = dark ? THEME.dark : THEME.light;
      const graph = graphRef.current;
      const focus = new Set<string>();
      if (selectedId && graph.hasNode(selectedId)) {
        focus.add(selectedId);
        graph.forEachNeighbor(selectedId, (neighbour) => focus.add(neighbour));
      } else {
        for (const id of picked) focus.add(id);
      }
      const focusing = focus.size > 0;
      // Named outright only while few points are highlighted; beyond that the grid picks.
      const nameAll = focusing && focus.size <= 60;
      // A hub's hundreds of lines: no names on them (the page lists them by relation instead),
      // and thinner, lighter strokes so they do not merge into one dark mass.
      const many = focus.size > MANY_LINES;
      const nameLines = focus.size <= NAMED_LINES;
      const settings: Partial<Settings<NodeAttributes, EdgeAttributes>> = {
        labelColor: { color: theme.label },
        edgeLabelColor: { color: theme.label },
        defaultEdgeColor: theme.edge,
        defaultDrawNodeHover: (context, data, settings) => {
          const size = settings.labelSize;
          context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
          const label = data.label ?? "";
          const width = context.measureText(label).width;
          const x = data.x + data.size + 4;
          const y = data.y;
          context.fillStyle = theme.hoverBg;
          context.strokeStyle = theme.hoverBorder;
          context.beginPath();
          context.roundRect(x - 4, y - size / 2 - 4, width + 8, size + 8, 4);
          context.fill();
          context.stroke();
          context.beginPath();
          context.arc(data.x, data.y, data.size + 2, 0, Math.PI * 2);
          context.fillStyle = data.color;
          context.fill();
          context.fillStyle = theme.label;
          context.textBaseline = "middle";
          context.fillText(label, x, y + 1);
        },
        nodeReducer: (node, data) => {
          if (hiddenTypes.has(data.otId)) return { ...data, hidden: true };
          if (!focusing) return data;
          // Small and close to the background, so the highlighted lines and their names read on top.
          if (!focus.has(node))
            return { ...data, color: theme.dim, label: "", size: data.size * 0.4, zIndex: 0 };
          return {
            ...data,
            zIndex: 1,
            highlighted: node === selectedId,
            forceLabel: nameAll || node === selectedId,
          };
        },
        edgeReducer: (edge, data) => {
          const [source, target] = graph.extremities(edge);
          const sourceOt = graph.getNodeAttribute(source, "otId");
          const targetOt = graph.getNodeAttribute(target, "otId");
          if (hiddenTypes.has(sourceOt) || hiddenTypes.has(targetOt))
            return { ...data, hidden: true };
          if (!focusing) return { ...data, label: undefined };
          const strong = selectedId
            ? source === selectedId || target === selectedId
            : focus.has(source) && focus.has(target);
          if (!strong) return { ...data, hidden: true };
          return {
            ...data,
            color: many ? theme.edgeMany : theme.edgeStrong,
            size: many ? 0.5 : 1.2,
            zIndex: 1,
            label: selectedId && nameLines ? relationName(data.relTypeId) : undefined,
          };
        },
      };
      for (const [key, value] of Object.entries(settings))
        sigma.setSetting(key as keyof Settings<NodeAttributes, EdgeAttributes>, value);
      sigma.refresh();
    }, [dark, hiddenTypes, selectedId, picked, relationName, nodes, edges]);

    /* ------------------------------ layout ------------------------------ */

    /**
     * Opens the view on the dense middle, magnified: the canvas is larger than the screen and the
     * rest is a drag away. The middle is taken from where most points are (10th to 90th
     * percentile), since a few outliers stretch the full bounds and a plain zoom would still show
     * everything.
     */
    const zoomIntoCore = () => {
      const sigma = sigmaRef.current;
      if (!sigma) return;
      const xs: number[] = [];
      const ys: number[] = [];
      graphRef.current.forEachNode((id) => {
        const data = sigma.getNodeDisplayData(id);
        if (!data) return;
        xs.push(data.x);
        ys.push(data.y);
      });
      if (xs.length === 0) return;
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      const at = (values: number[], share: number) =>
        values[Math.floor((values.length - 1) * share)];
      const [x0, x1, y0, y1] = [at(xs, 0.1), at(xs, 0.9), at(ys, 0.1), at(ys, 0.9)];
      const ratio = Math.min(1, Math.max(0.02, Math.max(x1 - x0, y1 - y0) * CORE_ZOOM));
      void sigma
        .getCamera()
        .animate({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, ratio }, { duration: 500 });
    };

    const stopLayout = () => {
      window.clearTimeout(stopTimerRef.current);
      if (layoutRef.current?.isRunning()) layoutRef.current.stop();
      // The connected part has grown since the band was laid: lay it again under it.
      placeIsolated();
      propsRef.current.onLayoutRunning(false);
    };

    const runLayout = () => {
      const graph = graphRef.current;
      if (graph.order === 0) return;
      layoutRef.current?.kill();
      // Let the view follow the new layout again.
      sigmaRef.current?.setCustomBBox(null);
      const settings = forceAtlas2.inferSettings(graph);
      layoutRef.current = new FA2Layout(graph, {
        settings: {
          ...settings,
          barnesHutOptimize: graph.order > 1000,
          // Hubs share out their pull, so their leaves sit further off and lines run longer. On a
          // 10 000-point sample this beat LinLog (one ball) and plain higher repulsion (no change
          // once the view is fitted, since every distance scales alike).
          outboundAttractionDistribution: true,
          strongGravityMode: false,
          gravity: 0.2,
          scalingRatio: 100,
        },
      });
      layoutRef.current.start();
      zoomIntoCore();
      propsRef.current.onLayoutRunning(true);
      window.clearTimeout(stopTimerRef.current);
      // Ends where the reader is: they may have zoomed or panned while it ran.
      stopTimerRef.current = window.setTimeout(stopLayout, LAYOUT_RUN_MS);
    };

    useEffect(() => {
      if (!settled) {
        layoutStartedRef.current = false;
        return;
      }
      if (layoutStartedRef.current) return;
      layoutStartedRef.current = true;
      runLayout();
      // runLayout reads everything through refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settled]);

    useImperativeHandle(ref, () => ({
      fit() {
        void sigmaRef.current?.getCamera().animatedReset({ duration: 300 });
      },
      focus(id) {
        const sigma = sigmaRef.current;
        if (!sigma || !graphRef.current.hasNode(id)) return;
        // Frame the point with its neighbours: a hub's reach is far wider than a fixed zoom.
        const ids = [id, ...graphRef.current.neighbors(id)];
        let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
        for (const each of ids) {
          const data = sigma.getNodeDisplayData(each);
          if (!data) continue;
          minX = Math.min(minX, data.x);
          maxX = Math.max(maxX, data.x);
          minY = Math.min(minY, data.y);
          maxY = Math.max(maxY, data.y);
        }
        if (!Number.isFinite(minX)) return;
        const ratio = Math.min(1, Math.max(0.05, Math.max(maxX - minX, maxY - minY) * 1.3));
        void sigma
          .getCamera()
          .animate({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, ratio }, { duration: 400 });
      },
      runLayout,
      stopLayout,
    }));

    /* ------------------------------ box selection ------------------------------ */

    const onMouseDownCapture = (event: React.MouseEvent<HTMLDivElement>) => {
      if (!event.shiftKey || event.button !== 0) return;
      // Ahead of sigma, which would otherwise start panning.
      event.stopPropagation();
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setBox({ x0: x, y0: y, x1: x, y1: y });
      const move = (moveEvent: MouseEvent) =>
        setBox((current) =>
          current
            ? {
                ...current,
                x1: moveEvent.clientX - rect.left,
                y1: moveEvent.clientY - rect.top,
              }
            : current,
        );
      const up = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        setBox(null);
        const sigma = sigmaRef.current;
        if (!sigma) return;
        const x1 = upEvent.clientX - rect.left;
        const y1 = upEvent.clientY - rect.top;
        const [left, right] = [Math.min(x, x1), Math.max(x, x1)];
        const [top, bottom] = [Math.min(y, y1), Math.max(y, y1)];
        if (right - left < 4 && bottom - top < 4) return;
        boxEndedRef.current = true;
        // No click follows when the pointer was released outside the canvas.
        window.setTimeout(() => {
          boxEndedRef.current = false;
        }, 300);
        const hidden = propsRef.current.hiddenTypes;
        const ids: string[] = [];
        graphRef.current.forEachNode((id, attributes) => {
          if (hidden.has(attributes.otId)) return;
          const data = sigma.getNodeDisplayData(id);
          if (!data) return;
          const point = sigma.framedGraphToViewport({ x: data.x, y: data.y });
          if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom)
            ids.push(id);
        });
        propsRef.current.onBoxSelect(ids);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };

    return (
      <div className={styles.canvasWrap} onMouseDownCapture={onMouseDownCapture}>
        <div ref={containerRef} className={styles.canvas} data-testid="graph-overview-canvas" />
        {box ? (
          <div
            className={styles.box}
            style={{
              left: Math.min(box.x0, box.x1),
              top: Math.min(box.y0, box.y1),
              width: Math.abs(box.x1 - box.x0),
              height: Math.abs(box.y1 - box.y0),
            }}
          />
        ) : null}
      </div>
    );
  },
);
