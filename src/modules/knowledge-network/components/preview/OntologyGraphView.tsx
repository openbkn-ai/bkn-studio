/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Ontology graph for the modeling preview: colored entity-type nodes and relation edges, with selection and neighbor highlighting. */

import {
  CompressOutlined,
  DownOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LinkOutlined,
  RetweetOutlined,
  TagOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { Dropdown } from "antd";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useResolvedTheme } from "@/app/theme/theme-context";
import { readGraphTokens, type GraphTokens } from "@/modules/knowledge-network/lib/graph-style";
import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import {
  layoutOntologyGraph,
  renderModeOf,
  type OntologyLayoutMode,
} from "@/modules/knowledge-network/utils/ontology-graph-layout";

import { buildOntologyDecorations, buildOntologyStructure } from "./ontology-graph-data";
import type { OntologyCanvasHandle } from "./OntologyG6Canvas";
import styles from "./OntologyGraphView.module.css";

// G6 loads with the graph, not with the page it sits on.
const OntologyG6Canvas = lazy(async () => ({
  default: (await import("./OntologyG6Canvas")).OntologyG6Canvas,
}));

type OntologyGraphViewProps = {
  graph: KnowledgeNetworkPreviewGraph;
  indexedIds: Set<string>;
  /** Node ID to concept-group ID for logical-group clustering. */
  groupOf?: Map<string, string>;
  /** Group ID to name for boundary labels in logical-group mode. */
  groupNames?: Map<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/** The first opaque background up from an element: what the graph is drawn on. */
function backgroundBehind(element: HTMLElement | null): string | undefined {
  for (let current = element; current; current = current.parentElement) {
    const color = getComputedStyle(current).backgroundColor;
    if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) return color;
  }
  return undefined;
}

