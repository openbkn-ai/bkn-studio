/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  EyeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Alert, Descriptions, Drawer, Input, Select, Statistic, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { authzPoints } from "@/modules/system-admin/permissions";
import {
  getProxySyncPlan,
  listProxyAccounts,
  reconcileProxyAccounts,
  retryProxySync,
} from "@/modules/system-admin/services/proxy-governance.service";
import type {
  ProxyGovernanceAccount,
  ProxyGrantSource,
  ProxyReconcileReport,
  ProxySyncPlan,
  ProxySyncStatus,
} from "@/modules/system-admin/types/proxy-governance";

import styles from "./ProxyGovernanceScene.module.css";

type StatusFilter = "all" | ProxySyncStatus | "inactive";

function syncTagColor(status: ProxySyncStatus) {
  if (status === "ready") return "success";
  if (status === "pending") return "processing";
  return "error";
}

function formatTimestamp(timestamp: number) {
  return timestamp > 0 ? dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss") : "—";
}

export function ProxyGovernanceScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [accounts, setAccounts] = useState<ProxyGovernanceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState(false);
  const [reconcileReport, setReconcileReport] = useState<ProxyReconcileReport | null>(null);
  const [plan, setPlan] = useState<ProxySyncPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planNetworkId, setPlanNetworkId] = useState<string | null>(null);
  const planRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAccounts(await listProxyAccounts());
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    planRequestIdRef.current += 1;
  }, []);

  const summary = useMemo(() => ({
    total: accounts.length,
    ready: accounts.filter((item) => item.lifecycleStatus === "active" && item.syncStatus === "ready").length,
    pending: accounts.filter((item) => item.lifecycleStatus === "active" && item.syncStatus === "pending").length,
    attention: accounts.filter((item) => item.lifecycleStatus !== "active" || item.syncStatus === "failed").length,
  }), [accounts]);

  const visibleAccounts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return accounts.filter((item) => {
      const matchesKeyword = !normalizedKeyword ||
        item.knowledgeNetworkId.toLowerCase().includes(normalizedKeyword) ||
        item.proxyAccountId.toLowerCase().includes(normalizedKeyword);
      const matchesStatus = status === "all" ||
        (status === "inactive" ? item.lifecycleStatus !== "active" : item.syncStatus === status);
      return matchesKeyword && matchesStatus;
    });
  }, [accounts, keyword, status]);

  const openPlan = useCallback(async (knowledgeNetworkId: string) => {
    const requestId = planRequestIdRef.current + 1;
    planRequestIdRef.current = requestId;
    setPlanNetworkId(knowledgeNetworkId);
    setPlan(null);
    setPlanError(null);
    setPlanLoading(true);
    try {
      const nextPlan = await getProxySyncPlan(knowledgeNetworkId);
      if (planRequestIdRef.current === requestId &&
        nextPlan.knowledgeNetworkId === knowledgeNetworkId) {
        setPlan(nextPlan);
      }
    } catch (error) {
      if (planRequestIdRef.current === requestId) {
        setPlanError(extractRequestErrorMessage(error));
      }
    } finally {
      if (planRequestIdRef.current === requestId) {
        setPlanLoading(false);
      }
    }
  }, []);

  const closePlan = useCallback(() => {
    planRequestIdRef.current += 1;
    setPlanNetworkId(null);
    setPlan(null);
    setPlanError(null);
    setPlanLoading(false);
  }, []);

  const retrySync = useCallback(async (knowledgeNetworkId: string) => {
    setSyncingIds((current) => new Set(current).add(knowledgeNetworkId));
    try {
      const updated = await retryProxySync(knowledgeNetworkId);
      setAccounts((current) => current.map((item) =>
        item.knowledgeNetworkId === knowledgeNetworkId ? updated : item));
      void message.success(t("systemAdmin.proxyGovernance.toast.syncSucceeded"));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSyncingIds((current) => {
        const next = new Set(current);
        next.delete(knowledgeNetworkId);
        return next;
      });
    }
  }, [message, t]);

  const reconcile = useCallback(() => {
    modal.confirm({
      title: t("systemAdmin.proxyGovernance.reconcileConfirmTitle"),
      content: t("systemAdmin.proxyGovernance.reconcileConfirmContent"),
      okText: t("systemAdmin.proxyGovernance.reconcile"),
      onOk: async () => {
        setReconciling(true);
        try {
          const report = await reconcileProxyAccounts();
          setReconcileReport(report);
          void message.success(t("systemAdmin.proxyGovernance.toast.reconcileCompleted"));
          await load();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        } finally {
          setReconciling(false);
        }
      },
    });
  }, [load, message, modal, t]);

  const columns = useMemo<ColumnsType<ProxyGovernanceAccount>>(() => [
    {
      title: t("systemAdmin.proxyGovernance.columns.network"),
      dataIndex: "knowledgeNetworkId",
      width: 210,
      render: (value: string) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t("systemAdmin.proxyGovernance.columns.proxyAccount"),
      dataIndex: "proxyAccountId",
      width: 220,
      render: (value: string) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t("systemAdmin.proxyGovernance.columns.lifecycle"),
      dataIndex: "lifecycleStatus",
      width: 130,
      render: (value: ProxyGovernanceAccount["lifecycleStatus"]) => (
        <Tag color={value === "active" ? "success" : "default"}>
          {t(`systemAdmin.proxyGovernance.lifecycleStatus.${value}`)}
        </Tag>
      ),
    },
    {
      title: t("systemAdmin.proxyGovernance.columns.sync"),
      dataIndex: "syncStatus",
      width: 125,
      render: (value: ProxySyncStatus) => (
        <Tag color={syncTagColor(value)}>{t(`systemAdmin.proxyGovernance.syncStatus.${value}`)}</Tag>
      ),
    },
    {
      title: t("systemAdmin.proxyGovernance.columns.modelVersion"),
      width: 210,
      render: (_, item) => (
        <div className={styles.versionCell}>
          <span className={styles.mono}>{item.syncedModelVersion || "—"}</span>
          {item.syncedModelVersion !== item.publishedModelVersion ? (
            <span className={styles.secondary}>
              {t("systemAdmin.proxyGovernance.publishedVersion", { version: item.publishedModelVersion || "—" })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      title: t("systemAdmin.proxyGovernance.columns.lastError"),
      dataIndex: "lastErrorCode",
      width: 190,
      render: (value: ProxyGovernanceAccount["lastErrorCode"], item) => value ? (
        <div className={styles.versionCell}>
          <span>{t(`systemAdmin.proxyGovernance.errorCodes.${value}`)}</span>
          <span className={styles.secondary}>{formatTimestamp(item.updatedAt)}</span>
        </div>
      ) : "—",
    },
    {
      title: t("systemAdmin.proxyGovernance.columns.updatedAt"),
      dataIndex: "updatedAt",
      width: 175,
      render: formatTimestamp,
    },
    {
      title: t("systemAdmin.proxyGovernance.columns.actions"),
      fixed: "right",
      width: 220,
      render: (_, item) => (
        <div className={styles.actions}>
          <AppButton icon={<EyeOutlined />} onClick={() => void openPlan(item.knowledgeNetworkId)} type="link">
            {t("systemAdmin.proxyGovernance.viewSources")}
          </AppButton>
          <PermissionGate permissions={[authzPoints.grant, authzPoints.revoke]}>
            <AppButton
              icon={<SyncOutlined />}
              loading={syncingIds.has(item.knowledgeNetworkId)}
              onClick={() => void retrySync(item.knowledgeNetworkId)}
              type="link"
            >
              {t("systemAdmin.proxyGovernance.retrySync")}
            </AppButton>
          </PermissionGate>
        </div>
      ),
    },
  ], [openPlan, retrySync, syncingIds, t]);

  const sourceColumns = useMemo<ColumnsType<ProxyGrantSource>>(() => [
    { title: t("systemAdmin.proxyGovernance.sourceColumns.binding"), dataIndex: "bindingId", width: 180 },
    { title: t("systemAdmin.proxyGovernance.sourceColumns.bindingType"), dataIndex: "bindingType", width: 130 },
    { title: t("systemAdmin.proxyGovernance.sourceColumns.resource"), dataIndex: "resourceId", width: 180 },
    { title: t("systemAdmin.proxyGovernance.sourceColumns.resourceType"), dataIndex: "resourceType", width: 120 },
    { title: t("systemAdmin.proxyGovernance.sourceColumns.operation"), dataIndex: "operation", width: 120 },
  ], [t]);

  const reportIssueCount = reconcileReport ? reconcileReport.missingMappings.length +
    reconcileReport.orphanMappings.length +
    Object.keys(reconcileReport.conflictingProxyAccounts).length +
    Object.keys(reconcileReport.authorizationDrift).length +
    reconcileReport.failedKnowledgeNetworkIds.length : 0;

  const reconcileGroups = reconcileReport ? [
    {
      key: "missing",
      values: reconcileReport.missingMappings,
    },
    {
      key: "orphan",
      values: reconcileReport.orphanMappings,
    },
    {
      key: "conflicts",
      values: Object.entries(reconcileReport.conflictingProxyAccounts).map(
        ([knowledgeNetworkId, proxyAccountIds]) => `${knowledgeNetworkId}: ${proxyAccountIds.join(", ")}`,
      ),
    },
    {
      key: "drift",
      values: Object.entries(reconcileReport.authorizationDrift).map(
        ([knowledgeNetworkId, changes]) => `${knowledgeNetworkId}: ${Object.entries(changes)
          .map(([name, count]) => `${name} ${count}`)
          .join(", ")}`,
      ),
    },
    {
      key: "failed",
      values: reconcileReport.failedKnowledgeNetworkIds,
    },
  ].filter((group) => group.values.length > 0) : [];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("systemAdmin.proxyGovernance.title")}</h1>
          <p className={styles.subtitle}>{t("systemAdmin.proxyGovernance.description")}</p>
        </div>
        <PermissionGate permissions={[authzPoints.grant, authzPoints.revoke]}>
          <AppButton
            icon={<SafetyCertificateOutlined />}
            loading={reconciling}
            onClick={reconcile}
            type="primary"
          >
            {t("systemAdmin.proxyGovernance.reconcile")}
          </AppButton>
        </PermissionGate>
      </header>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}><Statistic title={t("systemAdmin.proxyGovernance.stats.total")} value={summary.total} /></div>
        <div className={styles.summaryCard}><Statistic title={t("systemAdmin.proxyGovernance.stats.ready")} value={summary.ready} /></div>
        <div className={styles.summaryCard}><Statistic title={t("systemAdmin.proxyGovernance.stats.pending")} value={summary.pending} /></div>
        <div className={styles.summaryCard}><Statistic title={t("systemAdmin.proxyGovernance.stats.attention")} value={summary.attention} /></div>
      </div>

      {reconcileReport ? (
        <div className={styles.reconcilePanel}>
          <Alert
            closable
            description={t("systemAdmin.proxyGovernance.reconcileSummary", {
              conflicts: Object.keys(reconcileReport.conflictingProxyAccounts).length,
              drift: Object.keys(reconcileReport.authorizationDrift).length,
              failed: reconcileReport.failedKnowledgeNetworkIds.length,
              missing: reconcileReport.missingMappings.length,
              orphan: reconcileReport.orphanMappings.length,
            })}
            message={t(reportIssueCount === 0
              ? "systemAdmin.proxyGovernance.reconcileClean"
              : "systemAdmin.proxyGovernance.reconcileIssues", { count: reportIssueCount })}
            onClose={() => setReconcileReport(null)}
            showIcon
            type={reportIssueCount === 0 ? "success" : "warning"}
          />
          {reconcileGroups.length > 0 ? (
            <div className={styles.reconcileDetails}>
              {reconcileGroups.map((group) => (
                <div className={styles.reconcileGroup} key={group.key}>
                  <span className={styles.reconcileLabel}>
                    {t(`systemAdmin.proxyGovernance.reconcileDetails.${group.key}`)}
                  </span>
                  <div className={styles.reconcileValues}>
                    {group.values.map((value) => <Tag key={value}>{value}</Tag>)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input.Search
            allowClear
            className={styles.search}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("systemAdmin.proxyGovernance.searchPlaceholder")}
            value={keyword}
          />
          <Select<StatusFilter>
            className={styles.statusSelect}
            onChange={setStatus}
            options={(["all", "ready", "pending", "failed", "inactive"] as const).map((value) => ({
              label: t(`systemAdmin.proxyGovernance.filters.${value}`),
              value,
            }))}
            value={status}
          />
        </div>
        <AppButton icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
          {t("common.refresh")}
        </AppButton>
      </div>

      {loadError ? (
        <Alert
          action={<AppButton onClick={() => void load()} type="link">{t("common.retry")}</AppButton>}
          message={loadError}
          showIcon
          type="error"
        />
      ) : (
        <div className={styles.tablePanel}>
          <AppTable<ProxyGovernanceAccount>
            columns={columns}
            dataSource={visibleAccounts}
            loading={loading}
            locale={{ emptyText: t("systemAdmin.proxyGovernance.empty") }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            rowKey="knowledgeNetworkId"
            scroll={{ x: 1480 }}
          />
        </div>
      )}

      <Drawer
        destroyOnHidden
        onClose={closePlan}
        open={Boolean(planNetworkId)}
        title={t("systemAdmin.proxyGovernance.sourcesTitle")}
        width={820}
      >
        {planError ? (
          <Alert
            action={planNetworkId ? <AppButton onClick={() => void openPlan(planNetworkId)} type="link">{t("common.retry")}</AppButton> : null}
            message={planError}
            showIcon
            type="error"
          />
        ) : (
          <>
            <Descriptions className={styles.drawerMeta} column={1} size="small">
              <Descriptions.Item label={t("systemAdmin.proxyGovernance.columns.network")}>{planNetworkId}</Descriptions.Item>
              <Descriptions.Item label={t("systemAdmin.proxyGovernance.columns.proxyAccount")}>{plan?.proxyAccountId || "—"}</Descriptions.Item>
              <Descriptions.Item label={t("systemAdmin.proxyGovernance.planModelVersion")}>{plan?.modelVersion || "—"}</Descriptions.Item>
            </Descriptions>
            <AppTable<ProxyGrantSource>
              columns={sourceColumns}
              dataSource={plan?.sources ?? []}
              loading={planLoading}
              locale={{ emptyText: t("systemAdmin.proxyGovernance.sourcesEmpty") }}
              pagination={false}
              rowKey={(item) => `${item.bindingType}:${item.bindingId}:${item.resourceType}:${item.resourceId}:${item.operation}`}
              scroll={{ x: 730 }}
              size="small"
            />
          </>
        )}
      </Drawer>
    </section>
  );
}
