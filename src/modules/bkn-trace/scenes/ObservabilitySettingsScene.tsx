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

import { useAppServices } from "@/framework/context/use-app-services";
import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import { BUSINESS_MODULES, createArchive, downloadArchive, getArchiveOverview, listArchiveJobs, listLogPolicies, listLogSources, retryArchiveCleanup, type ArchiveJob, type ArchiveKind, type ArchiveOverview, type BusinessModule, type LogPolicy, type LogSourceStatus } from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile } from "@/modules/bkn-trace/services/trace.service";

type StorageRow = { dataKind: string; description: string; key: string; retention?: number; status: "known" | "unknown" };
type SourceLoadState = "loaded" | "not_requested" | "unavailable";
type ModuleSourceRow = { module: BusinessModule; reason?: string; sourceIds: string[]; status: "healthy" | "not_integrated" | "unavailable" | "unknown" };

export function ObservabilitySettingsScene() {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
  const superAdmin = runtimeConfig.currentUser.isSuperAdmin;
  const [sources, setSources] = useState<LogSourceStatus[]>([]);
  const [sourceLoadState, setSourceLoadState] = useState<SourceLoadState>("not_requested");
  const [policies, setPolicies] = useState<LogPolicy[]>([]);
	const [archives, setArchives] = useState<ArchiveOverview[]>([]);
	const [archiveJobs, setArchiveJobs] = useState<ArchiveJob[]>([]);
	const [archiveManage, setArchiveManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!superAdmin) {
      setDenied(true);
      setLoading(false);
      return;
    }
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
      if (sourceResult.status === "fulfilled") {
        setSources(sourceResult.value);
        setSourceLoadState(profile.globalLogSearch ? "loaded" : "not_requested");
      } else {
        setSourceLoadState("unavailable");
      }
      if (policyResult.status === "fulfilled") setPolicies(policyResult.value);
		const archiveData = [logArchiveResult, traceArchiveResult].flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
		setArchives(archiveData);
		setArchiveJobs([...((logJobsResult.status === "fulfilled") ? logJobsResult.value : []), ...((traceJobsResult.status === "fulfilled") ? traceJobsResult.value : [])]);
      if (sourceResult.status === "rejected" || policyResult.status === "rejected") setError(t("bknTrace.errors.queryFailed"));
      setLoading(false);
    }).catch(() => {
      if (active) { setError(t("bknTrace.errors.accessProfileFailed")); setLoading(false); }
    });
    return () => { active = false; };
  }, [superAdmin, t]);

  const moduleSources = useMemo<ModuleSourceRow[]>(() => BUSINESS_MODULES.map((module) => {
    if (sourceLoadState === "not_requested") return { module, reason: "source_not_requested", sourceIds: [], status: "unknown" };
    if (sourceLoadState === "unavailable") return { module, reason: "source_query_failed", sourceIds: [], status: "unavailable" };
    const matching = sources.filter((source) => source.coveredModules.includes(module));
    if (!matching.length) return { module, sourceIds: [], status: "not_integrated" };
    const unavailable = matching.find((source) => !["available", "healthy", "not_integrated"].includes(source.status));
    if (unavailable) {
      return { module, reason: unavailable.reason, sourceIds: matching.map((source) => source.sourceId), status: "unavailable" };
    }
    if (matching.some((source) => ["available", "healthy"].includes(source.status))) {
      return { module, reason: matching.map((source) => source.reason).find(Boolean), sourceIds: matching.map((source) => source.sourceId), status: "healthy" };
    }
    return { module, reason: matching.map((source) => source.reason).find(Boolean), sourceIds: matching.map((source) => source.sourceId), status: "not_integrated" };
  }), [sourceLoadState, sources]);

  const excludedOperationAuditSources = useMemo(() => sources.filter((source) => !source.coveredModules.some((module) => BUSINESS_MODULES.includes(module as BusinessModule))), [sources]);

  const overview = useMemo(() => {
    const healthy = moduleSources.filter((source) => source.status === "healthy").length;
    const unavailable = moduleSources.filter((source) => source.status === "unavailable").length;
    return { healthy, registered: moduleSources.length, unavailable, unconfigured: moduleSources.filter((source) => source.status === "not_integrated").length };
  }, [moduleSources]);

  const sourceColumns: ColumnsType<ModuleSourceRow> = [
    { dataIndex: "module", key: "module", title: t("bknTrace.settings.columns.module"), render: (module: BusinessModule) => t(`bknTrace.logs.modules.${module}`) },
    { dataIndex: "sourceIds", key: "sourceIds", title: t("bknTrace.settings.columns.source"), render: (sourceIds: string[], row) => sourceIds.length ? sourceIds.map((sourceId) => t(`bknTrace.settings.sourceLabels.${sourceId}`, { defaultValue: sourceId })).join("、") : t(row.status === "not_integrated" ? "bknTrace.settings.sourceNotIntegrated" : "bknTrace.settings.sourceNotReturned") },
    { dataIndex: "status", key: "status", title: t("bknTrace.settings.columns.status"), render: (value: ModuleSourceRow["status"]) => <Tag color={value === "healthy" ? "green" : value === "unavailable" ? "orange" : "default"}>{t(`bknTrace.settings.status.${value}`)}</Tag> },
    { dataIndex: "reason", key: "reason", title: t("bknTrace.settings.columns.dataState"), render: (value?: string) => sourceStateLabel(value, t) },
  ];

  const storageRows = useMemo<StorageRow[]>(() => {
    const retention = (category: LogPolicy["category"]) => policies.find((policy) => policy.category === category)?.retentionDays;
    return [
      { dataKind: t("bknTrace.settings.storage.runtimeLogs"), description: t("bknTrace.settings.storage.defaultValue"), key: "runtime", retention: retention("runtime.system"), status: retention("runtime.system") === undefined ? "unknown" : "known" },
      { dataKind: t("bknTrace.settings.storage.auditLogs"), description: t("bknTrace.settings.storage.defaultValue"), key: "audit", retention: retention("audit.admin"), status: retention("audit.admin") === undefined ? "unknown" : "known" },
    ];
  }, [policies, t]);

  const storageColumns: ColumnsType<StorageRow> = [
    { dataIndex: "dataKind", key: "dataKind", title: t("bknTrace.settings.columns.dataKind") },
    { key: "retention", title: t("bknTrace.settings.columns.retention"), render: (_, row) => row.retention === undefined ? t("bknTrace.settings.notReturned") : `${row.retention} ${t("bknTrace.settings.days")}` },
    { dataIndex: "description", key: "description", title: t("bknTrace.settings.columns.description") },
    { dataIndex: "status", key: "status", title: t("bknTrace.settings.columns.status"), render: (value: StorageRow["status"]) => <Tag color={value === "known" ? "green" : "default"}>{t(`bknTrace.settings.status.${value}`)}</Tag> },
  ];

  if (!superAdmin || loading) return superAdmin ? <Spin /> : <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;
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
      <Table columns={sourceColumns} dataSource={moduleSources} pagination={false} rowKey="module" tableLayout="fixed" />
      {excludedOperationAuditSources.length ? <Typography.Paragraph type="secondary">{t("bknTrace.settings.excludedOperationAuditSources", { count: excludedOperationAuditSources.length })}</Typography.Paragraph> : null}
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
				{(job.status === "completed" || job.status === "cleanup_incomplete") ? <Button size="small" onClick={() => { void downloadArchiveBundle(job).catch(() => message.error(t("bknTrace.settings.archive.actionFailed"))); }}>{t("bknTrace.settings.archive.download")}</Button> : null}
				{job.status === "cleanup_incomplete" ? <Button size="small" onClick={() => { void retryArchiveCleanup(job.id).then(() => refreshArchive(job.kind, setArchives, setArchiveJobs)).catch(() => message.error(t("bknTrace.settings.archive.actionFailed"))); }}>{t("bknTrace.settings.archive.retryCleanup")}</Button> : null}
			</> },
		]} /> : <Empty description={t("bknTrace.settings.archive.noHistory")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    </SettingsSection>
  </div>;
}

async function downloadArchiveBundle(job: ArchiveJob) {
	const { content, fileName } = await downloadArchive(job.id);
	const url = URL.createObjectURL(content);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName || `archive-${job.kind}-${job.id}.jsonl`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

function sourceStateLabel(reason: string | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!reason) return t("bknTrace.settings.noIssueReturned");
  return t(`bknTrace.settings.sourceState.${reason}`, { defaultValue: reason });
}
