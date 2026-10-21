/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CompressOutlined,
  FileImageOutlined,
  MenuUnfoldOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import {
  CanvasEvent,
  EdgeEvent,
  Graph,
  NodeEvent,
  type EdgeData,
  type IElementEvent,
  type LayoutOptions,
  type NodeData,
} from "@antv/g6";
import { Button, Tooltip } from "antd";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useResolvedTheme } from "@/app/theme/theme-context";
import type { GraphDensity, GraphDrawing } from "@/modules/knowledge-network/cypher/graph-option";

import styles from "./CypherQueryScene.module.css";

const ZOOM_STEP = 1.25;
/** Largest zoom "fit" goes to, so a handful of nodes does not fill the frame. */
const FIT_MAX_ZOOM = 1.6;

export type GraphPick = { kind: "node" | "edge"; id: string };

/**
 * The force layout. The first pass runs without animation so the finished drawing can be fitted
 * to the view, and in "fixed" drag mode the graph then stays put. In "force" mode a live pass
 * starts from those positions, cools almost at once, and stays to answer drags: a dragged node
 * pulls its neighbours and stays where it is dropped, as in Neo4j Browser.
 */
function forceLayout(density: GraphDensity, live = false): LayoutOptions {
  return {
    type: "d3-force",
    animation: live,
    ...(live ? { alpha: 0.02 } : {}),
    link: { distance: density.linkDistance },
    manyBody: { strength: -density.repulsion, distanceMax: density.linkDistance * 4 },
    collide: { radius: density.size / 2 + 4, strength: 0.8 },
    // A gentle pull to the middle keeps separate clusters from drifting apart.
    x: { strength: 0.08 },
    y: { strength: 0.08 },
  };
}

async function fitGraph(graph: Graph): Promise<void> {
  await graph.fitView({ when: "always", direction: "both" }, false);
  if (graph.getZoom() > FIT_MAX_ZOOM) await graph.zoomTo(FIT_MAX_ZOOM, false);
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}

function tooltipOf(item: NodeData | EdgeData | undefined): string {
  const data = item?.data ?? {};
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return escapeHtml(
    "typeName" in data ? `${text(data.typeName)} · ${text(data.label)}` : text(data.name),
  );
}

/**
 * The result graph, drawn with G6. A plain wheel scrolls the result stream instead of zooming, so
 * a graph never traps the page; Ctrl/⌘ + wheel or a trackpad pinch zooms, empty canvas pans, and
 * the buttons zoom, fit and export a PNG.
 */
