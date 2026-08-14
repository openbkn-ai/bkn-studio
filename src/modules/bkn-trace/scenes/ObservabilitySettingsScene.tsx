/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Empty, message, Modal, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import { createArchive, getArchiveDownloadURL, getArchiveOverview, listArchiveJobs, listLogPolicies, listLogSources, retryArchiveCleanup, type ArchiveJob, type ArchiveKind, type ArchiveOverview, type LogPolicy, type LogSourceStatus } from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile } from "@/modules/bkn-trace/services/trace.service";

type StorageRow = { dataKind: string; description: string; key: string; retention?: number; status: "known" | "unknown" };

export function ObservabilitySettingsScene() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<LogSourceStatus[]>([]);
  const [policies, setPolicies] = useState<LogPolicy[]>([]);
	const [archives, setArchives] = useState<ArchiveOverview[]>([]);
	const [archiveJobs, setArchiveJobs] = useState<ArchiveJob[]>([]);
	const [archiveManage, setArchiveManage] = useState(false);
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
      setArchiveManage(profile.observabilityArchiveManage);
      const [sourceResult, policyResult, logArchiveResult, traceArchiveResult, logJobsResult, traceJobsResult] = await Promise.allSettled([
        profile.globalLogSearch ? listLogSources() : Promise.resolve([]),
        profile.logPolicyRead ? listLogPolicies() : Promise.resolve([]),
		profile.observabilityArchiveManage ? getArchiveOverview("log") : Promise.resolve<ArchiveOverview | undefined>(undefined),
		profile.observabilityArchiveManage ? getArchiveOverview("trace") : Promise.resolve<ArchiveOverview | undefined>(undefined),
		profile.observabilityArchiveManage ? listArchiveJobs("log") : Promise.resolve<ArchiveJob[]>([]),
		profile.observabilityArchiveManage ? listArchiveJobs("trace") : Promise.resolve<ArchiveJob[]>([]),
      ]);
      if (!active) return;
      if (sourceResult.status === "fulfilled") setSources(sourceResult.value);
      if (policyResult.status === "fulfilled") setPolicies(policyResult.value);
		const archiveData = [logArchiveResult, traceArchiveResult].flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
		setArchives(archiveData);
		setArchiveJobs([...((logJobsResult.status === "fulfilled") ? logJobsResult.value : []), ...((traceJobsResult.status === "fulfilled") ? traceJobsResult.value : [])]);
      if (sourceResult.status === "rejected" && policyResult.status === "rejected") setError(t("bknTrace.errors.queryFailed"));
      setLoading(false);
    }).catch(() => {
      if (active) { setError(t("bknTrace.errors.accessProfileFailed")); setLoading(false); }
    });
    return () => { active = false; };
  }, [t]);

  const overview = useMemo(() => {
    const healthy = sources.filter((source) => ["available", "healthy"].includes(source.status)).length;
    const unavailable = sources.filter((source) => ["unavailable", "error"].includes(source.status)).length;
    return { healthy, registered: sources.length, unavailable, unconfigured: Math.max(0, sources.length - healthy - unavailable) };
  }, [sources]);

  const sourceColumns: ColumnsType<LogSourceStatus> = [
    { dataIndex: "sourceId", key: "sourceId", title: t("bknTrace.settings.columns.source") },
    { key: "coverage", title: t("bknTrace.settings.columns.coverage"), render: (_, source) => <ClampedModules modules={source.coveredModules} /> },
    { dataIndex: "status", key: "status", title: t("bknTrace.settings.columns.status"), render: (value: string) => <Tag color={["available", "healthy"].includes(value) ? "green" : "orange"}>{t(`bknTrace.settings.status.${value}`)}</Tag> },
    { dataIndex: "reason", key: "reason", title: t("bknTrace.settings.columns.dataState"), render: (value?: string) => value || t("bknTrace.settings.noIssueReturned") },
  ];

  const storageRows = useMemo<StorageRow[]>(() => {
    const retention = (category: LogPolicy["category"]) => policies.find((policy) => policy.category === category)?.retentionDays;
    return [
      { dataKind: t("bknTrace.settings.storage.runtimeLogs"), description: t("bknTrace.settings.storage.defaultValue"), key: "runtime", retention: retention("runtime.system"), status: retention("runtime.system") === undefined ? "unknown" : "known" },
      { dataKind: t("bknTrace.settings.storage.auditLogs"), description: t("bknTrace.settings.storage.defaultValue"), key: "audit", retention: retention("audit.admin"), status: retention("audit.admin") === undefined ? "unknown" : "known" },
      { dataKind: t("bknTrace.settings.storage.traceIndex"), description: t("bknTrace.settings.storage.interfaceMissing"), key: "trace", status: "unknown" },
      { dataKind: t("bknTrace.settings.storage.interactionFacts"), description: t("bknTrace.settings.storage.interfaceMissing"), key: "interaction", status: "unknown" },
    ];
  }, [policies, t]);

  const storageColumns: ColumnsType<StorageRow> = [
    { dataIndex: "dataKind", key: "dataKind", title: t("bknTrace.settings.columns.dataKind") },
    { key: "retention", title: t("bknTrace.settings.columns.retention"), render: (_, row) => row.retention === undefined ? t("bknTrace.settings.notReturned") : `${row.retention} ${t("bknTrace.settings.days")}` },
    { dataIndex: "description", key: "description", title: t("bknTrace.settings.columns.description") },
    { dataIndex: "status", key: "status", title: t("bknTrace.settings.columns.status"), render: (value: StorageRow["status"]) => <Tag color={value === "known" ? "green" : "default"}>{t(`bknTrace.settings.status.${value}`)}</Tag> },
  ];

  if (loading) return <Spin />;
  if (denied) return <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;
  return <div className={styles.workspace}>
    <header className={styles.header}><div><Typography.Title level={3}>{t("bknTrace.settings.title")}</Typography.Title><Typography.Text type="secondary">{t("bknTrace.settings.description")}</Typography.Text></div></header>
    <Alert message={t("bknTrace.settings.readOnlyNotice")} showIcon type="info" />
    {error ? <Alert message={error} showIcon type="error" /> : null}

    <SettingsSection title={t("bknTrace.settings.overview")}>
      <div className={styles.metricGrid}>
        <Metric label={t("bknTrace.settings.metrics.registered")} value={overview.registered} />
        <Metric label={t("bknTrace.settings.metrics.healthy")} value={overview.healthy} />
        <Metric label={t("bknTrace.settings.metrics.unavailable")} value={overview.unavailable} />
        <Metric label={t("bknTrace.settings.metrics.unconfigured")} value={overview.unconfigured} />
        <Metric label={t("bknTrace.settings.metrics.updatedAt")} value={t("bknTrace.settings.notReturned")} />
      </div>
    </SettingsSection>

    <SettingsSection title={t("bknTrace.settings.sources")}>
      <Table columns={sourceColumns} dataSource={sources} pagination={false} rowKey="sourceId" tableLayout="fixed" />
    </SettingsSection>

    <SettingsSection title={t("bknTrace.settings.storageRetention")}>
      <div className={styles.storageLayout}>
        <Table columns={storageColumns} dataSource={storageRows} pagination={false} rowKey="key" tableLayout="fixed" />
        <div className={styles.storageSummary}><Typography.Text strong>{t("bknTrace.settings.storage.archiveTarget")}</Typography.Text><Typography.Text type="secondary">{t("bknTrace.settings.storage.archiveTargetUnavailable")}</Typography.Text></div>
      </div>
    </SettingsSection>

    <SettingsSection title={t("bknTrace.settings.archive.title")}>
		<div className={styles.archiveGrid}>
			<ArchivePanel archive={archives.find((archive) => archive.kind === "log")} canManage={archiveManage} kind="log" onCreated={(kind) => refreshArchive(kind, setArchives, setArchiveJobs)} />
			<ArchivePanel archive={archives.find((archive) => archive.kind === "trace")} canManage={archiveManage} kind="trace" onCreated={(kind) => refreshArchive(kind, setArchives, setArchiveJobs)} />
		</div>
    </SettingsSection>

    <SettingsSection title={t("bknTrace.settings.recentArchives")}>
		{archiveJobs.length ? <Table pagination={false} rowKey="id" dataSource={archiveJobs} columns={[
			{ title: t("bknTrace.settings.archive.jobKind"), dataIndex: "kind", key: "kind", render: (kind: ArchiveKind) => t(`bknTrace.settings.archive.kinds.${kind}`) },
			{ title: t("bknTrace.settings.archive.jobRange"), key: "range", render: (_, job) => `${job.range.from || "-"} ~ ${job.range.to}` },
			{ title: t("bknTrace.settings.archive.jobCount"), dataIndex: "candidateCount", key: "candidateCount" },
			{ title: t("bknTrace.settings.archive.jobStatus"), dataIndex: "status", key: "status", render: (status: ArchiveJob["status"]) => t(`bknTrace.settings.archive.statuses.${status}`) },
			{ title: t("bknTrace.settings.archive.jobAction"), key: "action", render: (_, job) => <>
				{(job.status === "completed" || job.status === "cleanup_incomplete") ? <Button size="small" onClick={() => { void getArchiveDownloadURL(job.id).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch(() => message.error(t("bknTrace.settings.archive.actionFailed"))); }}>{t("bknTrace.settings.archive.download")}</Button> : null}
				{job.status === "cleanup_incomplete" ? <Button size="small" onClick={() => { void retryArchiveCleanup(job.id).then(() => refreshArchive(job.kind, setArchives, setArchiveJobs)).catch(() => message.error(t("bknTrace.settings.archive.actionFailed"))); }}>{t("bknTrace.settings.archive.retryCleanup")}</Button> : null}
			</> },
		]} /> : <Empty description={t("bknTrace.settings.archive.noHistory")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    </SettingsSection>
  </div>;
}

async function refreshArchive(kind: ArchiveKind, setArchives: (value: ArchiveOverview[] | ((previous: ArchiveOverview[]) => ArchiveOverview[])) => void, setJobs: (value: ArchiveJob[] | ((previous: ArchiveJob[]) => ArchiveJob[])) => void) {
	const latest = await getArchiveOverview(kind);
	setArchives((previous) => [...previous.filter((item) => item.kind !== kind), latest]);
	const jobs = await listArchiveJobs(kind);
	setJobs((previous) => [...previous.filter((job) => job.kind !== kind), ...jobs]);
}

function ArchivePanel({ archive, canManage, kind, onCreated }: { archive?: ArchiveOverview; canManage: boolean; kind: ArchiveKind; onCreated: (kind: ArchiveKind) => Promise<void> }) {
	const { t } = useTranslation();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string>();
	const label = kind === "log" ? t("bknTrace.settings.archive.logTitle") : t("bknTrace.settings.archive.traceTitle");
	const rule = kind === "log" ? t("bknTrace.settings.archive.logRule") : t("bknTrace.settings.archive.traceRule");
	const start = () => { setCreateError(undefined); setConfirmOpen(true); };
	const confirm = async () => {
		setCreating(true);
		try {
			await createArchive(kind);
			await onCreated(kind);
			setConfirmOpen(false);
		} catch {
			setCreateError(t("bknTrace.errors.queryFailed"));
		} finally {
			setCreating(false);
		}
	};
	return <div className={styles.archivePanel}>
		<div><Typography.Text strong>{label}</Typography.Text><Typography.Paragraph type="secondary">{rule}</Typography.Paragraph>{archive ? <Typography.Text type="secondary">{t("bknTrace.settings.archive.candidates", { count: archive.candidateCount, cutoff: archive.cutoffAt })}</Typography.Text> : <Typography.Text type="secondary">{t(canManage ? "bknTrace.settings.archive.unavailable" : "bknTrace.settings.archive.permissionDenied")}</Typography.Text>}</div>
		<Button disabled={!canManage || !archive || archive.candidateCount === 0 || archive.storageStatus !== "ready"} onClick={start} type="primary">{t("bknTrace.settings.archive.action")}</Button>
		<Modal cancelText={t("common.cancel")} confirmLoading={creating} okText={t("bknTrace.settings.archive.action")} onCancel={() => setConfirmOpen(false)} onOk={() => void confirm()} open={confirmOpen} title={t("bknTrace.settings.archive.confirmTitle")}>
			<Typography.Paragraph>{t("bknTrace.settings.archive.confirm", { rule })}</Typography.Paragraph>
			{createError ? <Alert message={createError} showIcon type="error" /> : null}
		</Modal>
	</div>;
}

function SettingsSection({ children, title }: { children: ReactNode; title: string }) {
  return <section className={styles.section}><Typography.Title level={4}>{title}</Typography.Title>{children}</section>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className={styles.metric}><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong>{value}</Typography.Text></div>;
}

function ClampedModules({ modules }: { modules: string[] }) {
  const { t } = useTranslation();
  const value = modules.map((module) => t(`bknTrace.logs.modules.${module}`, { defaultValue: module })).join("、");
  return <Typography.Paragraph ellipsis={{ rows: 2, tooltip: value }}>{value || t("bknTrace.settings.notReturned")}</Typography.Paragraph>;
}