export function OntologyGraphView({
  graph,
  indexedIds,
  groupOf,
  groupNames,
  selectedId,
  onSelect,
}: OntologyGraphViewProps) {
  const { t } = useTranslation();
  const theme = useResolvedTheme();
  const [mode, setMode] = useState<OntologyLayoutMode>("force");
  // Relation names are off at first: on a graph of dozens of types they cover it; the selected
  // type's relations are named anyway.
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [tokens, setTokens] = useState<GraphTokens>(() => readGraphTokens());
  const canvasRef = useRef<OntologyCanvasHandle | null>(null);
  const [maximized, setMaximized] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  /** The colour behind the graph where it sits, kept when it is maximized over the window. */
  const [maximizedBackground, setMaximizedBackground] = useState<string | undefined>(undefined);
  const toggleMaximized = () => {
    if (!maximized) setMaximizedBackground(backgroundBehind(wrapRef.current));
    setMaximized((value) => !value);
  };

  // Esc leaves the maximized view; the canvas refits itself to the space it now has.
  useEffect(() => {
    if (!maximized) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  const logicalGroupingAvailable = Boolean(groupOf?.size);
  const selectedMode: OntologyLayoutMode =
    mode === "group" && !logicalGroupingAvailable ? "force" : mode;
  const renderMode = renderModeOf(graph.nodes.length, mode, logicalGroupingAvailable);
  const edgeLabelsVisible = showEdgeLabels;

  // The theme's tokens are read after it is applied to the document.
  useEffect(() => {
    setTokens(readGraphTokens());
  }, [theme]);

  // Recompute layout when graph or arrangement changes, not when selecting a node.
  const layout = useMemo(
    () => layoutOntologyGraph(graph, renderMode, groupOf),
    [graph, groupOf, renderMode],
  );
  const ungroupedLabel = t("knowledgeNetwork.previewUngrouped");
  const structure = useMemo(
    () =>
      buildOntologyStructure({
        graph,
        layout,
        renderMode,
        groupOf,
        groupNames,
        tokens,
        ungroupedLabel,
      }),
    [graph, groupNames, groupOf, layout, renderMode, tokens, ungroupedLabel],
  );
  const defaultEdgeName = t("knowledgeNetwork.defaultEdgeName");
  const decorations = useMemo(
    () =>
      buildOntologyDecorations({
        graph,
        hubId: layout.hubId,
        positions: layout.positions,
        selectedId,
        indexedIds,
        edgeLabelsVisible,
        nodeLabelsVisible: showNodeLabels,
        zoom,
        defaultEdgeName,
      }),
    [
      defaultEdgeName,
      edgeLabelsVisible,
      showNodeLabels,
      graph,
      indexedIds,
      layout.hubId,
      layout.positions,
      selectedId,
      zoom,
    ],
  );

  return (
    <div
      className={`${styles.wrap} ${maximized ? styles.maximized : ""}`}
      data-maximized={maximized || undefined}
      ref={wrapRef}
      style={maximized ? { background: maximizedBackground } : undefined}
    >
      <div className={styles.toolbar}>
        <Dropdown
          trigger={["click"]}
          menu={{
            selectedKeys: [selectedMode],
            items: [
              {
                key: "force",
                label: t("knowledgeNetwork.previewLayoutForce"),
              },
              { key: "circle", label: t("knowledgeNetwork.previewLayoutCircle") },
              ...(logicalGroupingAvailable
                ? [{ key: "group", label: t("knowledgeNetwork.previewLayoutGroup") }]
                : []),
            ],
            onClick: ({ key }) => setMode(key as OntologyLayoutMode),
          }}
        >
          <button
            type="button"
            className={styles.arrange}
            title={t("knowledgeNetwork.previewRearrange")}
          >
            <RetweetOutlined />
            {selectedMode === "circle"
              ? t("knowledgeNetwork.previewLayoutCircle")
              : selectedMode === "group"
                ? t("knowledgeNetwork.previewLayoutGroup")
                : t("knowledgeNetwork.previewLayoutForce")}
            <DownOutlined className={styles.arrangeCaret} />
          </button>
        </Dropdown>
        <button
          type="button"
          className={`${styles.edgeToggle} ${showNodeLabels ? styles.edgeToggleOn : ""}`}
          title={t(
            showNodeLabels
              ? "knowledgeNetwork.previewHideNodeLabels"
              : "knowledgeNetwork.previewShowNodeLabels",
          )}
          aria-pressed={showNodeLabels}
          onClick={() => setShowNodeLabels((value) => !value)}
        >
          <TagOutlined />
        </button>
        <button
          type="button"
          className={`${styles.edgeToggle} ${edgeLabelsVisible ? styles.edgeToggleOn : ""}`}
          title={t(
            edgeLabelsVisible
              ? "knowledgeNetwork.previewHideEdgeLabels"
              : "knowledgeNetwork.previewShowEdgeLabels",
          )}
          aria-pressed={edgeLabelsVisible}
          onClick={() => setShowEdgeLabels((value) => !value)}
        >
          <LinkOutlined />
        </button>
      </div>
      <Suspense fallback={<div className={styles.graph} />}>
        <OntologyG6Canvas
          ariaLabel={t("knowledgeNetwork.previewCanvas")}
          decorations={decorations}
          maximized={maximized}
          onBlankClick={() => onSelect(null)}
          onNodeClick={(id) => onSelect(id === selectedId ? null : id)}
          onZoom={setZoom}
          ref={canvasRef}
          structure={structure}
          tokens={tokens}
          totalNodes={graph.nodes.length}
        />
      </Suspense>
      <span className={styles.zoomHint}>{t("knowledgeNetwork.previewZoomHint")}</span>
      <div className={styles.zoomCtl}>
        <button
          type="button"
          onClick={() => canvasRef.current?.zoomBy(1.25)}
          title={t("knowledgeNetwork.previewZoomIn")}
        >
          <ZoomInOutlined />
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.zoomBy(0.8)}
          title={t("knowledgeNetwork.previewZoomOut")}
        >
          <ZoomOutOutlined />
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.fit()}
          title={t("knowledgeNetwork.previewFitView")}
        >
          <CompressOutlined />
        </button>
        <button
          type="button"
          aria-pressed={maximized}
          onClick={toggleMaximized}
          title={t(
            maximized ? "knowledgeNetwork.previewRestoreView" : "knowledgeNetwork.previewMaximize",
          )}
        >
          {maximized ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </button>
      </div>
    </div>
  );
}
