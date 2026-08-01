/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import { listLogPolicies, listLogSources, type LogPolicy, type LogSourceStatus } from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile } from "@/modules/bkn-trace/services/trace.service";

export function ObservabilitySettingsScene() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<LogSourceStatus[]>([]);
  const [policies, setPolicies] = useState<LogPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getAccessProfile().then(async (profile) => {
      if (!profile.globalLogSearch && !profile.logPolicyRead) {
        if (active) { setDenied(true); setLoading(false); }
        return;
      }
      const [sourceResult, policyResult] = await Promise.allSettled([
        profile.globalLogSearch ? listLogSources() : Promise.resolve([]),
        profile.logPolicyRead ? listLogPolicies() : Promise.resolve([]),
      ]);
      if (!active) return;
      if (sourceResult.status === "fulfilled") setSources(sourceResult.value);
      if (policyResult.status === "fulfilled") setPolicies(policyResult.value);
      if (sourceResult.status === "rejected" && policyResult.status === "rejected") setError(t("bknTrace.errors.queryFailed"));
      setLoading(false);
    }).catch(() => {
      if (active) { setError(t("bknTrace.errors.accessProfileFailed")); setLoading(false); }
    });
    return () => { active = false; };
  }, [t]);

  const sourceColumns: ColumnsType<LogSourceStatus> = [
    { dataIndex: "sourceId", key: "sourceId", title: t("bknTrace.settings.columns.source") },
    { dataIndex: "collectionMethod", key: "collectionMethod", title: t("bknTrace.settings.columns.collection") },
    { dataIndex: "coveredModules", key: "coveredModules", title: t("bknTrace.settings.columns.coverage"), render: (value: string[]) => value.join(", ") || "-" },
    { dataIndex: "status", key: "status", title: t("bknTrace.settings.columns.status"), render: (value: string) => <Tag color={value === "available" ? "green" : "orange"}>{value}</Tag> },
  ];
  const policyColumns: ColumnsType<LogPolicy> = [
    { dataIndex: "category", key: "category", title: t("bknTrace.settings.columns.category") },
    { dataIndex: "policyKind", key: "policyKind", title: t("bknTrace.settings.columns.policyKind") },
    { dataIndex: "retentionDays", key: "retentionDays", title: t("bknTrace.settings.columns.retention"), render: (value: number) => `${value} ${t("bknTrace.settings.days")}` },
    { dataIndex: "policyRevision", key: "policyRevision", title: t("bknTrace.settings.columns.revision") },
  ];

  if (loading) return <Spin />;
  if (denied) return <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;
  return <div className={styles.workspace}>
    <header className={styles.header}><div><Typography.Title level={3}>{t("bknTrace.settings.title")}</Typography.Title><Typography.Text type="secondary">{t("bknTrace.settings.description")}</Typography.Text></div></header>
    <Alert message={t("bknTrace.settings.readOnlyNotice")} showIcon type="info" />
    {error ? <Alert message={error} showIcon type="error" /> : null}
    <section className={styles.section}><Typography.Title level={4}>{t("bknTrace.settings.sources")}</Typography.Title><Table columns={sourceColumns} dataSource={sources} pagination={false} rowKey="sourceId" /></section>
    <section className={styles.section}><Typography.Title level={4}>{t("bknTrace.settings.policies")}</Typography.Title><Table columns={policyColumns} dataSource={policies} pagination={false} rowKey={(record) => `${record.policyRevision}:${record.category}`} /></section>
  </div>;
}
