/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { SkillDetailDrawer } from "@/modules/execution-factory/components/SkillDetailDrawer";
import { SkillHistoryDrawer } from "@/modules/execution-factory/components/SkillHistoryDrawer";
import {
  deleteSkill,
  listSkills,
  updateSkillStatus,
} from "@/modules/execution-factory/services/skill.service";
import type { SkillRecord, SkillStatus } from "@/modules/execution-factory/types/skill";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

import styles from "./execution-factory-list.module.css";

const statusClassMap: Record<SkillStatus, string> = {
  published: styles.statusTagPublished,
  offline: styles.statusTagOffline,
  unpublish: styles.statusTagDefault,
};

function formatTimestamp(value?: number) {
  return formatExecutionUnitTime(value);
}

/** @deprecated Use `ExecutionUnitListScene` with `activeTab="skill"` instead. */
export function SkillListScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const [selectedStatus, setSelectedStatus] = useState<SkillStatus>();
  const [items, setItems] = useState<SkillRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailSkillId, setDetailSkillId] = useState<string | null>(null);
  const [historySkillId, setHistorySkillId] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      ...query,
      status: selectedStatus,
    }),
    [query, selectedStatus],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listSkills(listQuery);
      setItems(listResult.items);
      setTotal(listResult.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStatusChange = (record: SkillRecord, status: SkillStatus) => {
    void modal.confirm({
      title: t("executionFactory.skillStatusChangeConfirmTitle"),
      content: t("executionFactory.skillStatusChangeConfirmDescription", {
        name: record.name,
        status: t(`executionFactory.skillStatuses.${status}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateSkillStatus(record.skillId, status);
        void message.success(t("common.success"));
        await loadData();
      },
    });
  };

  const handleDelete = (record: SkillRecord) => {
    void modal.confirm({
      title: t("executionFactory.skillDeleteConfirmTitle"),
      content: t("executionFactory.skillDeleteConfirmDescription", {
        name: record.name,
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await deleteSkill(record.skillId);
        void message.success(t("common.success"));
        await loadData();
      },
    });
  };

  const columns: ColumnsType<SkillRecord> = [
    {
      dataIndex: "name",
      title: t("executionFactory.skillName"),
      render: (_, record) => (
        <div className={styles.nameCell}>
          <div className={styles.nameTitle}>{record.name}</div>
          <span className={styles.operatorIdText}>{record.skillId}</span>
        </div>
      ),
    },
    {
      dataIndex: "version",
      title: t("executionFactory.version"),
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (value: SkillStatus) => (
        <Tag className={statusClassMap[value] ?? styles.statusTagDefault}>
          {t(`executionFactory.skillStatuses.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "categoryName",
      title: t("executionFactory.category"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "updateTime",
      title: t("executionFactory.updateTime"),
      render: (value?: number) => formatTimestamp(value),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <div className={styles.actionGroup}>
          <PermissionGate permissions="execution-factory:skill:view">
            <AppButton onClick={() => setDetailSkillId(record.skillId)} type="link">
              {t("common.detail")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:skill:edit">
            <AppButton
              onClick={() => {
                void navigate(`/execution-factory/skills/${record.skillId}/edit`);
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:skill:view">
            <AppButton onClick={() => setHistorySkillId(record.skillId)} type="link">
              {t("executionFactory.skillHistoryTitle")}
            </AppButton>
          </PermissionGate>
          {record.status !== "published" ? (
            <PermissionGate permissions="execution-factory:skill:publish">
              <AppButton
                onClick={() => handleStatusChange(record, "published")}
                type="link"
              >
                {t("executionFactory.publish")}
              </AppButton>
            </PermissionGate>
          ) : (
            <PermissionGate permissions="execution-factory:skill:publish">
              <AppButton
                onClick={() => handleStatusChange(record, "offline")}
                type="link"
              >
                {t("executionFactory.offline")}
              </AppButton>
            </PermissionGate>
          )}
          <PermissionGate permissions="execution-factory:skill:delete">
            <AppButton
              className={styles.actionDanger}
              danger
              onClick={() => handleDelete(record)}
              type="link"
            >
              {t("common.delete")}
            </AppButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <>
    <section className={styles.contentSurface}>
      <div className={styles.pageIntro}>
        <h2 className={styles.pageIntroTitle}>{t("executionFactory.skillListTitle")}</h2>
        <p className={styles.pageIntroDescription}>
          {t("executionFactory.skillListDescription")}
        </p>
      </div>
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            <PermissionGate permissions="execution-factory:skill:create">
              <AppButton
                onClick={() => {
                  void navigate("/execution-factory/skills/new");
                }}
                type="primary"
              >
                {t("common.create")}
              </AppButton>
            </PermissionGate>
            <AppButton icon={<ReloadOutlined />} onClick={reset}>
              {t("common.refresh")}
            </AppButton>
          </div>
          <span className={styles.toolbarMeta}>{t("executionFactory.skillToolbarHint")}</span>
        </div>
        <div className={styles.toolbarFilters}>
          <Input.Search
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={setKeyword}
            placeholder={t("executionFactory.skillSearchPlaceholder")}
            value={pageState.keyword}
          />
          <Select
            allowClear
            className={styles.filterSelect}
            onChange={(value) => setSelectedStatus(value)}
            options={(["unpublish", "published", "offline"] as SkillStatus[]).map(
              (status) => ({
                label: t(`executionFactory.skillStatuses.${status}`),
                value: status,
              }),
            )}
            placeholder={t("executionFactory.statusFilterPlaceholder")}
            value={selectedStatus}
          />
        </div>
      </div>
      <div className={styles.tableSurface}>
        {loadError ? (
          <Alert
            action={
              <AppButton onClick={() => void loadData()} type="link">
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            type="error"
          />
        ) : null}
        <AppTable
          columns={columns}
          dataSource={items}
          loading={loading}
          locale={{
            emptyText: (
              <EmptyStatePanel
                description={t("executionFactory.skillEmptyDescription")}
                title={t("executionFactory.skillEmpty")}
              />
            ),
          }}
          onChange={(pagination) => {
            setPagination(pagination.current ?? 1, pagination.pageSize ?? 10);
          }}
          pagination={{
            current: pageState.page,
            pageSize: pageState.pageSize,
            showSizeChanger: true,
            total,
          }}
          rowKey="skillId"
        />
      </div>
    </section>
    <SkillDetailDrawer
      onClose={() => setDetailSkillId(null)}
      onEdit={(skillId) => {
        setDetailSkillId(null);
        void navigate(`/execution-factory/skills/${skillId}/edit`);
      }}
      onOpenHistory={(skillId) => {
        setDetailSkillId(null);
        setHistorySkillId(skillId);
      }}
      onViewDetail={(id) => {
        setDetailSkillId(null);
        void navigate(`/execution-factory/skills/${id}`);
      }}
      open={Boolean(detailSkillId)}
      skillId={detailSkillId}
    />
    <SkillHistoryDrawer
      onClose={() => setHistorySkillId(null)}
      onUpdated={() => void loadData()}
      open={Boolean(historySkillId)}
      skillId={historySkillId}
    />
    </>
  );
}
