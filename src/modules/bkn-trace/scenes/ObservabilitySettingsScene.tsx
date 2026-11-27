/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Modal,
  Progress,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import axios from "axios";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { formatDateTime, formatFileSize, formatNumber } from "@/framework/i18n/format";
import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import {
  BUSINESS_MODULES,
  createArchive,
  downloadArchive,
  getArchiveOverview,
  getArchiveRunResult,
  isArchiveRunActive,
  listArchiveJobs,
  listRetainedInteractions,
  listLogPolicies,
  listLogSources,
  retryArchiveCleanup,
  type ArchiveJob,
  type ArchiveKind,
  type ArchiveOverview,
  type ArchiveRun,
  type ArchiveRunResult,
  type BusinessModule,
  type RetainedInteraction,
  type LogPolicy,
  type LogSourceStatus,
} from "@/modules/bkn-trace/services/observability.service";
import {
  changeTraceEvidenceConfiguration,
  getAccessProfile,
  getTraceEvidenceConfiguration,
  getTraceEvidenceOperation,
  type CapturePolicyConfiguration,
  type CapturePolicyOperation,
} from "@/modules/bkn-trace/services/trace.service";

type StorageRow = {
  dataKind: string;
  description: string;
  key: string;
  retention?: number;
  status: "known" | "unknown";
};
type SourceLoadState = "loaded" | "not_requested" | "unavailable";
type ModuleSourceRow = {
  module: BusinessModule;
  sourceIds: string[];
  status: "integrated" | "not_integrated";
};

const SHARED_LOG_SOURCE_ID = "otel-runtime";
const MANAGEMENT_AUDIT_SOURCE_ID = "audit-ledger";

