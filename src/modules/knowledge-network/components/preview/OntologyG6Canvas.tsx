/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CanvasEvent,
  GraphEvent,
  Graph,
  NodeEvent,
  type GraphData,
  type IElementEvent,
} from "@antv/g6";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import type { GraphTokens } from "@/modules/knowledge-network/lib/graph-style";
import { ZOOM_MAX, ZOOM_MIN } from "@/modules/knowledge-network/utils/ontology-graph-layout";

import type { OntologyDecorations } from "./ontology-graph-data";
import styles from "./OntologyGraphView.module.css";

/*
 * The ontology graph drawn by G6: the arrangement comes in as positions, G6 draws it and handles
 * dragging, panning and zooming. Loaded on its own, so the overview page does not wait for G6.
 */

export type OntologyCanvasHandle = {
  zoomBy: (ratio: number) => void;
  /** Back to the whole arrangement in view, as when it was first drawn. */
  fit: () => void;
};

export type OntologyG6CanvasProps = {
  structure: GraphData;
  decorations: OntologyDecorations;
  tokens: GraphTokens;
  onNodeClick: (id: string) => void;
  onBlankClick: () => void;
  onZoom: (zoom: number) => void;
  /** For tests and diagnostics: object types in the graph. */
  totalNodes: number;
  ariaLabel: string;
};

