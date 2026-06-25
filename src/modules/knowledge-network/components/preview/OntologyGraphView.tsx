/** 本体图谱（建模预览新设计）—— 彩色实体类节点 + 关系连线，可选中并高亮邻居。 */

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import {
  PREVIEW_LAYOUT_HEIGHT,
  PREVIEW_LAYOUT_WIDTH,
  computePreviewGraphLayout,
} from "@/modules/knowledge-network/utils/compute-preview-graph-layout";

import styles from "./OntologyGraphView.module.css";

const HUB_RADIUS = 46;
const NODE_RADIUS = 38;

type OntologyGraphViewProps = {
  graph: KnowledgeNetworkPreviewGraph;
  indexedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

function truncate(value: string, max = 6) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export function OntologyGraphView({
  graph,
  indexedIds,
  selectedId,
  onSelect,
}: OntologyGraphViewProps) {
  const { t } = useTranslation();

  const { positions, radiusById, hubId, neighbors } = useMemo(() => {
    const layout = computePreviewGraphLayout(graph);
    const positionMap = new Map(layout.map((node) => [node.id, node]));

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

    const neighborSet = new Set<string>();
    if (selectedId) {
      graph.edges.forEach((edge) => {
        if (edge.sourceId === selectedId) neighborSet.add(edge.targetId);
        if (edge.targetId === selectedId) neighborSet.add(edge.sourceId);
      });
    }

    return { positions: positionMap, radiusById: radius, hubId: topId, neighbors: neighborSet };
  }, [graph, selectedId]);

  return (
    <svg
      className={styles.graph}
      viewBox={`0 0 ${PREVIEW_LAYOUT_WIDTH} ${PREVIEW_LAYOUT_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t("knowledgeNetwork.previewCanvas")}
      onClick={(event) => {
        if ((event.target as Element).tagName === "svg") {
          onSelect(null);
        }
      }}
    >
      <defs>
        <pattern id="kn-onto-grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.3" fill="#eef1f6" />
        </pattern>
        <marker id="kn-onto-arrow" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#b3bdcf" />
        </marker>
        <marker id="kn-onto-arrow-hi" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2e68ff" />
        </marker>
      </defs>

      <rect width={PREVIEW_LAYOUT_WIDTH} height={PREVIEW_LAYOUT_HEIGHT} fill="url(#kn-onto-grid)" />

      <g className={styles.edges}>
        {graph.edges.map((edge) => {
          const a = positions.get(edge.sourceId);
          const b = positions.get(edge.targetId);
          if (!a || !b) {
            return null;
          }
          const ra = radiusById.get(edge.sourceId) ?? NODE_RADIUS;
          const rb = radiusById.get(edge.targetId) ?? NODE_RADIUS;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const sx = a.x + ux * ra;
          const sy = a.y + uy * ra;
          const ex = b.x - ux * (rb + 12);
          const ey = b.y - uy * (rb + 12);
          const mx = (sx + ex) / 2;
          const my = (sy + ey) / 2;
          const active = Boolean(selectedId) && (edge.sourceId === selectedId || edge.targetId === selectedId);
          const dim = Boolean(selectedId) && !active;
          const label = edge.name || t("knowledgeNetwork.defaultEdgeName");
          const labelWidth = label.length * 14 + 18;
          return (
            <g
              key={edge.id}
              className={`${styles.edge} ${active ? styles.edgeActive : ""} ${dim ? styles.edgeDim : ""}`}
            >
              <line x1={sx} y1={sy} x2={ex} y2={ey} markerEnd={`url(#kn-onto-arrow${active ? "-hi" : ""})`} />
              <rect
                className={styles.edgeLabelBg}
                x={mx - labelWidth / 2}
                y={my - 13}
                width={labelWidth}
                height={24}
                rx={12}
              />
              <text className={styles.edgeLabel} x={mx} y={my + 4} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
      </g>

      <g className={styles.nodes}>
        {graph.nodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) {
            return null;
          }
          const radius = radiusById.get(node.id) ?? NODE_RADIUS;
          const isSelected = node.id === selectedId;
          const isNeighbor = neighbors.has(node.id);
          const dim = Boolean(selectedId) && !isSelected && !isNeighbor;
          const nodeStyle = { "--nc": node.color || "#2e68ff" } as CSSProperties;
          return (
            <g
              key={node.id}
              className={[
                styles.node,
                isSelected ? styles.nodeSelected : "",
                dim ? styles.nodeDim : "",
                node.id === hubId ? styles.nodeHub : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={nodeStyle}
              onClick={() => onSelect(isSelected ? null : node.id)}
            >
              {isSelected ? (
                <circle className={styles.nodeRing} cx={position.x} cy={position.y} r={radius + 7} />
              ) : null}
              <circle className={styles.nodeDisc} cx={position.x} cy={position.y} r={radius} />
              <text className={styles.nodeName} x={position.x} y={position.y + 5} textAnchor="middle">
                {truncate(node.name, radius === HUB_RADIUS ? 7 : 6)}
              </text>
              {indexedIds.has(node.id) ? (
                <circle
                  className={styles.nodeIndexDot}
                  cx={position.x + radius - 10}
                  cy={position.y - radius + 10}
                  r={5}
                >
                  <title>{t("knowledgeNetwork.previewIndexed")}</title>
                </circle>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
