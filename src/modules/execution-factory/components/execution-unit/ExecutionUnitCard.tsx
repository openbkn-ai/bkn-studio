import {
  ApiOutlined,
  DeploymentUnitOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Avatar, Card, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

import type { ExecutionUnitCardItem, ExecutionUnitTab } from "./types";

import styles from "./ExecutionUnitCard.module.css";

const { Paragraph, Title } = Typography;

type ExecutionUnitCardProps = {
  activeTab: ExecutionUnitTab;
  item: ExecutionUnitCardItem;
  marketMode?: boolean;
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

function getStatusColor(status?: string) {
  if (status === "published") {
    return "success";
  }

  if (status === "offline") {
    return "default";
  }

  if (status === "editing") {
    return "warning";
  }

  return "processing";
}

export function ExecutionUnitCard({
  activeTab,
  item,
  marketMode = false,
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

  return (
    <Card
      className={styles.card}
      hoverable
      onClick={onClick}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.cardBody}>
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
          {!marketMode && item.status ? (
            <Tag color={getStatusColor(item.status)}>{t(statusLabelKey)}</Tag>
          ) : null}
        </div>

        <Paragraph className={styles.description} ellipsis={{ rows: 2 }}>
          {item.description || "-"}
        </Paragraph>

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
