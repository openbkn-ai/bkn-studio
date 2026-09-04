/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DownOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  KeyOutlined,
  RightOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Empty, Spin, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { formatNumber } from "@/framework/i18n/format";
import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import { OverviewOntologyBlock } from "@/modules/knowledge-network/components/preview/OverviewOntologyBlock";
import { MarkdownText } from "@/framework/ui/common/MarkdownText";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import type {
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

type WorkspaceOverviewSectionProps = {
  canModify: boolean;
  detail: KnowledgeNetworkRecord | null;
  detailLoading?: boolean;
  loadRecentObjects: () => Promise<void>;
  networkId: string;
  onEdit: () => void;
  recentLoading?: boolean;
  recentObjects: KnowledgeNetworkRecentObject[];
};

function formatOverviewCount(value?: number) {
  return formatNumber(value ?? 0);
}

export function WorkspaceOverviewSection({
  canModify,
  detail,
  detailLoading = false,
  loadRecentObjects,
  networkId,
  onEdit,
  recentLoading = false,
  recentObjects,
}: WorkspaceOverviewSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  // Judged on the record's own operations, not on a platform permission point. bkn-backend writes
  // `authorize` to whoever created the network, so this is what "I made it, I may share it" looks
  // like; admin-authz:grant is a platform-administrator capability that a builder never holds, and
  // gating on it hid the button from exactly the person the grant was written for.
  const canAuthorize = hasKnowledgeNetworkRecordOperation(detail, "authorize");
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [recentPage, setRecentPage] = useState(1);
  const [recentPageSize, setRecentPageSize] = useState(5);
  const networkIdentifier = detail?.identifier?.trim() || "";

  const copyNetworkIdentifier = () => {
    if (!networkIdentifier) {
      return;
    }

    void navigator.clipboard
      ?.writeText(networkIdentifier)
      .then(() => message.success(t("knowledgeNetwork.networkIdentifierCopied")))
      .catch(() => message.error(t("knowledgeNetwork.copyNetworkIdentifierFailed")));
  };

  const recentObjectColumns = useMemo<ColumnsType<KnowledgeNetworkRecentObject>>(
    () => [
      {
        dataIndex: "name",
        key: "name",
        title: t("common.name"),
        width: 360,
        render: (_value: string, record) => (
          <div className={styles.objectTitleBox}>
            <span
              className={styles.objectIconSquare}
              style={{ backgroundColor: record.color }}
            >
              {renderResourceIcon(record.icon)}
            </span>
            <span>{record.name}</span>
          </div>
        ),
      },
      {
        dataIndex: "tags",
        key: "tags",
        title: t("common.tag"),
        width: 180,
        render: (value: string[]) => {
          if (!value?.length) {
            return "--";
          }

          return (
            <div className={styles.tableTags}>
              {value.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          );
        },
      },
      {
        dataIndex: "updaterName",
        key: "updaterName",
        title: t("knowledgeNetwork.modifier"),
        width: 180,
        render: (value: string) => value || "--",
      },
      {
        dataIndex: "updateTime",
        key: "updateTime",
        title: t("common.updateTime"),
        width: 220,
      },
    ],
    [t],
  );

  const pagedRecentObjects = useMemo(() => {
    const start = (recentPage - 1) * recentPageSize;
    return recentObjects.slice(start, start + recentPageSize);
  }, [recentObjects, recentPage, recentPageSize]);

  useEffect(() => {
    setRecentPage(1);
  }, [networkId]);

  useEffect(() => {
    if (!recentExpanded) {
      return;
    }

    void loadRecentObjects();
  }, [loadRecentObjects, networkId, recentExpanded]);

  return (
    <div className={styles.overviewBox}>
      <Spin spinning={detailLoading}>
      <div className={styles.overviewHeaderCard}>
        <div className={styles.overviewHeaderTitle}>
          <div className={styles.overviewHeaderTitleLeft}>
            <span
              className={styles.overviewHeaderIcon}
              style={{ color: detail?.color ?? "#126ee3" }}
            >
              <DeploymentUnitOutlined />
            </span>
            <div className={styles.overviewHeaderName}>{detail?.name}</div>
          </div>
          <div className={styles.overviewHeaderTitleRight}>
            <AppButton
              disabled={!detail}
              icon={<KeyOutlined />}
              onClick={() => setAuthorizeOpen(true)}
            >
              {t("knowledgeNetwork.authorizeAction")}
            </AppButton>
            {canModify ? (
              <AppButton icon={<EditOutlined />} onClick={onEdit}>
                {t("common.edit")}
              </AppButton>
            ) : null}
          </div>
        </div>
        <div className={styles.overviewHeaderComment}>
          {detail?.description ? (
            <MarkdownText text={detail.description} />
          ) : (
            t("knowledgeNetwork.noComment")
          )}
        </div>
        <div className={styles.overviewHeaderFooter}>
          <UserOutlined />
          <span className={styles.overviewHeaderFooterLabel}>
            {t("knowledgeNetwork.modifier")}:
          </span>
          <span className={styles.overviewHeaderFooterValue}>
            {detail?.creatorName || detail?.updaterName || "--"}
          </span>
          <ClockCircleOutlined />
          <span className={styles.overviewHeaderFooterLabel}>
            {t("common.updateTime")}:
          </span>
          <span>{detail?.updateTime || "--"}</span>
          <span className={styles.overviewHeaderFooterId}>
            <span className={styles.overviewHeaderFooterLabel}>{t("common.id")}:</span>
            <code>{networkIdentifier || "--"}</code>
            <Tooltip title={t("knowledgeNetwork.copyNetworkIdentifier")}>
              <button
                aria-label={t("knowledgeNetwork.copyNetworkIdentifier")}
                className={styles.overviewHeaderFooterCopy}
                disabled={!networkIdentifier}
                onClick={copyNetworkIdentifier}
                type="button"
              >
                <CopyOutlined />
              </button>
            </Tooltip>
          </span>
        </div>
      </div>

      <div className={styles.overviewStatRow}>
        <div className={styles.overviewStatCard}>
          <dl className={styles.overviewStatDefinition}>
            <dt
              className={styles.overviewStatIcon}
              style={{ backgroundColor: "#126ee3" }}
            >
              <DatabaseOutlined />
            </dt>
            <dd>
              <p>{t("knowledgeNetwork.objectTypes")}</p>
              <p>{formatOverviewCount(detail?.statistics.objectTypesTotal)}</p>
            </dd>
          </dl>
          {canModify ? (
            <AppButton
              className={styles.overviewStatAction}
              onClick={() => {
                void navigate(
                  `/knowledge-network/workspace/${networkId}/object-types/create`,
                );
              }}
              type="link"
            >
              {t("knowledgeNetwork.createObjectTypeEntry")}
            </AppButton>
          ) : null}
        </div>

        <div className={styles.overviewStatCard}>
          <dl className={styles.overviewStatDefinition}>
            <dt
              className={styles.overviewStatIcon}
              style={{ backgroundColor: "#08979c" }}
            >
              <ApiOutlined />
            </dt>
            <dd>
              <p>{t("knowledgeNetwork.relationTypes")}</p>
              <p>{formatOverviewCount(detail?.statistics.relationTypesTotal)}</p>
            </dd>
          </dl>
          {canModify ? (
            <AppButton
              className={styles.overviewStatAction}
              onClick={() => {
                void navigate(
                  `/knowledge-network/workspace/${networkId}/relation-types/create`,
                );
              }}
              type="link"
            >
              {t("knowledgeNetwork.createRelationTypeEntry")}
            </AppButton>
          ) : null}
        </div>

        <div className={styles.overviewStatCard}>
          <dl className={styles.overviewStatDefinition}>
            <dt
              className={styles.overviewStatIcon}
              style={{ backgroundColor: "#90c06b" }}
            >
              <ThunderboltOutlined />
            </dt>
            <dd>
              <p>{t("knowledgeNetwork.actionTypes")}</p>
              <p>{formatOverviewCount(detail?.statistics.actionTypesTotal)}</p>
            </dd>
          </dl>
          {canModify ? (
            <AppButton
              className={styles.overviewStatAction}
              onClick={() => {
                void navigate(
                  `/knowledge-network/workspace/${networkId}/action-types/create`,
                );
              }}
              type="link"
            >
              {t("knowledgeNetwork.createActionTypeEntry")}
            </AppButton>
          ) : null}
        </div>
      </div>
      </Spin>

      <div className={styles.overviewGraphSection}>
        <OverviewOntologyBlock
          detailsExpanded={graphExpanded}
          networkId={networkId}
          onToggleDetails={() => setGraphExpanded((value) => !value)}
        />
      </div>

      <div className={styles.overviewContentCard}>
        <button
          className={
            recentExpanded
              ? `${styles.overviewSectionToggle} ${styles.overviewSectionToggleExpanded}`
              : styles.overviewSectionToggle
          }
          onClick={() => setRecentExpanded((value) => !value)}
          type="button"
        >
          <span>{t("knowledgeNetwork.recentlyModifiedObjectTypes")}</span>
          <span className={styles.overviewSectionToggleIcon}>
            {recentExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        </button>
        {recentExpanded ? (
          <div className={styles.overviewContentBody}>
            <Table<KnowledgeNetworkRecentObject>
              columns={recentObjectColumns}
              dataSource={pagedRecentObjects}
              loading={recentLoading}
              locale={{
                emptyText: (
                  <Empty
                    className={styles.tableEmptyState}
                    description={t("knowledgeNetwork.emptyRecentObjects")}
                  />
                ),
              }}
              pagination={false}
              rowKey="id"
              size="small"
            />
            {recentObjects.length > 0 ? (
              <div className={styles.paginationBar}>
                <TablePaginationBar
                  current={recentPage}
                  onChange={(page, pageSize) => {
                    setRecentPage(page);
                    setRecentPageSize(pageSize);
                  }}
                  pageSize={recentPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  showSizeChanger
                  showTotal={(total) => t("common.total", { total })}
                  total={recentObjects.length}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {detail ? (
        <ObjectAuthorizeDrawer
          objectAuthorized={canAuthorize}
          objId={networkId}
          objName={detail.name}
          objType="knowledge_network"
          onClose={() => setAuthorizeOpen(false)}
          open={authorizeOpen}
        />
      ) : null}
    </div>
  );
}