/** Wheel zoom only with Ctrl/⌘ held (a trackpad pinch sets ctrlKey); a plain wheel scrolls the page. */
function zoomModifierHeld(event: unknown): boolean {
  const keys = event as { ctrlKey?: boolean; metaKey?: boolean };
  return Boolean(keys.ctrlKey || keys.metaKey);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** A type's full name, and its concept group when it has one. */
function tooltipOf(data: Record<string, unknown> | undefined): string {
  const name = typeof data?.name === "string" ? data.name : "";
  const group = typeof data?.group === "string" ? data.group : "";
  return `<div style="font-weight:600">${escapeHtml(name)}</div>${
    group ? `<div style="opacity:0.7;font-size:12px">${escapeHtml(group)}</div>` : ""
  }`;
}

function stateStyles(tokens: GraphTokens) {
  return {
    node: {
      selected: {
        halo: true,
        haloLineWidth: 10,
        haloStrokeOpacity: 0.45,
        shadowColor: "rgba(46, 104, 255, 0.28)",
        shadowBlur: 12,
      },
      inactive: { opacity: 0.32 },
    },
    edge: {
      active: {
        stroke: tokens.primary,
        strokeOpacity: 1,
        lineWidth: 2,
        labelFill: tokens.link,
        labelBackgroundFill: tokens.primarySoft,
        labelBackgroundStroke: tokens.primaryBorder,
      },
      inactive: { opacity: 0.22 },
    },
  };
}

export const OntologyG6Canvas = forwardRef<OntologyCanvasHandle, OntologyG6CanvasProps>(
  function OntologyG6Canvas(props, ref) {
    const { structure, decorations, tokens, totalNodes, ariaLabel } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const graphRef = useRef<Graph | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    // G6 calls are asynchronous; each waits for the one before, so a decoration never lands on
    // data that is still being replaced.
    const queueRef = useRef<Promise<unknown>>(Promise.resolve());
    const renderedRef = useRef(false);
    const decorationsRef = useRef(decorations);
    decorationsRef.current = decorations;

    const enqueue = (task: (graph: Graph) => Promise<unknown>) => {
      queueRef.current = queueRef.current
        .then(() => {
          const graph = graphRef.current;
          return graph && !graph.destroyed ? task(graph) : undefined;
        })
        .catch(() => undefined);
    };

    const applyDecorations = async (graph: Graph, next: OntologyDecorations) => {
      graph.updateNodeData(next.nodes);
      graph.updateEdgeData(next.edges);
      await graph.draw();
      await graph.setElementState(next.states, false);
      // A name's new size is not drawn until the next frame G6 renders for its own reasons, such
      // as a pan; draw one now, or the names stay as they were before the zoom.
      Object.values(graph.getCanvas().getLayers()).forEach((layer) => layer.render());
    };

    // The whole arrangement in view, shrunk to fit but never magnified past 100%.
    const fit = async (graph: Graph) => {
      await graph.fitView();
      if (graph.getZoom() > 1) {
        await graph.zoomTo(1);
        await graph.fitCenter();
      }
    };

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return undefined;
      const states = stateStyles(propsRef.current.tokens);
      const graph = new Graph({
        container,
        animation: false,
        zoomRange: [ZOOM_MIN, ZOOM_MAX],
        data: { nodes: [], edges: [], combos: [] },
        node: { type: "circle", state: states.node },
        edge: { type: "line", state: states.edge },
        combo: { type: "rect" },
        // The full name on hover: names on the canvas are cut short, or left out when zoomed out.
        plugins: [
          {
            type: "tooltip",
            trigger: "hover",
            enable: (event: { targetType?: string }) => event.targetType === "node",
            getContent: (_event: unknown, items: { data?: Record<string, unknown> }[]) =>
              Promise.resolve(tooltipOf(items[0]?.data)),
          },
        ],
        behaviors: [
          {
            type: "drag-canvas",
            enable: (event: { targetType?: string }) =>
              event.targetType === undefined || event.targetType === "canvas",
          },
          // The page scrolls under a plain wheel; the listener below stops it only while zooming.
          { type: "zoom-canvas", preventDefault: false, enable: zoomModifierHeld },
          {
            type: "drag-element",
            animation: false,
            shadow: false,
            dropEffect: "none",
            // A concept group's box drags with every type in it.
            enable: (event: { targetType?: string }) =>
              event.targetType === "node" || event.targetType === "combo",
          },
        ],
      });
      graphRef.current = graph;
      graph.on(NodeEvent.CLICK, (event: IElementEvent) =>
        propsRef.current.onNodeClick(String(event.target.id)),
      );
      graph.on(CanvasEvent.CLICK, () => propsRef.current.onBlankClick());
      // G6 transforms the view while it sets itself up, before its viewport exists; the zoom is
      // read only once the first drawing is done.
      graph.on(GraphEvent.AFTER_TRANSFORM, () => {
        if (renderedRef.current) propsRef.current.onZoom(graph.getZoom());
      });
      const onWheel = (event: WheelEvent) => {
        if (zoomModifierHeld(event)) event.preventDefault();
      };
      container.addEventListener("wheel", onWheel, { passive: false });
      // G6 only follows the window; the container also grows and shrinks on its own (maximized).
      let lastSize = "";
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        const size = `${Math.round(width)}x${Math.round(height)}`;
        if (width === 0 || height === 0 || size === lastSize) return;
        const first = lastSize === "";
        lastSize = size;
        if (first) return;
        enqueue(async (current) => {
          current.resize(width, height);
          await fit(current);
        });
      });
      observer.observe(container);
      return () => {
        observer.disconnect();
        container.removeEventListener("wheel", onWheel);
        graphRef.current = null;
        graph.destroy();
      };
    }, []);

    // A new graph, arrangement or theme: redraw from the arranged positions and fit the view.
    useEffect(() => {
      enqueue(async (graph) => {
        const states = stateStyles(tokens);
        graph.setNode({ type: "circle", state: states.node });
        graph.setEdge({ type: "line", state: states.edge });
        graph.setData(structure);
        await graph.render();
        renderedRef.current = true;
        await applyDecorations(graph, decorationsRef.current);
        await fit(graph);
      });
    }, [structure, tokens]);

    // Selection, zoom level or relation names: update in place, keeping dragged positions.
    useEffect(() => {
      enqueue((graph) => applyDecorations(graph, decorations));
    }, [decorations]);

    useImperativeHandle(ref, () => ({
      zoomBy: (ratio) => enqueue((graph) => graph.zoomBy(ratio)),
      fit: () => enqueue(fit),
    }));

    return (
      <div
        aria-label={ariaLabel}
        className={styles.graph}
        data-total-nodes={totalNodes}
        role="img"
        data-testid="ontology-graph-canvas"
        ref={containerRef}
      />
    );
  },
);
