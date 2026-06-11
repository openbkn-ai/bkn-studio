import {
  ApiOutlined,
  DeploymentUnitOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Avatar, Card, Tag, Typography } from "antd";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import {
  resolveOperatorCategoryLabel,
  resolveSkillCategoryLabel,
  resolveToolboxCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

import type { ExecutionUnitCardItem, ExecutionUnitTab } from "./types";
import {
  ExecutionUnitCardMenu,
  type ExecutionUnitCardAction,
} from "./ExecutionUnitCardMenu";

import styles from "./ExecutionUnitCard.module.css";

const { Paragraph, Title } = Typography;

type ExecutionUnitCardProps = {
  activeTab: ExecutionUnitTab;
  installedStateReady?: boolean;
  item: ExecutionUnitCardItem;
  marketMode?: boolean;
  onAction?: (action: ExecutionUnitCardAction, item: ExecutionUnitCardItem) => void;
  onClick?: () => void;
};

function getTabIcon(activeTab: ExecutionUnitTab) {
  switch (activeTab) {
    case "mcp":
      return <ApiOutlined />;
    case "operator":
      return <DeploymentUnitOutlined />;
    case "skill":
      return <ThunderboltOutlined />;
    default:
      return <ToolOutlined />;
  }
}

function getStatusStyle(status?: string): CSSProperties {
  if (status === "published") {
    return {
      background: "var(--color-success-bg)",
      borderColor: "var(--color-success-border)",
      color: "var(--color-success-text)",
    };
  }

  if (status === "offline") {
    return {
      background: "var(--color-error-bg)",
      borderColor: "var(--color-error-border)",
      color: "var(--color-error-text)",
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
      { category: item.category, categoryName: item.categoryName },
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

export function ExecutionUnitCard({
  activeTab,
  installedStateReady = true,
  item,
  marketMode = false,
  onAction,
  onClick,
}: ExecutionUnitCardProps) {
  const { t } = useTranslation();
  const showMetadataTag =
    activeTab === "toolbox" || activeTab === "operator";
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
        {onAction ? (
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
        <div className={styles.iconWrap}>
          <div className={styles.iconBadge}>{getTabIcon(activeTab)}</div>
          {showMetadataTag && item.metadataType ? (
            <span className={styles.metadataTag}>
              {t(`executionFactory.metadataTypes.${item.metadataType as "openapi" | "function"}`)}
            </span>
          ) : null}
        </div>

        <div className={styles.titleRow}>
          <Title className={styles.title} ellipsis={{ rows: 1 }} level={5}>
            {item.name}
          </Title>
          {item.status ? (
            <Tag style={getStatusStyle(item.status)}>{t(statusLabelKey)}</Tag>
          ) : null}
        </div>

        <Paragraph className={styles.description} ellipsis={{ rows: 2 }}>
          {item.description || "-"}
        </Paragraph>

        {categoryLabel && categoryLabel !== "-" ? (
          <div className={styles.cardMetaRow}>
            <Tag className={styles.categoryTag}>{categoryLabel}</Tag>
          </div>
        ) : null}

        {activeTab === "toolbox" ? (
          <div className={styles.toolCount}>
            {t("executionFactory.toolCountLabel", { count: item.toolCount ?? 0 })}
          </div>
        ) : null}

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {item.isInternal ? (
              <span className={styles.internalBadge}>
                <span className={styles.internalDot} />
                {t("executionFactory.internalTag")}
              </span>
            ) : (
              <>
                <Avatar size={20}>{userLabel?.charAt(0) ?? "?"}</Avatar>
                <span className={styles.userName}>{userLabel ?? "-"}</span>
              </>
            )}
          </div>
          <span className={styles.footerRight}>{timeLabel}</span>
        </div>
      </div>
    </Card>
  );
}
