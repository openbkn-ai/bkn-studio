import {
  ApiOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  EditOutlined,
  KeyOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Empty, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import { OntologyGraphCard } from "@/modules/knowledge-network/components/preview/OntologyGraphCard";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import type {
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

type WorkspaceOverviewSectionProps = {
  detail: KnowledgeNetworkRecord | null;
  detailLoading?: boolean;
  networkId: string;
  onEdit: () => void;
  recentLoading?: boolean;
  recentObjects: KnowledgeNetworkRecentObject[];
};

function formatOverviewCount(value?: number) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export function WorkspaceOverviewSection({
  detail,
  detailLoading = false,
  networkId,
  onEdit,
  recentLoading = false,
  recentObjects,
}: WorkspaceOverviewSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [authorizeOpen, setAuthorizeOpen] = useState(false);

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

  return (
    <div className={styles.overviewBox}>
      <Spin spinning={detailLoading}>
      <div className={styles.overviewHeaderCard}>
        <div className={styles.overviewHeaderTitle}>
          <div className={styles.overviewHeaderTitleLeft}>
            <span
              className={styles.overviewHeaderIcon}
              style={{ backgroundColor: detail?.color ?? "#126ee3" }}
            >
              {renderResourceIcon(detail?.icon)}
            </span>
            <div className={styles.overviewHeaderName}>{detail?.name}</div>
          </div>
          <div className={styles.overviewHeaderTitleRight}>
            <PermissionGate permissions="admin-authz:grant">
              <AppButton
                disabled={!detail}
                icon={<KeyOutlined />}
                onClick={() => setAuthorizeOpen(true)}
              >
                {t("systemAdmin.objectGrants.authorize")}
              </AppButton>
            </PermissionGate>
            <AppButton icon={<EditOutlined />} onClick={onEdit}>
              {t("common.edit")}
            </AppButton>
            <button
              type="button"
              className={styles.experienceButton}
              onClick={() => message.info(t("knowledgeNetwork.previewExperienceHint"))}
            >
              <ThunderboltFilled />
              <span>{t("knowledgeNetwork.previewExperience")}</span>
            </button>
          </div>
        </div>
        <div className={styles.overviewHeaderComment}>
          {detail?.description || t("knowledgeNetwork.noComment")}
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
        </div>
      </div>
      </Spin>

      <div className={styles.overviewGraphSection}>
        <OntologyGraphCard networkId={networkId} />
      </div>

      <div className={styles.overviewContentCard}>
        <h3 className={styles.overviewContentTitle}>
          {t("knowledgeNetwork.recentlyModifiedObjectTypes")}
        </h3>
        <div className={styles.overviewContentBody}>
          <Table<KnowledgeNetworkRecentObject>
            columns={recentObjectColumns}
            dataSource={recentObjects}
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
        </div>
      </div>

      {detail ? (
        <ObjectAuthorizeDrawer
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
