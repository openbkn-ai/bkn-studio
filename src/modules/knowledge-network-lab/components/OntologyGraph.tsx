/** 本体图谱 SVG —— 节点 = 实体类，连线 = 关系类。支持选中 + 邻居高亮。 */

import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type {
  DomainNetwork,
  EntityClass,
} from "@/modules/knowledge-network-lab/types/domain-network";
import { neighborsOf } from "@/modules/knowledge-network-lab/utils/domain-network";

import styles from "./OntologyGraph.module.css";

// 与 compute-preview-graph-layout 的坐标系一致。
const VIEW_W = 1000;
const VIEW_H = 720;

function radiusOf(entity: EntityClass): number {
  return entity.hub ? 46 : 38;
}

type OntologyGraphProps = {
  network: DomainNetwork;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
};

export function OntologyGraph({ network, selectedKey, onSelect }: OntologyGraphProps) {
  const { t } = useTranslation();

  const byKey = new Map<string, EntityClass>();
  network.entityClasses.forEach((entity) => byKey.set(entity.key, entity));
  const neighbors = neighborsOf(network, selectedKey);

  return (
    <svg
      className={styles.graph}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={(event) => {
        if ((event.target as Element).tagName === "svg") {
          onSelect(null);
        }
      }}
      role="img"
      aria-label={t("knowledgeNetworkLab.detail.graphAria", { name: network.name })}
    >
      <defs>
        <marker id="knLabArrow" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#b3bdcf" />
        </marker>
        <marker id="knLabArrowHi" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2e68ff" />
        </marker>
      </defs>

      <g className={styles.edges}>
        {network.relationClasses.map((relation) => {
          const a = byKey.get(relation.from);
          const b = byKey.get(relation.to);
          if (!a || !b) {
            return null;
          }
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const sx = a.x + ux * radiusOf(a);
          const sy = a.y + uy * radiusOf(a);
          const ex = b.x - ux * (radiusOf(b) + 12);
          const ey = b.y - uy * (radiusOf(b) + 12);
          const mx = (sx + ex) / 2;
          const my = (sy + ey) / 2;
          const active = Boolean(selectedKey) && (relation.from === selectedKey || relation.to === selectedKey);
          const dim = Boolean(selectedKey) && !active;
          const labelWidth = relation.name.length * 14 + 18;
          return (
            <g
              key={relation.key}
              className={`${styles.edge} ${active ? styles.edgeActive : ""} ${dim ? styles.edgeDim : ""}`}
            >
              <line
                x1={sx}
                y1={sy}
                x2={ex}
                y2={ey}
                markerEnd={`url(#knLabArrow${active ? "Hi" : ""})`}
              />
              <rect
                className={styles.edgeLabelBg}
                x={mx - labelWidth / 2}
                y={my - 13}
                width={labelWidth}
                height={24}
                rx={12}
              />
              <text className={styles.edgeLabel} x={mx} y={my + 4} textAnchor="middle">
                {relation.name}
              </text>
            </g>
          );
        })}
      </g>

      <g className={styles.nodes}>
        {network.entityClasses.map((entity) => {
          const radius = radiusOf(entity);
          const isSelected = entity.key === selectedKey;
          const isNeighbor = neighbors.has(entity.key);
          const dim = Boolean(selectedKey) && !isSelected && !isNeighbor;
          const nodeStyle = { "--nc": entity.color } as CSSProperties;
          return (
            <g
              key={entity.key}
              className={[
                styles.node,
                isSelected ? styles.nodeSelected : "",
                isNeighbor ? styles.nodeNeighbor : "",
                dim ? styles.nodeDim : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={nodeStyle}
              onClick={() => onSelect(isSelected ? null : entity.key)}
            >
              {isSelected ? (
                <circle className={styles.nodeRing} cx={entity.x} cy={entity.y} r={radius + 7} />
              ) : null}
              <circle className={styles.nodeDisc} cx={entity.x} cy={entity.y} r={radius} />
              <text className={styles.nodeName} x={entity.x} y={entity.y + 5} textAnchor="middle">
                {entity.name}
              </text>
              {entity.indexed ? (
                <circle
                  className={styles.nodeIndexDot}
                  cx={entity.x + radius - 10}
                  cy={entity.y - radius + 10}
                  r={5}
                >
                  <title>{t("knowledgeNetworkLab.indexState.built")}</title>
                </circle>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