export function CypherChart({
  drawing,
  fileName,
  onPick,
  wheelZoom = false,
  onShowDetails,
  onBlankClick,
  tools,
}: {
  drawing: GraphDrawing;
  fileName: string;
  onPick?: (pick: GraphPick) => void;
  /** Zoom on a plain wheel too; only where the graph fills the screen and nothing scrolls. */
  wheelZoom?: boolean;
  /** Set while the details panel is folded: a button to bring it back. */
  onShowDetails?: () => void;
  /** A click on empty canvas, which clears the selection. */
  onBlankClick?: () => void;
  /** More buttons for the tool bar, before the export. */
  tools?: ReactNode;
}) {
  const { t } = useTranslation();
  const resolvedTheme = useResolvedTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const onPickRef = useRef(onPick);
  const onBlankClickRef = useRef(onBlankClick);
  onPickRef.current = onPick;
  onBlankClickRef.current = onBlankClick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const dark = resolvedTheme === "dark";
    const graph = new Graph({
      container,
      theme: dark ? "dark" : "light",
      animation: false,
      // Room for the zoom tools below the fitted drawing.
      padding: [24, 24, 48, 24],
      data: drawing.data,
      node: {
        style: {
          labelPlacement: "bottom",
          labelFontSize: 11,
          labelFill: dark ? "#d9d9d9" : "#333333",
          stroke: dark ? "#141414" : "#ffffff",
          lineWidth: 1.5,
          cursor: "pointer",
        },
        state: {
          active: { halo: true, haloLineWidth: 6, haloStrokeOpacity: 0.3 },
          selected: { halo: true, haloLineWidth: 8, haloStrokeOpacity: 0.45, lineWidth: 2 },
        },
      },
      edge: {
        style: {
          endArrowSize: 7,
          labelFontSize: 10,
          labelFill: dark ? "#bfbfbf" : "#5c6270",
          labelBackground: true,
          labelBackgroundFill: dark ? "rgba(20,20,20,0.85)" : "rgba(255,255,255,0.9)",
          labelBackgroundRadius: 2,
          labelPadding: [0, 3],
          labelAutoRotate: false,
          cursor: "pointer",
        },
        state: {
          active: { lineWidth: 2, strokeOpacity: 1 },
          selected: { lineWidth: 2.5, strokeOpacity: 1 },
        },
      },
      layout: forceLayout(drawing.density),
      // Several relationships between the same two nodes fan out instead of overlapping.
      transforms: ["process-parallel-edges"],
      // Empty canvas pans; Shift + click adds a node to the selection and Shift + drag boxes
      // several, and dragging any selected node moves them all.
      behaviors: [
        {
          type: "drag-canvas",
          enable: (event: { shiftKey?: boolean; targetType?: string }) =>
            !event.shiftKey && (event.targetType === undefined || event.targetType === "canvas"),
        },
        "zoom-canvas",
        drawing.dragMode === "force"
          ? { type: "drag-element-force", fixed: true }
          : { type: "drag-element", animation: false, shadow: false },
        { type: "hover-activate", degree: 1, state: "active" },
        { type: "click-select", multiple: true, trigger: ["shift"] },
        { type: "brush-select", trigger: ["shift"], mode: "union", enableElements: ["node"] },
      ],
      plugins: [
        {
          type: "tooltip",
          trigger: "hover",
          enable: (event: IElementEvent) =>
            event.targetType === "node" || event.targetType === "edge",
          getContent: (_event: IElementEvent, items: (NodeData | EdgeData)[]) =>
            Promise.resolve(tooltipOf(items[0])),
        },
      ],
    });
    graphRef.current = graph;
    let disposed = false;
    graph.on(NodeEvent.CLICK, (event: IElementEvent) =>
      onPickRef.current?.({ kind: "node", id: String(event.target.id) }),
    );
    graph.on(EdgeEvent.CLICK, (event: IElementEvent) =>
      onPickRef.current?.({ kind: "edge", id: String(event.target.id) }),
    );
    graph.on(CanvasEvent.CLICK, () => onBlankClickRef.current?.());
    void (async () => {
      try {
        await graph.render();
        if (disposed) return;
        await fitGraph(graph);
        if (disposed || drawing.dragMode !== "force") return;
        graph.setLayout(forceLayout(drawing.density, true));
        await graph.layout();
      } catch (error) {
        // A graph torn down mid-draw (a new result, or React's double mount) has nothing to show.
        if (!disposed) throw error;
      }
    })();
    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!disposed && width > 0 && height > 0) graph.resize(width, height);
    });
    observer.observe(container);
    return () => {
      disposed = true;
      observer.disconnect();
      graph.destroy();
      if (graphRef.current === graph) graphRef.current = null;
    };
  }, [drawing, resolvedTheme]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || wheelZoom) return;
    // Captured before G6 sees it: without a modifier the wheel stays a page scroll.
    const guard = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    wrapper.addEventListener("wheel", guard, { capture: true, passive: true });
    return () => wrapper.removeEventListener("wheel", guard, { capture: true });
  }, [wheelZoom]);

  const zoomBy = (factor: number) => {
    const graph = graphRef.current;
    if (!graph) return;
    void graph.zoomTo(Math.min(8, Math.max(0.1, graph.getZoom() * factor)), false);
  };

  const exportPng = async () => {
    const graph = graphRef.current;
    if (!graph) return;
    const link = document.createElement("a");
    link.href = await graph.toDataURL({ mode: "overall", type: "image/png" });
    link.download = `${fileName}.png`;
    link.click();
  };

  return (
    <div className={styles.chartWrapper} ref={wrapperRef}>
      <div className={styles.chartContainer} ref={containerRef} />
      <div className={styles.chartTools}>
        {wheelZoom ? null : (
          <span className={styles.muted}>{t("knowledgeNetwork.cypherQuery.graph.zoomHint")}</span>
        )}
        <Tooltip title={t("knowledgeNetwork.cypherQuery.graph.zoomIn")}>
          <Button
            icon={<ZoomInOutlined />}
            onClick={() => zoomBy(ZOOM_STEP)}
            size="small"
            type="text"
          />
        </Tooltip>
        <Tooltip title={t("knowledgeNetwork.cypherQuery.graph.zoomOut")}>
          <Button
            icon={<ZoomOutOutlined />}
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            size="small"
            type="text"
          />
        </Tooltip>
        <Tooltip title={t("knowledgeNetwork.cypherQuery.graph.fit")}>
          <Button
            aria-label={t("knowledgeNetwork.cypherQuery.graph.fit")}
            icon={<CompressOutlined />}
            onClick={() => {
              if (graphRef.current) void fitGraph(graphRef.current);
            }}
            size="small"
            type="text"
          />
        </Tooltip>
        {tools}
        <Tooltip title={t("knowledgeNetwork.cypherQuery.graph.exportPng")}>
          <Button
            icon={<FileImageOutlined />}
            onClick={() => void exportPng()}
            size="small"
            type="text"
          />
        </Tooltip>
        {onShowDetails ? (
          <Tooltip title={t("knowledgeNetwork.cypherQuery.graph.showDetails")}>
            <Button
              aria-label={t("knowledgeNetwork.cypherQuery.graph.showDetails")}
              icon={<MenuUnfoldOutlined />}
              onClick={onShowDetails}
              size="small"
              type="text"
            />
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
