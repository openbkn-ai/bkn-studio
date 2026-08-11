/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  FileZipOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Card, Tag, Typography } from "antd";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import {
  resolveOperatorCategoryLabel,
  resolveSkillCategoryLabel,
  resolveToolboxCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";
import type { OperatorCategory } from "@/modules/execution-factory/types/operator";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

import type { ExecutionUnitCardItem, ExecutionUnitTab } from "./types";
import {
  ExecutionUnitCardMenu,
  type ExecutionUnitCardAction,
} from "./ExecutionUnitCardMenu";

import styles from "./ExecutionUnitCard.module.css";

const { Paragraph } = Typography;

type ExecutionUnitCardProps = {
  activeTab: ExecutionUnitTab;
  installedStateReady?: boolean;
  item: ExecutionUnitCardItem;
  marketMode?: boolean;
  onAction?: (action: ExecutionUnitCardAction, item: ExecutionUnitCardItem) => void;
  onClick?: () => void;
};

/** Toolboxes also distinguish OpenAPI and code functions; one icon cannot show that difference. */
function getTabIcon(activeTab: ExecutionUnitTab, metadataType?: string) {
  switch (activeTab) {
    case "mcp":
      return <ApiOutlined />;
    case "operator":
      return <DeploymentUnitOutlined />;
    case "skill":
      return <FileZipOutlined />;
    default:
      return metadataType === "function" ? <CodeOutlined /> : <ToolOutlined />;
  }
}

/**
 * `offline` falls through to the neutral style on purpose: the UI shows only
 * Published / Unpublished, so a taken-down unit must look the same as one that was never published.
 */
function getStatusStyle(status?: string): CSSProperties {
  if (status === "published") {
    return {
      background: "var(--color-success-bg)",
      borderColor: "var(--color-success-border)",
      color: "var(--color-success-text)",
    };
  }

  if (status === "editing") {
    return {
      background: "var(--color-warning-bg)",
      borderColor: "var(--color-warning-border)",
      color: "var(--color-warning-text)",
    };
  }

  return {
    background: "var(--color-info-bg)",
    borderColor: "var(--color-info-border)",
    color: "var(--color-info-text)",
  };
}

function resolveCardCategoryLabel(
  activeTab: ExecutionUnitTab,
  item: ExecutionUnitCardItem,
  t: (key: string) => string,
) {
  if (activeTab === "operator") {
    return resolveOperatorCategoryLabel(
      { category: item.category as OperatorCategory | undefined, categoryName: item.categoryName },
      t,
    );
  }

  if (activeTab === "toolbox") {
    return resolveToolboxCategoryLabel(
      { categoryType: item.category, categoryName: item.categoryName },
      t,
    );
  }

  if (activeTab === "skill") {
    return resolveSkillCategoryLabel(
      { category: item.category, categoryName: item.categoryName },
      t,
    );
  }

  if (activeTab === "mcp" && item.category) {
    const key = `executionFactory.operatorCategories.${item.category}`;
    const translated = t(key);
    return translated !== key ? translated : item.categoryName ?? item.category;
  }

  return item.categoryName ?? item.category ?? "";
}

/**
 * The leftmost subtitle badge shows each unit's most distinctive fact: implementation form for
 * toolboxes/operators and connection mode for MCP. Previously MCP showed only its category, whose
 * common other_category default printed the same Other label on every card.
 *
 * SKILL has no useful badge: backend version is a UUID rather than a semantic version, and category
 * defaults to Uncategorized. Omit the row rather than displaying noise.
 */
function resolveCardBadge(
  activeTab: ExecutionUnitTab,
  item: ExecutionUnitCardItem,
  t: (key: string) => string,
) {
  if (activeTab === "toolbox" || activeTab === "operator") {
    return item.metadataType
      ? t(`executionFactory.metadataTypes.${item.metadataType as "openapi" | "function"}`)
      : "";
  }

  if (activeTab === "mcp") {
    return item.mode ? t(`executionFactory.mcpModeShort.${item.mode as "sse" | "stream"}`) : "";
  }

  return "";
}

export function ExecutionUnitCard({
  activeTab,
  installedStateReady = true,
  item,
  marketMode = false,
  onAction,
  onClick,
}: ExecutionUnitCardProps) {
  const { t } = useTranslation();
  const userLabel = marketMode ? item.releaseUser : item.updateUser;
  const timeLabel = marketMode
    ? t("executionFactory.releaseTimeLabel", {
        time: formatExecutionUnitTime(item.releaseTime ?? item.updateTime),
      })
    : t("executionFactory.updateTimeLabel", {
        time: formatExecutionUnitTime(item.updateTime),
      });

  const statusLabelKey =
    activeTab === "toolbox"
      ? `executionFactory.toolboxStatuses.${item.status as "published" | "unpublish" | "offline"}`
      : `executionFactory.statuses.${item.status as "published" | "unpublish" | "offline" | "editing"}`;
  const categoryLabel = resolveCardCategoryLabel(activeTab, item, t);
  const isFunction = item.metadataType === "function";
  // other_category is the default for every creation entry, so showing it says almost nothing.
  const showCategory =
    Boolean(categoryLabel) && categoryLabel !== "-" && item.category !== "other_category";
  const showToolCount = activeTab === "toolbox";
  const badgeLabel = resolveCardBadge(activeTab, item, t);
  const hasMetaLine = Boolean(badgeLabel) || showCategory || showToolCount;

  return (
    <Card
      className={styles.card}
      data-testid="execution-unit-card"
      hoverable
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.cardBody}>
        {/* 管理态：小菜单按钮浮在右上角。市场态的「引入 / 同步」按钮较宽，
            卡片变矮后浮在右上角会压住标题，改为正文下方独占一行。 */}
        {onAction && !marketMode ? (
          <div
            className={styles.cardActions}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <ExecutionUnitCardMenu
              activeTab={activeTab}
              installedStateReady={installedStateReady}
              item={item}
              marketMode={marketMode}
              onAction={onAction}
            />
          </div>
        ) : null}

        <div className={styles.header}>
          <span className={`${styles.iconBox} ${isFunction ? styles.iconBoxFunction : ""}`}>
            {getTabIcon(activeTab, item.metadataType)}
          </span>
          <div className={styles.titleContent}>
            <div className={styles.titleRow}>
              <span className={styles.title}>{item.name}</span>
              {item.status ? (
                <Tag className={styles.statusTag} style={getStatusStyle(item.status)}>
                  {t(statusLabelKey)}
                </Tag>
              ) : null}
            </div>

            {hasMetaLine ? (
              <div className={styles.metaLine}>
                {badgeLabel ? (
                  <span
                    className={`${styles.metadataTag} ${
                      isFunction ? styles.metadataTagFunction : ""
                    }`}
                  >
                    {badgeLabel}
                  </span>
                ) : null}
                {showCategory ? <span className={styles.metaText}>{categoryLabel}</span> : null}
                {showCategory && showToolCount ? (
                  <span className={styles.metaDivider}>·</span>
                ) : null}
                {showToolCount ? (
                  <span className={styles.metaText}>
                    {t("executionFactory.toolCountLabel", { count: item.toolCount ?? 0 })}
                  </span>
                ) : null}
              </div>
            ) : null}

            <Paragraph className={styles.description} ellipsis={{ rows: 2 }}>
              {item.description || "-"}
            </Paragraph>
          </div>
        </div>

        {onAction && marketMode ? (
          <div
            className={styles.marketCta}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <ExecutionUnitCardMenu
              activeTab={activeTab}
              installedStateReady={installedStateReady}
              item={item}
              marketMode={marketMode}
              onAction={onAction}
            />
          </div>
        ) : null}

        <div className={styles.footer}>
          <span className={styles.footerLeft}>
            {item.isInternal ? (
              <span className={styles.internalBadge}>
                <span className={styles.internalDot} />
                {t("executionFactory.internalTag")}
              </span>
            ) : (
              <span className={styles.userName}>{userLabel ?? "-"}</span>
            )}
          </span>
          <span className={styles.footerRight}>{timeLabel}</span>
        </div>
      </div>
    </Card>
  );
}
