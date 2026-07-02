/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Checkbox,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import {
  getSandboxRuntimeHealth,
  getSandboxRuntimePool,
  getSandboxSessionDetail,
  isAbnormalSandboxSession,
  listSandboxSessions,
} from "@/modules/execution-factory-lab/services/sandbox-runtime.service";
import type {
  SandboxDependencyInfo,
  SandboxRuntimeHealth,
  SandboxRuntimePool,
  SandboxSessionDetail,
  SandboxSessionSummary,
} from "@/modules/execution-factory-lab/types/sandbox-runtime";

import styles from "./sandbox-runtime.module.css";

type TimeRange = "all" | "1h" | "24h" | "7d";

const pageSize = 20;

const statusColor: Record<string, string> = {
  creating: "processing",
  running: "success",
  idle: "default",
  failed: "error",
  terminated: "default",
};

const installStatusColor: Record<string, string> = {
  installed: "success",
  success: "success",
  installing: "processing",
  pending: "warning",
  failed: "error",
};

function displayText(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return String(value);
}

function formatTime(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY/MM/DD HH:mm:ss") : value;
}

function isInTimeRange(item: SandboxSessionSummary, range: TimeRange) {
  if (range === "all") {
    return true;
  }
  const raw = item.lastActivityAt ?? item.updatedAt ?? item.createdAt;
  if (!raw) {
    return false;
  }
  const parsed = dayjs(raw);
  if (!parsed.isValid()) {
    return false;
  }
  const hours = range === "1h" ? 1 : range === "24h" ? 24 : 24 * 7;
  return parsed.isAfter(dayjs().subtract(hours, "hour"));
}

function dependencyText(items?: SandboxDependencyInfo[]) {
  if (!items || items.length === 0) {
    return "-";
  }
  return items
    .map((item) => (item.version ? `${item.name}@${item.version}` : item.name))
    .filter(Boolean)
    .join(", ");
}

function loadErrorText(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }
  return `${fallback} ${error.message}`;
}

function buildDiagnostics(detail: SandboxSessionDetail) {
  return JSON.stringify(
    {
      session_id: detail.id,
      status: detail.status,
      source: detail.source,
      task_id: detail.taskId,
      capability_id: detail.capabilityId,
      capability_name: detail.capabilityName,
      user_name: detail.userName,
      runtime: detail.languageRuntime ?? detail.runtimeType,
      template_id: detail.templateId,
      dependency_install_status: detail.dependencyInstallStatus,
      recent_error_summary: detail.recentErrorSummary,
    },
    null,
    2,
  );
}

