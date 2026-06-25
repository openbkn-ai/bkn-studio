/** 领域知识网络卡片 —— 本体缩略图 + 状态 + 统计（全部来自真实后端摘要）。 */

import { Tag } from "antd";
import { useTranslation } from "react-i18next";

import type {
  DomainNetworkSummary,
} from "@/modules/knowledge-network-lab/types/domain-network";
import {
  STATUS_META,
  formatCount,
  formatTimeAgo,
} from "@/modules/knowledge-network-lab/utils/domain-network";

import styles from "./DomainNetworkCard.module.css";

// 缩略图坐标系与 compute-preview-graph-layout 一致（1000×720）。
const MINI_VIEWBOX = "0 0 1000 720";

type DomainNetworkCardProps = {
  network: DomainNetworkSummary;
  onOpen: (network: DomainNetworkSummary) => void;
};

function MiniGraph({ network }: { network: DomainNetworkSummary }) {
  const points = new Map(network.miniNodes.map((node) => [node.key, node]));
  if (network.miniNodes.length === 0) {
    return null;
  }
  return (
    <svg className={styles.mini} viewBox={MINI_VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g className={styles.miniEdges}>
        {network.miniEdges.map((edge) => {
          const a = points.get(edge.from);
          const b = points.get(edge.to);
          if (!a || !b) {
            return null;
          }
          return <line key={edge.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      <g>
        {network.miniNodes.map((node, index) => (
          <circle key={node.key} cx={node.x} cy={node.y} r={index === 0 ? 40 : 30} fill={node.color} />
        ))}
      </g>
    </svg>
  );
}

export function DomainNetworkCard({ network, onOpen }: DomainNetworkCardProps) {
  const { t } = useTranslation();
  const status = STATUS_META[network.status];

  return (
    <button type="button" className={styles.card} onClick={() => onOpen(network)}>
      <div className={`${styles.media} ${styles[`stripe_${network.status}`] ?? ""}`}>
        <MiniGraph network={network} />
      </div>
      <div className={styles.body}>
        <div className={styles.top}>
          <div className={styles.titleWrap}>
            <span className={styles.name}>{network.name}</span>
            <span className={styles.slug}>{network.slug}</span>
          </div>
          <Tag color={status.color} bordered={false}>
            {t(status.labelKey)}
          </Tag>
        </div>
        <div className={styles.tags}>
          {network.domain ? (
            <Tag bordered={false} className={styles.domainTag}>
              {network.domain}
            </Tag>
          ) : null}
        </div>
        <p className={styles.desc}>{network.desc || t("knowledgeNetworkLab.card.noDesc")}</p>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{formatCount(network.stats.objectTypes)}</span>
            <span className={styles.statLabel}>{t("knowledgeNetworkLab.card.entityClasses")}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{formatCount(network.stats.relationTypes)}</span>
            <span className={styles.statLabel}>{t("knowledgeNetworkLab.card.relationClasses")}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{formatCount(network.stats.conceptGroups)}</span>
            <span className={styles.statLabel}>{t("knowledgeNetworkLab.card.conceptGroups")}</span>
          </div>
        </div>
        <div className={styles.foot}>
          <span className={styles.owner}>
            <span className={styles.avatar}>{(network.owner || "?").slice(0, 1)}</span>
            {network.owner || "—"}
          </span>
          <span className={styles.footTime}>
            {t("knowledgeNetworkLab.card.updatedAt", { time: formatTimeAgo(network.updatedAt, t) })}
          </span>
        </div>
      </div>
    </button>
  );
}