export function ObservabilitySettingsScene() {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [sources, setSources] = useState<LogSourceStatus[]>([]);
  const [sourceLoadState, setSourceLoadState] = useState<SourceLoadState>("not_requested");
  const [policies, setPolicies] = useState<LogPolicy[]>([]);
  const [archives, setArchives] = useState<ArchiveOverview[]>([]);
  const [archiveJobs, setArchiveJobs] = useState<ArchiveJob[]>([]);
  const [archiveHistoryUnavailable, setArchiveHistoryUnavailable] = useState<ArchiveKind[]>([]);
  const [refreshingArchives, setRefreshingArchives] = useState(false);
  const [retryingJob, setRetryingJob] = useState<string>();
  const [archiveManage, setArchiveManage] = useState(false);
  const [capturePolicy, setCapturePolicy] = useState<CapturePolicyConfiguration>();
  const [capturePolicyOperation, setCapturePolicyOperation] = useState<CapturePolicyOperation>();
  const [capturePolicyUnavailable, setCapturePolicyUnavailable] = useState(false);
  const [capturePolicyOperationUnavailable, setCapturePolicyOperationUnavailable] = useState(false);
  const [capturePolicyWrite, setCapturePolicyWrite] = useState(false);
  const [pollingOperationId, setPollingOperationId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getAccessProfile()
      .then(async (profile) => {
        if (
          !profile.globalLogSearch &&
          !profile.logPolicyRead &&
          !profile.traceEvidenceConfigurationRead
        ) {
          if (active) {
            setDenied(true);
            setLoading(false);
          }
          return;
        }
        setArchiveManage(profile.observabilityArchiveManage);
        setCapturePolicyWrite(profile.traceEvidenceConfigurationWrite);
        const [
          sourceResult,
          policyResult,
          logArchiveResult,
          traceArchiveResult,
          logJobsResult,
          traceJobsResult,
          capturePolicyResult,
        ] = await Promise.allSettled([
          profile.globalLogSearch ? listLogSources() : Promise.resolve([]),
          profile.logPolicyRead ? listLogPolicies() : Promise.resolve([]),
          profile.observabilityArchiveManage
            ? getArchiveOverview("log")
            : Promise.resolve<ArchiveOverview | undefined>(undefined),
          profile.observabilityArchiveManage
            ? getArchiveOverview("trace")
            : Promise.resolve<ArchiveOverview | undefined>(undefined),
          profile.observabilityArchiveManage
            ? listArchiveJobs("log")
            : Promise.resolve<ArchiveJob[]>([]),
          profile.observabilityArchiveManage
            ? listArchiveJobs("trace")
            : Promise.resolve<ArchiveJob[]>([]),
          profile.traceEvidenceConfigurationRead
            ? getTraceEvidenceConfiguration()
            : Promise.resolve<CapturePolicyConfiguration | undefined>(undefined),
        ]);
        if (!active) return;
        if (sourceResult.status === "fulfilled") {
          setSources(sourceResult.value);
          setSourceLoadState(profile.globalLogSearch ? "loaded" : "not_requested");
        } else {
          setSourceLoadState("unavailable");
        }
        if (policyResult.status === "fulfilled") setPolicies(policyResult.value);
        const archiveData = [logArchiveResult, traceArchiveResult].flatMap((result) =>
          result.status === "fulfilled" && result.value ? [result.value] : [],
        );
        setArchives(archiveData);
        setArchiveHistoryUnavailable([
          ...(logJobsResult.status === "rejected" ? ["log" as const] : []),
          ...(traceJobsResult.status === "rejected" ? ["trace" as const] : []),
        ]);
        setArchiveJobs([
          ...(logJobsResult.status === "fulfilled" ? logJobsResult.value : []),
          ...(traceJobsResult.status === "fulfilled" ? traceJobsResult.value : []),
        ]);
        if (capturePolicyResult.status === "fulfilled" && capturePolicyResult.value) {
          setCapturePolicy(capturePolicyResult.value);
          setCapturePolicyUnavailable(false);
          if (capturePolicyResult.value.activeOperationId) {
            setPollingOperationId(capturePolicyResult.value.activeOperationId);
            const operationResult = await Promise.allSettled([
              getTraceEvidenceOperation(capturePolicyResult.value.activeOperationId),
            ]);
            if (!active) return;
            if (operationResult[0]?.status === "fulfilled") {
              setCapturePolicyOperation(operationResult[0].value);
              if (isSettledCapturePolicy(capturePolicyResult.value, operationResult[0].value))
                setPollingOperationId(undefined);
              setCapturePolicyOperationUnavailable(false);
            } else {
              setCapturePolicyOperation(undefined);
              setCapturePolicyOperationUnavailable(true);
            }
          } else {
            setCapturePolicyOperation(undefined);
            setCapturePolicyOperationUnavailable(false);
          }
        } else if (profile.traceEvidenceConfigurationRead) {
          setCapturePolicy(undefined);
          setCapturePolicyOperation(undefined);
          setCapturePolicyUnavailable(true);
          setCapturePolicyOperationUnavailable(false);
        }
        if (sourceResult.status === "rejected" || policyResult.status === "rejected")
          setError(t("bknTrace.errors.queryFailed"));
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(t("bknTrace.errors.accessProfileFailed"));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  // A background archive keeps running after the page closes; while one is
  // active, refresh its overview and job list so progress stays current.
  const activeArchiveKinds = archives
    .filter((archive) => isArchiveRunActive(archive.currentRun))
    .map((archive) => archive.kind)
    .join(",");
  useEffect(() => {
    if (!activeArchiveKinds) return;
    const timer = window.setInterval(() => {
      for (const kind of activeArchiveKinds.split(",") as ArchiveKind[]) {
        void refreshArchive(kind, setArchives, setArchiveJobs, setArchiveHistoryUnavailable);
      }
    }, ARCHIVE_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeArchiveKinds]);

  useEffect(() => {
    if (!pollingOperationId) return;
    let active = true;
    let timer: number;
    let consecutiveFailures = 0;
    const poll = async () => {
      let terminal = false;
      const [operationResult, configurationResult] = await Promise.allSettled([
        getTraceEvidenceOperation(pollingOperationId),
        getTraceEvidenceConfiguration(),
      ]);
      if (!active) return;
      if (operationResult.status === "fulfilled") {
        setCapturePolicyOperation(operationResult.value);
        setCapturePolicyOperationUnavailable(false);
      } else {
        setCapturePolicyOperation(undefined);
        setCapturePolicyOperationUnavailable(true);
      }
      if (configurationResult.status === "fulfilled") {
        setCapturePolicy(configurationResult.value);
        setCapturePolicyUnavailable(false);
        terminal =
          operationResult.status === "fulfilled"
            ? isSettledCapturePolicy(configurationResult.value, operationResult.value)
            : !configurationResult.value.activeOperationId;
      } else {
        setCapturePolicyUnavailable(true);
      }
      consecutiveFailures =
        operationResult.status === "rejected" || configurationResult.status === "rejected"
          ? consecutiveFailures + 1
          : 0;
      if (terminal || consecutiveFailures >= 5) setPollingOperationId(undefined);
      else timer = window.setTimeout(() => void poll(), 2000);
    };
    timer = window.setTimeout(() => void poll(), 2000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pollingOperationId]);

  const moduleSources = useMemo<ModuleSourceRow[]>(
    () =>
      sourceLoadState === "loaded"
        ? BUSINESS_MODULES.map((module) => {
            const directSourceIds = sources
              .filter(
                (source) =>
                  source.coveredModules.includes(module) && source.status !== "not_integrated",
              )
              .map((source) => source.sourceId);
            const sharedSourceIds =
              module === "observability"
                ? []
                : sources
                    .filter(
                      (source) =>
                        source.sourceId === SHARED_LOG_SOURCE_ID &&
                        source.status !== "not_integrated",
                    )
                    .map((source) => source.sourceId);
            const maintenanceSourceIds =
              module === "observability"
                ? sources
                    .filter(
                      (source) =>
                        source.sourceId === MANAGEMENT_AUDIT_SOURCE_ID &&
                        source.status !== "not_integrated",
                    )
                    .map((source) => source.sourceId)
                : [];
            const sourceIds = [
              ...new Set([...directSourceIds, ...sharedSourceIds, ...maintenanceSourceIds]),
            ];
            return {
              module,
              sourceIds,
              status: sourceIds.length ? "integrated" : "not_integrated",
            };
          })
        : [],
    [sourceLoadState, sources],
  );

  const overview = useMemo(
    () => ({
      integrated: moduleSources.filter((source) => source.status === "integrated").length,
      notIntegrated: moduleSources.filter((source) => source.status === "not_integrated").length,
    }),
    [moduleSources],
  );

  const sourceColumns: ColumnsType<ModuleSourceRow> = [
    {
      dataIndex: "module",
      key: "module",
      title: t("bknTrace.settings.columns.module"),
      render: (module: BusinessModule) => t(`bknTrace.logs.modules.${module}`),
    },
    {
      dataIndex: "sourceIds",
      key: "sourceIds",
      title: t("bknTrace.settings.independentQuerySource"),
      render: (sourceIds: string[]) =>
        sourceIds.length
          ? sourceIds
              .map((sourceId) =>
                t(`bknTrace.settings.sourceLabels.${sourceId}`, { defaultValue: sourceId }),
              )
              .join("、")
          : t("bknTrace.settings.sourceNotIntegrated"),
    },
    {
      dataIndex: "status",
      key: "status",
      title: t("bknTrace.settings.integrationStatus"),
      render: (value: ModuleSourceRow["status"]) => (
        <Tag color={value === "integrated" ? "green" : "default"}>
          {t(`bknTrace.settings.integration.${value}`)}
        </Tag>
      ),
    },
  ];

  const storageRows = useMemo<StorageRow[]>(() => {
    const retention = (category: LogPolicy["category"]) =>
      policies.find((policy) => policy.category === category)?.retentionDays;
    return [
      {
        dataKind: t("bknTrace.settings.storage.runtimeLogs"),
        description: t("bknTrace.settings.storage.defaultValue"),
        key: "runtime",
        retention: retention("runtime.business"),
        status: retention("runtime.business") === undefined ? "unknown" : "known",
      },
      {
        dataKind: t("bknTrace.settings.storage.auditLogs"),
        description: t("bknTrace.settings.storage.defaultValue"),
        key: "audit",
        retention: retention("audit.admin"),
        status: retention("audit.admin") === undefined ? "unknown" : "known",
      },
    ];
  }, [policies, t]);

  const storageColumns: ColumnsType<StorageRow> = [
    { dataIndex: "dataKind", key: "dataKind", title: t("bknTrace.settings.columns.dataKind") },
    {
      key: "retention",
      title: t("bknTrace.settings.columns.retention"),
      render: (_, row) =>
        row.retention === undefined
          ? t("bknTrace.settings.notReturned")
          : `${row.retention} ${t("bknTrace.settings.days")}`,
    },
    {
      dataIndex: "description",
      key: "description",
      title: t("bknTrace.settings.columns.description"),
    },
    {
      dataIndex: "status",
      key: "status",
      title: t("bknTrace.settings.columns.status"),
      render: (value: StorageRow["status"]) => (
        <Tag color={value === "known" ? "green" : "default"}>
          {t(`bknTrace.settings.status.${value}`)}
        </Tag>
      ),
    },
  ];

  if (loading) return <Spin />;
  if (denied) return <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <Typography.Title level={3}>{t("bknTrace.settings.title")}</Typography.Title>
          <Typography.Text type="secondary">{t("bknTrace.settings.description")}</Typography.Text>
        </div>
      </header>
      {error ? <Alert message={error} showIcon type="error" /> : null}

      {capturePolicy || capturePolicyUnavailable ? (
        <CapturePolicySection
          configuration={capturePolicy}
          operation={capturePolicyOperation}
          operationUnavailable={capturePolicyOperationUnavailable}
          unavailable={capturePolicyUnavailable}
          canWrite={capturePolicyWrite}
          onChange={async (desiredState, expectedRevision) => {
            const configuration = await changeTraceEvidenceConfiguration(
              desiredState,
              expectedRevision,
            );
            setCapturePolicy(configuration);
            setCapturePolicyOperation(undefined);
            setCapturePolicyOperationUnavailable(false);
            setPollingOperationId(configuration.activeOperationId);
          }}
        />
      ) : null}

      {sourceLoadState === "loaded" ? (
        <>
          <SettingsSection title={t("bknTrace.settings.overview")}>
            <div className={styles.metricGrid}>
              <Metric
                label={t("bknTrace.settings.metrics.integrated")}
                value={overview.integrated}
              />
              <Metric
                label={t("bknTrace.settings.metrics.notIntegrated")}
                value={overview.notIntegrated}
              />
            </div>
          </SettingsSection>

          <SettingsSection title={t("bknTrace.settings.sources")}>
            <Table
              columns={sourceColumns}
              dataSource={moduleSources}
              pagination={false}
              rowKey="module"
              tableLayout="fixed"
            />
          </SettingsSection>
        </>
      ) : null}

      <SettingsSection title={t("bknTrace.settings.storageRetention")}>
        <div className={styles.storageLayout}>
          <Table
            columns={storageColumns}
            dataSource={storageRows}
            pagination={false}
            rowKey="key"
            tableLayout="fixed"
          />
          <div className={styles.storageSummary}>
            <Typography.Text strong>{t("bknTrace.settings.storage.archiveTarget")}</Typography.Text>
            <Typography.Text type="secondary">
              {t("bknTrace.settings.storage.archiveTargetUnavailable")}
            </Typography.Text>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t("bknTrace.settings.archive.title")}>
        <div className={styles.archiveGrid}>
          <ArchivePanel
            archive={archives.find((archive) => archive.kind === "log")}
            canManage={archiveManage}
            blockedByCleanup={archiveJobs.some(
              (job) => job.kind === "log" && job.status === "cleanup_incomplete",
            )}
            historyUnavailable={archiveHistoryUnavailable.includes("log")}
            kind="log"
            onSettled={(kind) =>
              refreshArchive(kind, setArchives, setArchiveJobs, setArchiveHistoryUnavailable)
            }
          />
          <ArchivePanel
            archive={archives.find((archive) => archive.kind === "trace")}
            canManage={archiveManage}
            blockedByCleanup={archiveJobs.some(
              (job) => job.kind === "trace" && job.status === "cleanup_incomplete",
            )}
            historyUnavailable={archiveHistoryUnavailable.includes("trace")}
            kind="trace"
            onSettled={(kind) =>
              refreshArchive(kind, setArchives, setArchiveJobs, setArchiveHistoryUnavailable)
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("bknTrace.settings.recentArchives")}>
        {archiveManage ? (
          <Button
            loading={refreshingArchives}
            onClick={() => {
              setRefreshingArchives(true);
              void Promise.allSettled(
                (["log", "trace"] as const).map((kind) =>
                  refreshArchive(kind, setArchives, setArchiveJobs, setArchiveHistoryUnavailable),
                ),
              ).finally(() => setRefreshingArchives(false));
            }}
          >
            {t("bknTrace.settings.archive.refresh")}
          </Button>
        ) : null}
        {archiveHistoryUnavailable.map((kind) => (
          <Alert
            key={kind}
            type="warning"
            showIcon
            message={t("bknTrace.settings.archive.historyUnavailable", {
              kind: t(`bknTrace.settings.archive.kinds.${kind}`),
            })}
          />
        ))}
        {archiveJobs.length ? (
          <Table
            pagination={false}
            rowKey="id"
            dataSource={[...archiveJobs].sort(
              (left, right) =>
                Number(archiveNeedsAttention(right)) - Number(archiveNeedsAttention(left)),
            )}
            columns={[
              {
                title: t("bknTrace.settings.archive.jobKind"),
                dataIndex: "kind",
                key: "kind",
                width: 96,
                render: (kind: ArchiveKind) => t(`bknTrace.settings.archive.kinds.${kind}`),
              },
              {
                title: t("bknTrace.settings.archive.jobRange"),
                key: "range",
                render: (_, job) => `${job.range.from || "-"} ~ ${job.range.to}`,
              },
              {
                title: t("bknTrace.settings.archive.jobCount"),
                dataIndex: "candidateCount",
                key: "candidateCount",
                width: 100,
              },
              {
                title: t("bknTrace.settings.archive.jobStatus"),
                dataIndex: "status",
                key: "status",
                render: (_: ArchiveJob["status"], job) => <ArchiveJobStatus job={job} />,
              },
              {
                title: t("bknTrace.settings.archive.jobAction"),
                key: "action",
                width: 140,
                render: (_, job) => (
                  <>
                    {job.status === "completed" || job.status === "cleanup_incomplete" ? (
                      <Button
                        size="small"
                        onClick={() => {
                          void downloadArchiveBundle(job).catch(() =>
                            message.error(t("bknTrace.settings.archive.actionFailed")),
                          );
                        }}
                      >
                        {t("bknTrace.settings.archive.download")}
                      </Button>
                    ) : null}
                    {job.status === "cleanup_incomplete" && !job.batchProgress?.blocked ? (
                      <Button
                        size="small"
                        loading={retryingJob === job.id}
                        disabled={
                          Boolean(retryingJob) ||
                          archiveHistoryUnavailable.includes(job.kind) ||
                          isArchiveRunActive(
                            archives.find((archive) => archive.kind === job.kind)?.currentRun,
                          )
                        }
                        onClick={() => {
                          setRetryingJob(job.id);
                          void retryArchiveCleanup(job.id)
                            .catch(() =>
                              message.error(t("bknTrace.settings.archive.actionUnconfirmed")),
                            )
                            .finally(async () => {
                              await refreshArchive(
                                job.kind,
                                setArchives,
                                setArchiveJobs,
                                setArchiveHistoryUnavailable,
                              );
                              setRetryingJob(undefined);
                            });
                        }}
                      >
                        {t("bknTrace.settings.archive.retryCleanup")}
                      </Button>
                    ) : null}
                  </>
                ),
              },
            ]}
          />
        ) : archiveHistoryUnavailable.length === 0 ? (
          <Empty
            description={t("bknTrace.settings.archive.noHistory")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : null}
      </SettingsSection>
    </div>
  );
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

async function refreshArchive(
  kind: ArchiveKind,
  setArchives: (
    value: ArchiveOverview[] | ((previous: ArchiveOverview[]) => ArchiveOverview[]),
  ) => void,
  setJobs: (value: ArchiveJob[] | ((previous: ArchiveJob[]) => ArchiveJob[])) => void,
  setUnavailable: (value: ArchiveKind[] | ((previous: ArchiveKind[]) => ArchiveKind[])) => void,
) {
  const [overview, jobs] = await Promise.allSettled([
    getArchiveOverview(kind),
    listArchiveJobs(kind),
  ]);
  setArchives((previous) => [
    ...previous.filter((item) => item.kind !== kind),
    ...(overview.status === "fulfilled" ? [overview.value] : []),
  ]);
  setUnavailable((previous) => [
    ...previous.filter((item) => item !== kind),
    ...(jobs.status === "rejected" ? [kind] : []),
  ]);
  if (jobs.status === "fulfilled") {
    setJobs((previous) => [...previous.filter((job) => job.kind !== kind), ...jobs.value]);
  }
}

function archiveNeedsAttention(job: ArchiveJob): boolean {
  return job.status === "cleanup_incomplete" || Boolean(job.batchProgress?.blocked);
}

function formatArchiveAmount(value: number, unit: string, t: TFunction): string {
  if (unit === "bytes") return formatFileSize(value);
  if (unit === "rows") return t("bknTrace.settings.archive.recordCount", { count: value });
  return formatNumber(value);
}

function ArchiveJobStatus({ job }: { job: ArchiveJob }) {
  const { t } = useTranslation();
  const progress = job.batchProgress;
  const blocked = progress?.blocked;
  return (
    <div>
      <Typography.Text>
        {t(
          blocked
            ? "bknTrace.settings.archive.blocked"
            : `bknTrace.settings.archive.statuses.${job.status}`,
        )}
      </Typography.Text>
      {progress ? (
        <Typography.Paragraph type="secondary">
          {t(
            progress.run_complete
              ? "bknTrace.settings.archive.runComplete"
              : "bknTrace.settings.archive.runIncomplete",
            { cleaned: progress.cleaned_in_run, remaining: progress.remaining_at_selection },
          )}
        </Typography.Paragraph>
      ) : null}
      {blocked ? (
        <>
          <Typography.Paragraph>
            {t(
              blocked.at_least
                ? "bknTrace.settings.archive.blockedDetailsAtLeast"
                : "bknTrace.settings.archive.blockedDetails",
              {
                interaction: blocked.interaction_id,
                actual: formatArchiveAmount(blocked.actual, blocked.unit, t),
                limit: formatArchiveAmount(blocked.limit, blocked.unit, t),
              },
            )}
          </Typography.Paragraph>
          <Typography.Text type="secondary">
            {t("bknTrace.settings.archive.blockedAdvice")}
          </Typography.Text>
        </>
      ) : job.status === "cleanup_incomplete" ? (
        <Typography.Paragraph type="secondary">
          {t("bknTrace.settings.archive.cleanupAdvice")}
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}

function ArchivePanel({
  archive,
  blockedByCleanup,
  canManage,
  historyUnavailable,
  kind,
  onSettled,
}: {
  archive?: ArchiveOverview;
  blockedByCleanup: boolean;
  canManage: boolean;
  historyUnavailable: boolean;
  kind: ArchiveKind;
  onSettled: (kind: ArchiveKind) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [resultRunId, setResultRunId] = useState<string>();
  const [retainedOpen, setRetainedOpen] = useState(false);
  const run = archive?.currentRun;
  const running = isArchiveRunActive(run);
  const label =
    kind === "log"
      ? t("bknTrace.settings.archive.logTitle")
      : t("bknTrace.settings.archive.traceTitle");
  const rule =
    kind === "log"
      ? t("bknTrace.settings.archive.logRule")
      : t("bknTrace.settings.archive.traceRule");
  const start = () => {
    setCreateError(undefined);
    setConfirmOpen(true);
  };
  const confirm = async () => {
    setCreating(true);
    try {
      await createArchive(kind);
    } catch (error) {
      const code = axios.isAxiosError<{ error?: { code?: string } }>(error)
        ? error.response?.data?.error?.code
        : undefined;
      const key =
        code === "archive_cleanup_required"
          ? "cleanupAdvice"
          : code === "archive_busy"
            ? "busy"
            : code === "archive_incomplete_candidates"
              ? "inspectHistory"
              : code === "archive_capacity_exceeded" || code === "archive_configuration_invalid"
                ? "capacityAdvice"
                : "actionUnconfirmed";
      setCreateError(t(`bknTrace.settings.archive.${key}`));
    } finally {
      // Close on every outcome: the refreshed panel gates the next archive and
      // the job list behind the dialog shows what actually happened.
      await onSettled(kind);
      setCreating(false);
      setConfirmOpen(false);
    }
  };
  return (
    <div className={styles.archivePanel}>
      <div>
        <Typography.Text strong>{label}</Typography.Text>
        <Typography.Paragraph type="secondary">{rule}</Typography.Paragraph>
        {archive ? (
          <Typography.Text type="secondary">
            {t("bknTrace.settings.archive.candidates", {
              count: archive.candidateCount,
              cutoff: archive.cutoffAt,
            })}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            {t(
              canManage
                ? "bknTrace.settings.archive.unavailable"
                : "bknTrace.settings.archive.permissionDenied",
            )}
          </Typography.Text>
        )}
        {archive && archive.retainedCount > 0 ? (
          <Typography.Paragraph type="secondary">
            {t("bknTrace.settings.archive.run.retainedSummary", {
              retained: formatNumber(archive.retainedCount),
            })}{" "}
            <Typography.Link onClick={() => setRetainedOpen(true)}>
              {t("bknTrace.settings.archive.run.viewRetained")}
            </Typography.Link>
          </Typography.Paragraph>
        ) : null}
      </div>
      <Button
        disabled={
          !canManage ||
          historyUnavailable ||
          blockedByCleanup ||
          creating ||
          running ||
          !archive ||
          archive.candidateCount === 0 ||
          archive.storageStatus !== "ready"
        }
        onClick={start}
        type="primary"
      >
        {t("bknTrace.settings.archive.action")}
      </Button>
      {run ? <ArchiveRunLine run={run} onShowResult={() => setResultRunId(run.id)} /> : null}
      {createError ? (
        <Alert message={createError} showIcon type="error" />
      ) : blockedByCleanup && !running ? (
        <Typography.Text type="warning">
          {t("bknTrace.settings.archive.cleanupAdvice")}
        </Typography.Text>
      ) : null}
      <Modal
        cancelText={t("common.cancel")}
        closable={!creating}
        maskClosable={!creating}
        cancelButtonProps={{ disabled: creating }}
        confirmLoading={creating}
        okText={t("bknTrace.settings.archive.action")}
        onCancel={() => setConfirmOpen(false)}
        onOk={() => void confirm()}
        open={confirmOpen}
        title={t("bknTrace.settings.archive.confirmTitle")}
      >
        <Typography.Paragraph>
          {t("bknTrace.settings.archive.confirm", { rule })}
        </Typography.Paragraph>
      </Modal>
      <ArchiveRunResultModal runId={resultRunId} onClose={() => setResultRunId(undefined)} />
      <RetainedInteractionsModal open={retainedOpen} onClose={() => setRetainedOpen(false)} />
    </div>
  );
}

const ARCHIVE_POLL_INTERVAL_MS = 3000;
const ARCHIVE_MAX_RETRIES = 3;

function archiveReason(t: TFunction, code?: string): string {
  return t(`bknTrace.settings.archive.run.reasons.${code ?? "temporarily_unavailable"}`, {
    defaultValue: t("bknTrace.settings.archive.run.reasons.temporarily_unavailable"),
  });
}

/** One sentence for the latest run, with a progress bar while it is active. */
function ArchiveRunLine({ run, onShowResult }: { run: ArchiveRun; onShowResult: () => void }) {
  const { t } = useTranslation();
  const total = Math.max(run.eligibleAtStart, run.processedCount);
  const percent = total > 0 ? Math.min(100, Math.round((run.processedCount / total) * 100)) : 0;
  let text: string;
  let type: "secondary" | "warning" | "danger" | undefined;
  switch (run.status) {
    case "queued":
      text = t("bknTrace.settings.archive.run.queued");
      break;
    case "running":
      text = t("bknTrace.settings.archive.run.running", {
        done: formatNumber(run.processedCount),
        total: formatNumber(total),
      });
      break;
    case "retry_wait":
      type = "warning";
      text = t("bknTrace.settings.archive.run.retryWait", {
        reason: archiveReason(t, run.lastFailureCode),
        time: formatDateTime(run.nextAttemptAt),
        attempt: run.retryCount,
        max: ARCHIVE_MAX_RETRIES,
      });
      break;
    case "completed":
      type = run.retainedCount > 0 ? "warning" : "secondary";
      text =
        run.retainedCount > 0
          ? t("bknTrace.settings.archive.run.completedRetained", {
              archived: formatNumber(run.processedCount),
              retained: formatNumber(run.retainedCount),
            })
          : t("bknTrace.settings.archive.run.completed", {
              archived: formatNumber(run.processedCount),
            });
      break;
    default:
      type = "danger";
      text = t("bknTrace.settings.archive.run.failed", {
        reason: archiveReason(t, run.lastFailureCode),
      });
  }
  return (
    <div className={styles.archiveRun} role="status">
      <Typography.Text {...(type ? { type } : {})}>{text}</Typography.Text>
      {isArchiveRunActive(run) && total > 0 ? (
        <Progress percent={percent} showInfo={false} size="small" />
      ) : null}
      {isArchiveRunActive(run) ? null : (
        <Typography.Link onClick={onShowResult}>
          {t("bknTrace.settings.archive.run.viewResult")}
        </Typography.Link>
      )}
    </div>
  );
}

function retainedSize(t: TFunction, item: RetainedInteraction): string {
  const amount = (value: number) =>
    item.unit === "bytes"
      ? formatFileSize(value)
      : item.unit === "rows"
        ? t("bknTrace.settings.archive.recordCount", { count: value })
        : formatNumber(value);
  return item.atLeast
    ? t("bknTrace.settings.archive.run.atLeast", { size: amount(item.measured) })
    : amount(item.measured);
}

function RetainedTable({ items }: { items: RetainedInteraction[] }) {
  const { t } = useTranslation();
  const columns: ColumnsType<RetainedInteraction> = [
    {
      title: t("bknTrace.settings.archive.run.columns.interaction"),
      dataIndex: "interactionId",
      key: "interactionId",
    },
    {
      title: t("bknTrace.settings.archive.run.columns.size"),
      key: "size",
      render: (_, item) => retainedSize(t, item),
    },
    {
      title: t("bknTrace.settings.archive.run.columns.reason"),
      key: "reason",
      render: (_, item) =>
        t("bknTrace.settings.archive.run.overLimit", {
          limit:
            item.unit === "bytes"
              ? formatFileSize(item.budget)
              : t("bknTrace.settings.archive.recordCount", { count: item.budget }),
        }),
    },
    {
      title: t("bknTrace.settings.archive.run.columns.time"),
      dataIndex: "retainedAt",
      key: "retainedAt",
      render: (value: string) => formatDateTime(value),
    },
  ];
  return (
    <Table
      columns={columns}
      dataSource={items}
      pagination={false}
      rowKey="interactionId"
      size="small"
    />
  );
}

function ArchiveRunResultModal({ runId, onClose }: { runId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<ArchiveRunResult>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!runId) return;
    let active = true;
    setResult(undefined);
    setFailed(false);
    getArchiveRunResult(runId)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [runId]);
  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={Boolean(runId)}
      title={t("bknTrace.settings.archive.run.resultTitle")}
      width={640}
    >
      {failed ? (
        <Alert message={t("bknTrace.settings.archive.run.loadFailed")} showIcon type="warning" />
      ) : !result ? (
        <Spin />
      ) : (
        <>
          <Descriptions column={2} size="small">
            <Descriptions.Item label={t("bknTrace.settings.archive.run.fields.status")}>
              {t(`bknTrace.settings.archive.run.statuses.${result.status}`)}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.settings.archive.run.fields.processed")}>
              {formatNumber(result.processedCount)}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.settings.archive.run.fields.startedAt")}>
              {formatDateTime(result.startedAt ?? result.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.settings.archive.run.fields.finishedAt")}>
              {formatDateTime(result.finishedAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.settings.archive.run.fields.retained")}>
              {formatNumber(result.retainedCount)}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.settings.archive.run.fields.retries")}>
              {result.retryCount > 0
                ? t("bknTrace.settings.archive.run.retriesValue", {
                    attempts: result.retryCount,
                    reason: archiveReason(t, result.lastFailureCode),
                  })
                : t("bknTrace.settings.archive.run.none")}
            </Descriptions.Item>
            {result.status === "failed" ? (
              <Descriptions.Item label={t("bknTrace.settings.archive.run.fields.reason")} span={2}>
                {archiveReason(t, result.lastFailureCode)}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
          {result.retained.length > 0 ? <RetainedTable items={result.retained} /> : null}
        </>
      )}
    </Modal>
  );
}

function RetainedInteractionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RetainedInteraction[]>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setItems(undefined);
    setFailed(false);
    listRetainedInteractions()
      .then((value) => {
        if (active) setItems(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [open]);
  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      title={t("bknTrace.settings.archive.run.retainedTitle")}
      width={640}
    >
      {failed ? (
        <Alert message={t("bknTrace.settings.archive.run.loadFailed")} showIcon type="warning" />
      ) : !items ? (
        <Spin />
      ) : (
        <RetainedTable items={items} />
      )}
    </Modal>
  );
}

function SettingsSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.section}>
      <Typography.Title level={4}>{title}</Typography.Title>
      {children}
    </section>
  );
}

function CapturePolicySection({
  canWrite,
  configuration,
  onChange,
  operation,
  operationUnavailable,
  unavailable,
}: {
  canWrite: boolean;
  configuration?: CapturePolicyConfiguration;
  onChange: (desiredState: "enabled" | "disabled", expectedRevision: number) => Promise<void>;
  operation?: CapturePolicyOperation;
  operationUnavailable: boolean;
  unavailable: boolean;
}) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [changeError, setChangeError] = useState(false);
  const nextState = configuration?.desiredState === "enabled" ? "disabled" : "enabled";
  const stable =
    configuration &&
    configuration.desiredState === configuration.effectiveState &&
    (configuration.desiredState === "enabled" || configuration.desiredState === "disabled");
  const change = async () => {
    if (!configuration || !stable) return;
    setSubmitting(true);
    setChangeError(false);
    try {
      await onChange(nextState, configuration.policyRevision);
      setConfirmOpen(false);
    } catch {
      setChangeError(true);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <SettingsSection title={t("bknTrace.settings.capturePolicy.title")}>
      {unavailable || !configuration ? (
        <Alert message={t("bknTrace.settings.capturePolicy.unavailable")} showIcon type="warning" />
      ) : (
        <>
          <div className={styles.metricGrid}>
            <Metric
              label={t("bknTrace.settings.capturePolicy.desiredState")}
              value={t(`bknTrace.settings.capturePolicy.states.${configuration.desiredState}`)}
            />
            <Metric
              label={t("bknTrace.settings.capturePolicy.effectiveState")}
              value={t(`bknTrace.settings.capturePolicy.states.${configuration.effectiveState}`)}
            />
            <Metric
              label={t("bknTrace.settings.capturePolicy.phase")}
              value={
                operation
                  ? t(`bknTrace.settings.capturePolicy.phases.${operation.phase}`)
                  : operationUnavailable
                    ? t("bknTrace.settings.capturePolicy.dataUnavailable")
                    : configuration.activeOperationId
                      ? t("bknTrace.settings.capturePolicy.phases.pending")
                      : t("bknTrace.settings.capturePolicy.noActiveOperation")
              }
            />
            <Metric
              label={t("bknTrace.settings.capturePolicy.revision")}
              value={configuration.policyRevision}
            />
            <Metric
              label={t("bknTrace.settings.capturePolicy.lastStableRevision")}
              value={configuration.lastStableRevision}
            />
          </div>
          {canWrite ? (
            <Button
              disabled={!stable || Boolean(configuration.activeOperationId) || submitting}
              onClick={() => {
                setChangeError(false);
                setConfirmOpen(true);
              }}
              type="primary"
            >
              {t(
                `bknTrace.settings.capturePolicy.${nextState === "enabled" ? "enable" : "disable"}`,
              )}
            </Button>
          ) : null}
          {!stable &&
          !configuration.activeOperationId &&
          (operation?.phase === "failed" || operation?.phase === "rollback_failed") ? (
            <Alert
              message={t("bknTrace.settings.capturePolicy.reconcileRequired")}
              showIcon
              type="warning"
            />
          ) : null}
          <Modal
            cancelText={t("common.cancel")}
            confirmLoading={submitting}
            okText={t("bknTrace.settings.capturePolicy.confirmAction")}
            onCancel={() => {
              setChangeError(false);
              setConfirmOpen(false);
            }}
            onOk={() => void change()}
            open={confirmOpen}
            title={t("bknTrace.settings.capturePolicy.confirmTitle")}
          >
            <Typography.Paragraph>
              {t("bknTrace.settings.capturePolicy.confirmWarning")}
            </Typography.Paragraph>
            {changeError ? (
              <Alert
                message={t("bknTrace.settings.capturePolicy.changeFailed")}
                showIcon
                type="error"
              />
            ) : null}
          </Modal>
          {operationUnavailable ? (
            <Alert
              message={t("bknTrace.settings.capturePolicy.operationUnavailable")}
              showIcon
              type="info"
            />
          ) : null}
        </>
      )}
    </SettingsSection>
  );
}

function isTerminalCapturePolicyPhase(phase: CapturePolicyOperation["phase"]): boolean {
  return ["succeeded", "failed", "rollback_completed", "rollback_failed"].includes(phase);
}

function isSettledCapturePolicy(
  configuration: CapturePolicyConfiguration,
  operation: CapturePolicyOperation,
): boolean {
  return isTerminalCapturePolicyPhase(operation.phase) && !configuration.activeOperationId;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.metric}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text strong>{value}</Typography.Text>
    </div>
  );
}
