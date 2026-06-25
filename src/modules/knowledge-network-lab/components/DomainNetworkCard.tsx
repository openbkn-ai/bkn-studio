/** 领域知识网络卡片 —— 名称 / 领域 / 描述 / 统计（来自真实后端摘要，单次请求）。 */

import { DeploymentUnitOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { useTranslation } from "react-i18next";

import type { DomainNetworkSummary } from "@/modules/knowledge-network-lab/types/domain-network";
import { formatTimeAgo } from "@/modules/knowledge-network-lab/utils/domain-network";

import styles from "./DomainNetworkCard.module.css";

type DomainNetworkCardProps = {
  network: DomainNetworkSummary;
  onOpen: (network: DomainNetworkSummary) => void;
};

export function DomainNetworkCard({ network, onOpen }: DomainNetworkCardProps) {
  const { t } = useTranslation();

  return (
    <button type="button" className={styles.card} onClick={() => onOpen(network)}>
      <span className={styles.accent} style={{ background: network.color }} aria-hidden />
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.icon} style={{ background: network.color }}>
            <DeploymentUnitOutlined />
          </span>
          <div className={styles.titleWrap}>
            <span className={styles.name}>{network.name}</span>
            <span className={styles.slug}>{network.slug}</span>
          </div>
          {network.domain ? (
            <Tag bordered={false} className={styles.domainTag}>
              {network.domain}
            </Tag>
          ) : null}
        </div>

        <p className={styles.desc}>{network.desc || t("knowledgeNetworkLab.card.noDesc")}</p>

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
