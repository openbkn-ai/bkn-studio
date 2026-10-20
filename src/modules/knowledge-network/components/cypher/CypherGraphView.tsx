/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { MenuFoldOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Tooltip } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { CypherChart } from "@/modules/knowledge-network/components/cypher/CypherChart";
import { FrameGraphSettingsButton } from "@/modules/knowledge-network/components/cypher/FrameGraphSettingsButton";
import { GraphStyleOverview } from "@/modules/knowledge-network/components/cypher/GraphStyleOverview";
import type { FrameGraphSettings } from "@/modules/knowledge-network/cypher/graph-style";
import { useGraphStyle } from "@/modules/knowledge-network/cypher/graph-style-context";
import { buildGraphOption } from "@/modules/knowledge-network/cypher/graph-option";
import { textOf, type CypherGraph } from "@/modules/knowledge-network/cypher/graph-values";

import styles from "./CypherQueryScene.module.css";

/** Shared, so a frame without settings keeps its drawing across renders. */
const NO_SETTINGS: FrameGraphSettings = {};

type Selection = { kind: "node"; index: number } | { kind: "edge"; index: number } | null;

function Section({ title, values }: { title: string; values: Record<string, unknown> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;
  return (
    <>
      <div className={styles.cellDetailTitle}>{title}</div>
      <dl className={styles.propertyList}>
        {entries.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{textOf(value)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function InspectorBody({
  graph,
  selection,
  onRerun,
}: {
  graph: CypherGraph;
  selection: Selection;
  onRerun?: () => void;
}) {
  const { t } = useTranslation();
  if (selection?.kind === "node") {
    const node = graph.nodes[selection.index];
    if (!node) return null;
    return (
      <div className={styles.inspector}>
        <div className={styles.inspectorTitle}>{node.label}</div>
        <div className={styles.muted}>
          {t("knowledgeNetwork.cypherQuery.graph.objectType")}: {node.objectTypeName}
        </div>
        <Section title={t("knowledgeNetwork.cypherQuery.graph.key")} values={node.key} />
        <Section
          title={t("knowledgeNetwork.cypherQuery.graph.properties")}
          values={node.properties}
        />
        <Section
          title={t("knowledgeNetwork.cypherQuery.graph.computed")}
          values={node.computed ?? {}}
        />
      </div>
    );
  }
  if (selection?.kind === "edge") {
    const edge = graph.edges[selection.index];
    if (!edge) return null;
    const labelOf = (id: string) => graph.nodes.find((node) => node.id === id)?.label ?? id;
    const basis = Array.isArray(edge.basis) ? edge.basis : edge.basis ? [edge.basis] : [];
    return (
      <div className={styles.inspector}>
        <div className={styles.inspectorTitle}>{edge.name}</div>
        <div className={styles.muted}>
          {edge.derived
            ? t("knowledgeNetwork.cypherQuery.graph.derivedEdge")
            : `${t("knowledgeNetwork.cypherQuery.graph.relationType")}: ${edge.relationTypeId ?? edge.name}`}
        </div>
        <Section
          title={t("knowledgeNetwork.cypherQuery.graph.ends")}
          values={{
            [t("knowledgeNetwork.cypherQuery.table.source")]: labelOf(edge.source),
            [t("knowledgeNetwork.cypherQuery.table.target")]: labelOf(edge.target),
            ...(edge.count ? { [t("knowledgeNetwork.cypherQuery.graph.count")]: edge.count } : {}),
          }}
        />
        {basis.length > 0 ? (
          <>
            <div className={styles.cellDetailTitle}>
              {t("knowledgeNetwork.cypherQuery.graph.basis")}
            </div>
            <pre className={styles.jsonDetail}>{JSON.stringify(basis, null, 2)}</pre>
          </>
        ) : null}
      </div>
    );
  }
  return <GraphStyleOverview graph={graph} onRerun={onRerun} />;
}

/** The right-hand panel; it folds away so the graph can use the whole width. */
function Inspector({
  graph,
  selection,
  onCollapse,
  onRerun,
}: {
  graph: CypherGraph;
  selection: Selection;
  onCollapse: () => void;
  onRerun?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.inspectorPane}>
      <div className={styles.inspectorHeader}>
        <span className={styles.muted}>{t("knowledgeNetwork.cypherQuery.graph.details")}</span>
        <Tooltip title={t("knowledgeNetwork.cypherQuery.graph.hideDetails")}>
          <Button
            aria-label={t("knowledgeNetwork.cypherQuery.graph.hideDetails")}
            icon={<MenuFoldOutlined />}
            onClick={onCollapse}
            size="small"
            type="text"
          />
        </Tooltip>
      </div>
      <InspectorBody graph={graph} onRerun={onRerun} selection={selection} />
    </div>
  );
}

export function CypherGraphView({
  graph,
  fileName,
  wheelZoom,
  onShowAll,
  settings = NO_SETTINGS,
  onSettingsChange,
  onRerun,
}: {
  graph: CypherGraph;
  fileName: string;
  /** Zoom on a plain wheel, as in a full-screen frame. */
  wheelZoom?: boolean;
  /** Draw every node of this result, past the page's limit. */
  onShowAll?: () => void;
  /** This frame's graph settings, and where a change to them goes. */
  settings?: FrameGraphSettings;
  onSettingsChange?: (settings: FrameGraphSettings) => void;
  /** Runs the frame's query again, for a caption the result did not bring back. */
  onRerun?: () => void;
}) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const { style, nodeLimit } = useGraphStyle();
  const drawing = useMemo(() => buildGraphOption(graph, style, settings), [graph, style, settings]);

  if (graph.nodes.length === 0) {
    return <Empty description={t("knowledgeNetwork.cypherQuery.graph.noNodes")} />;
  }
  return (
    <div className={styles.graphView}>
      {graph.totalNodes > graph.nodes.length ? (
        <Alert
          action={
            onShowAll ? (
              <Button data-testid="cypher-graph-show-all" onClick={onShowAll} size="small">
                {t("knowledgeNetwork.cypherQuery.graph.showAll")}
              </Button>
            ) : undefined
          }
          message={t("knowledgeNetwork.cypherQuery.graph.truncated", {
            total: graph.totalNodes,
            limit: nodeLimit,
          })}
          showIcon
          type="info"
        />
      ) : null}
      <div
        className={detailsOpen ? styles.graphBody : `${styles.graphBody} ${styles.graphBodyWide}`}
      >
        <div className={styles.graphCanvas} data-testid="cypher-graph-canvas">
          <CypherChart
            fileName={fileName}
            drawing={drawing}
            onBlankClick={() => setSelection(null)}
            onPick={(pick) => {
              // Picking something brings the details back.
              const list: { id: string }[] = pick.kind === "node" ? graph.nodes : graph.edges;
              const index = list.findIndex((item) => item.id === pick.id);
              if (index < 0) return;
              setSelection({ kind: pick.kind, index });
              setDetailsOpen(true);
            }}
            onShowDetails={detailsOpen ? undefined : () => setDetailsOpen(true)}
            tools={
              onSettingsChange ? (
                <FrameGraphSettingsButton onChange={onSettingsChange} value={settings} />
              ) : null
            }
            wheelZoom={wheelZoom}
          />
        </div>
        {detailsOpen ? (
          <Inspector
            graph={graph}
            onCollapse={() => setDetailsOpen(false)}
            onRerun={onRerun}
            selection={selection}
          />
        ) : null}
      </div>
    </div>
  );
}
