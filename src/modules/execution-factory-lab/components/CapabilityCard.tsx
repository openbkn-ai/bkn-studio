/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  CodeOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Card, Tag, Typography } from "antd";

import type { ReactNode } from "react";

import { useTranslation } from "react-i18next";

import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";
import type { CapabilityRecord } from "@/modules/execution-factory-lab/types/capability";
import {
  formatCapabilityStatusLabel,
  getCapabilityStatusTagColor,
  getCapabilityStatusTagStyle,
} from "@/modules/execution-factory-lab/utils/capability-status";
import {
  resolveCapabilityCardSubtitle,
  resolveCapabilityKindLabel,
} from "@/modules/execution-factory-lab/utils/capability-card-display";

import styles from "./capability-card.module.css";

const { Paragraph, Title } = Typography;

type CapabilityCardProps = {
  capability: CapabilityRecord;
  highlighted?: boolean;
  onClick: (capability: CapabilityRecord) => void;
};

function getKindIcon(kind: string): ReactNode {
  if (kind === "function") {
    return <CodeOutlined />;
  }
  if (kind === "skill") {
    return <ThunderboltOutlined />;
  }
  return <ApiOutlined />;
}

function getKindIconClass(kind: string): string {
  if (kind === "mcp") {
    return styles.iconMcp;
  }
  if (kind === "skill") {
    return styles.iconSkill;
  }
  if (kind === "function") {
    return styles.iconFunction;
  }
  return styles.iconHttp;
}

export function CapabilityCard({ capability, highlighted, onClick }: CapabilityCardProps) {
  const { t } = useTranslation();

  const statusLabel = formatCapabilityStatusLabel(capability.status, t);
  const kindLabel = resolveCapabilityKindLabel(capability.kind, t);
  const subtitle = resolveCapabilityCardSubtitle(capability, t);
  const timeLabel = t("executionFactory.updateTimeLabel", {
    time: formatExecutionUnitTime(capability.updateTime),
  });

  return (
    <Card
      className={[styles.card, highlighted ? styles.cardHighlighted : ""].filter(Boolean).join(" ")}
      data-testid="capability-lab-card"
      hoverable
      onClick={() => onClick(capability)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(capability);
        }
      }}
      role="button"
      tabIndex={0}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.cardBody}>
        <div className={styles.iconWrap}>
          <div className={[styles.iconBadge, getKindIconClass(capability.kind)].join(" ")}>
            {getKindIcon(capability.kind)}
          </div>
        </div>

        <div className={styles.titleRow}>
          <Title className={styles.title} ellipsis={{ rows: 1 }} level={5}>
            {capability.name}
          </Title>
          <Tag
            color={getCapabilityStatusTagColor(capability.status)}
            style={getCapabilityStatusTagStyle(capability.status)}
          >
            {statusLabel}
          </Tag>
        </div>

        <Paragraph className={styles.description} ellipsis={{ rows: 2 }}>
          {capability.description || t("executionFactoryLab.cardNoDescription")}
        </Paragraph>

        <div className={styles.contextRow}>
          <Tag className={styles.kindTag}>{kindLabel}</Tag>
          {subtitle ? <span className={styles.contextText}>{subtitle}</span> : null}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {capability.orchestration?.enabled ? (
              <>
                <span className={styles.orchestrationDot} />
                <span>{t("executionFactoryLab.orchestrationEnabled")}</span>
              </>
            ) : (
              <span />
            )}
          </div>
          <span className={styles.footerRight}>{timeLabel}</span>
        </div>
      </div>
    </Card>
  );
}