export function SandboxRuntimeScene() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<SandboxRuntimeHealth | null>(null);
  const [pool, setPool] = useState<SandboxRuntimePool | null>(null);
  const [sessions, setSessions] = useState<SandboxSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [runtime, setRuntime] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<SandboxSessionDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextHealth, nextPool, sessionResult] = await Promise.all([
        getSandboxRuntimeHealth(),
        getSandboxRuntimePool(),
        listSandboxSessions({
          page,
          pageSize,
          status,
          source,
          runtime,
          abnormalOnly,
        }),
      ]);
      setHealth(nextHealth);
      setPool(nextPool);
      setSessions(sessionResult.items);
      setTotal(sessionResult.total);
    } catch (loadError) {
      setError(loadErrorText(loadError, t("executionFactoryLab.sandboxRuntimeLoadFailed")));
    } finally {
      setLoading(false);
    }
  }, [abnormalOnly, page, runtime, source, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSessions = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return sessions.filter((item) => {
      if (!isInTimeRange(item, timeRange)) {
        return false;
      }
      if (!text) {
        return true;
      }
      return [
        item.id,
        item.taskId,
        item.capabilityId,
        item.capabilityName,
        item.userId,
        item.userName,
        item.source,
        item.runtimeType,
        item.languageRuntime,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [keyword, sessions, timeRange]);

  const resetPage = () => setPage(1);

  const openDetail = async (sessionId: string) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const detail = await getSandboxSessionDetail(sessionId);
      setSelected(detail);
    } catch (detailError) {
      message.error(
        loadErrorText(detailError, t("executionFactoryLab.sandboxRuntimeLoadFailed")),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const copyDiagnostics = async () => {
    if (!selected) {
      return;
    }
    try {
      await navigator.clipboard.writeText(buildDiagnostics(selected));
      message.success(t("executionFactoryLab.sandboxRuntimeCopied"));
    } catch {
      message.error(t("executionFactoryLab.sandboxRuntimeCopyFailed"));
    }
  };

  const columns: ColumnsType<SandboxSessionSummary> = [
    {
      title: t("executionFactoryLab.sandboxRuntimeColumnSession"),
      dataIndex: "id",
      width: 180,
      render: (value: string, item) => (
        <Space direction="vertical" size={2}>
          <Typography.Text copyable ellipsis className={styles.strongText}>
            {value}
          </Typography.Text>
          <Tag color={statusColor[item.status] ?? "default"}>{item.status}</Tag>
        </Space>
      ),
    },
    {
      title: t("executionFactoryLab.sandboxRuntimeColumnBusiness"),
      width: 220,
      render: (_, item) => (
        <Space direction="vertical" size={2}>
          <Typography.Text className={styles.strongText}>
            {displayText(item.capabilityName ?? item.capabilityId)}
          </Typography.Text>
          <Typography.Text type="secondary">{displayText(item.taskId)}</Typography.Text>
          <Typography.Text type="secondary">{displayText(item.userName ?? item.userId)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: t("executionFactoryLab.sandboxRuntimeColumnRuntime"),
      width: 150,
      render: (_, item) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{displayText(item.languageRuntime ?? item.runtimeType)}</Typography.Text>
          <Typography.Text type="secondary">{displayText(item.templateId)}</Typography.Text>
          <Tag>{item.source}</Tag>
        </Space>
      ),
    },
    {
      title: t("executionFactoryLab.sandboxRuntimeColumnResource"),
      dataIndex: "resourceText",
      width: 110,
    },
    {
      title: t("executionFactoryLab.sandboxRuntimeColumnDependency"),
      dataIndex: "dependencyInstallStatus",
      width: 110,
      render: (value?: string) => (
        <Tag color={installStatusColor[value ?? ""] ?? "default"}>{displayText(value)}</Tag>
      ),
    },
    {
      title: t("executionFactoryLab.sandboxRuntimeColumnLastActive"),
      dataIndex: "lastActivityAt",
      width: 150,
      render: (_, item) => formatTime(item.lastActivityAt ?? item.updatedAt ?? item.createdAt),
    },
    {
      title: t("executionFactoryLab.sandboxRuntimeColumnError"),
      dataIndex: "recentErrorSummary",
      ellipsis: true,
      width: 170,
      render: (value: string | undefined, item) =>
        value || isAbnormalSandboxSession(item) ? (
          <Typography.Text type="danger" ellipsis>
            {value ?? item.status}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">{t("executionFactoryLab.sandboxRuntimeNoError")}</Typography.Text>
        ),
    },
  ];

  return (
    <PermissionGate permissions={executionFactoryLabPermissions.sandboxRuntimeView}>
      <section className={styles.page}>
        <div className={styles.intro}>
          <div>
            <h2 className={styles.introTitle}>{t("executionFactoryLab.sandboxRuntimeTitle")}</h2>
            <p className={styles.introDescription}>{t("executionFactoryLab.sandboxRuntimeDescription")}</p>
          </div>
          <AppButton icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            {t("executionFactoryLab.sandboxRuntimeRefresh")}
          </AppButton>
        </div>

        {error ? <Alert message={error} showIcon type="error" /> : null}

        <div className={styles.metrics}>
          <Metric
            label={t("executionFactoryLab.sandboxRuntimeControlPlane")}
            value={health?.status ?? "-"}
            helper={
              health?.controlPlaneReachable
                ? t("executionFactoryLab.sandboxRuntimeReachable")
                : t("executionFactoryLab.sandboxRuntimeUnreachable")
            }
            tone={health?.controlPlaneReachable ? "good" : "bad"}
          />
          <Metric
            label={t("executionFactoryLab.sandboxRuntimeSessionPool")}
            value={`${pool?.currentActiveSessions ?? health?.currentActiveSessions ?? 0}/${pool?.maxSessions ?? health?.maxSessions ?? 0}`}
            helper={pool?.templateId ?? "-"}
          />
          <Metric
            label={t("executionFactoryLab.sandboxRuntimeRunningTasks")}
            value={String(pool?.currentRunningTasks ?? health?.currentRunningTasks ?? 0)}
            helper={`max ${pool?.maxConcurrentTasks ?? "-"}`}
          />
          <Metric
            label={t("executionFactoryLab.sandboxRuntimeFailedSessions")}
            value={String(health?.failedSessions ?? 0)}
            helper={health?.checkedAt ? formatTime(health.checkedAt) : "-"}
            tone={(health?.failedSessions ?? 0) > 0 ? "bad" : "good"}
          />
        </div>

        <div className={styles.toolbar}>
          <Select
            className={styles.filter}
            onChange={(value) => {
              setStatus(value);
              resetPage();
            }}
            options={[
              { value: "all", label: t("executionFactoryLab.sandboxRuntimeAll") },
              { value: "creating", label: "creating" },
              { value: "running", label: "running" },
              { value: "idle", label: "idle" },
              { value: "failed", label: "failed" },
              { value: "terminated", label: "terminated" },
            ]}
            placeholder={t("executionFactoryLab.sandboxRuntimeStatus")}
            value={status}
          />
          <Select
            className={styles.filter}
            onChange={(value) => {
              setSource(value);
              resetPage();
            }}
            options={[
              { value: "all", label: t("executionFactoryLab.sandboxRuntimeAll") },
              { value: "http", label: "HTTP" },
              { value: "mcp", label: "MCP" },
              { value: "skill", label: "Skill" },
              { value: "function", label: "Function" },
              { value: "function_debug", label: "Function Debug" },
              { value: "skill_execution", label: "Skill Execution" },
            ]}
            placeholder={t("executionFactoryLab.sandboxRuntimeSource")}
            value={source}
          />
          <Select
            className={styles.filter}
            onChange={(value) => {
              setRuntime(value);
              resetPage();
            }}
            options={[
              { value: "all", label: t("executionFactoryLab.sandboxRuntimeAll") },
              { value: "python", label: "Python" },
              { value: "node", label: "Node.js" },
              { value: "go", label: "Go" },
            ]}
            placeholder={t("executionFactoryLab.sandboxRuntimeRuntime")}
            value={runtime}
          />
          <Select
            className={styles.filter}
            onChange={(value) => setTimeRange(value)}
            options={[
              { value: "all", label: t("executionFactoryLab.sandboxRuntimeAll") },
              { value: "1h", label: t("executionFactoryLab.sandboxRuntimeLastHour") },
              { value: "24h", label: t("executionFactoryLab.sandboxRuntimeLastDay") },
              { value: "7d", label: t("executionFactoryLab.sandboxRuntimeLastWeek") },
            ]}
            placeholder={t("executionFactoryLab.sandboxRuntimeTimeRange")}
            value={timeRange}
          />
          <Input.Search
            allowClear
            className={styles.search}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("executionFactoryLab.sandboxRuntimeSearchPlaceholder")}
            value={keyword}
          />
          <Checkbox checked={abnormalOnly} onChange={(event) => {
            setAbnormalOnly(event.target.checked);
            resetPage();
          }}>
            {t("executionFactoryLab.sandboxRuntimeAbnormalOnly")}
          </Checkbox>
        </div>

        <Table<SandboxSessionSummary>
          columns={columns}
          dataSource={filteredSessions}
          loading={loading}
          locale={{ emptyText: <Empty description={t("executionFactoryLab.sandboxRuntimeNoSessions")} /> }}
          onRow={(record) => ({
            onClick: () => void openDetail(record.id),
          })}
          pagination={{
            current: page,
            pageSize,
            showSizeChanger: false,
            total,
            onChange: setPage,
          }}
          rowClassName={styles.sessionRow}
          rowKey="id"
          scroll={{ x: 1100 }}
        />

        <Drawer
          destroyOnClose
          extra={
            <AppButton disabled={!selected} onClick={() => void copyDiagnostics()}>
              {t("executionFactoryLab.sandboxRuntimeCopyDiagnostics")}
            </AppButton>
          }
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          title={t("executionFactoryLab.sandboxRuntimeDetailTitle")}
          width={640}
        >
          {detailLoading || !selected ? (
            <div className={styles.drawerLoading}>
              <Spin />
            </div>
          ) : (
            <Space direction="vertical" size={18} className={styles.drawerBody}>
              <Descriptions bordered column={1} size="small" title={t("executionFactoryLab.sandboxRuntimeBasicSection")}>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeSessionId")}>
                  <Typography.Text copyable>{selected.id}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeStatus")}>
                  <Tag color={statusColor[selected.status] ?? "default"}>{selected.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeSource")}>{selected.source}</Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeTaskId")}>
                  {displayText(selected.taskId)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeCapability")}>
                  {displayText(selected.capabilityName ?? selected.capabilityId)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeUser")}>
                  {displayText(selected.userName ?? selected.userId)}
                </Descriptions.Item>
              </Descriptions>

              <Descriptions bordered column={1} size="small" title={t("executionFactoryLab.sandboxRuntimeResourceSection")}>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeRuntime")}>
                  {displayText(selected.languageRuntime ?? selected.runtimeType)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeTemplate")}>
                  {displayText(selected.templateId)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeColumnResource")}>
                  {selected.resourceText}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeWorkspace")}>
                  {displayText(selected.workspacePath)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeRuntimeNode")}>
                  {displayText(selected.runtimeNode)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimePodName")}>
                  {displayText(selected.podName)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeTimeout")}>
                  {displayText(selected.timeout)}
                </Descriptions.Item>
              </Descriptions>

              <Descriptions bordered column={1} size="small" title={t("executionFactoryLab.sandboxRuntimeDependencySection")}>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeInstallStatus")}>
                  <Tag color={installStatusColor[selected.dependencyInstallStatus ?? ""] ?? "default"}>
                    {displayText(selected.dependencyInstallStatus)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeRequestedDependencies")}>
                  {dependencyText(selected.requestedDependencies)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeInstalledDependencies")}>
                  {dependencyText(selected.installedDependencies)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimePackageIndex")}>
                  {displayText(selected.pythonPackageIndexUrl)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeInstallTime")}>
                  {formatTime(selected.dependencyInstallStartedAt)} - {formatTime(selected.dependencyInstallCompletedAt)}
                </Descriptions.Item>
              </Descriptions>

              <Descriptions bordered column={1} size="small" title={t("executionFactoryLab.sandboxRuntimeErrorSection")}>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeColumnError")}>
                  {displayText(selected.recentErrorSummary)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeRedaction")}>
                  {String(selected.sensitiveDiagnosticsRedacted)}
                </Descriptions.Item>
                <Descriptions.Item label={t("executionFactoryLab.sandboxRuntimeGovernance")}>
                  {String(selected.governanceActionsAvailable)}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          )}
        </Drawer>
      </section>
    </PermissionGate>
  );
}

function Metric({
  helper,
  label,
  tone = "neutral",
  value,
}: {
  helper: string;
  label: string;
  tone?: "neutral" | "good" | "bad";
  value: string;
}) {
  return (
    <div className={`${styles.metric} ${styles[tone]}`}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <span className={styles.metricHelper}>{helper}</span>
    </div>
  );
}
