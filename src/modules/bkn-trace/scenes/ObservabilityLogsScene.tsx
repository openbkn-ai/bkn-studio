/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, Input, Select, Space, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { LogDetailDrawer } from "@/modules/bkn-trace/components/LogDetailDrawer";
import { presentLogAction, presentLogActor, presentLogTarget } from "@/modules/bkn-trace/components/log-presentation";
import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import {
  listLogs,
  type AuditOutcome,
  type BusinessModule,
  type LogCategory,
  type LogListQuery,
  type LogListResult,
  type LogRecord,
} from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile, type TraceAccessProfile } from "@/modules/bkn-trace/services/trace.service";
import { readAuditLogDrilldown } from "@/modules/bkn-trace/utils/audit-log-drilldown";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";

const BUSINESS_MODULES: BusinessModule[] = [
  "domain_knowledge_network", "observability", "execution_factory",
  "data_resource_knowledge_network", "model_management", "system_management",
];

const AUDIT_OUTCOMES: AuditOutcome[] = ["success", "failure", "denied", "canceled", "unknown"];
const SYSTEM_AUDIT_CATEGORIES: LogCategory[] = ["audit.admin"];
const EXACT_ACTOR_MATCH = "exact";

type ObservabilityLogsSceneProps = {
  mode?: "audit" | "logs";
};

type Filters = {
  actorId: string;
  businessModule?: BusinessModule;
  outcome?: AuditOutcome;
  query: string;
  timeRange: [Dayjs, Dayjs];
};

export function ObservabilityLogsScene({ mode = "logs" }: ObservabilityLogsSceneProps) {
  const { t } = useTranslation();
  const userDirectory = useAuditUserDirectory();
  const [associatedScope] = useState(readAssociatedLogScope);
  const [profile, setProfile] = useState<TraceAccessProfile>();
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters(mode));
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [result, setResult] = useState<LogListResult>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async (
    access: TraceAccessProfile,
    nextFilters: Filters,
    nextPage = 1,
    nextPageSize = 20,
  ) => {
    if (!canSearchLogs(access, associatedScope)) return;
    setLoading(true);
    setError(undefined);
    try {
      const query: LogListQuery = {
        page: nextPage,
        pageSize: nextPageSize,
        timeFrom: nextFilters.timeRange[0].toISOString(),
        timeTo: nextFilters.timeRange[1].toISOString(),
        ...(mode === "audit" ? { categories: SYSTEM_AUDIT_CATEGORIES } : {}),
        ...(nextFilters.query.trim() ? { query: nextFilters.query.trim() } : {}),
        ...(nextFilters.businessModule ? { businessModule: nextFilters.businessModule } : {}),
        ...(nextFilters.actorId.trim() ? { actorQuery: nextFilters.actorId.trim() } : {}),
        ...(nextFilters.outcome ? { outcomes: [nextFilters.outcome] } : {}),
        ...(associatedScope.actorId ? { actorId: associatedScope.actorId } : {}),
        ...(associatedScope.conversationId ? { conversationId: associatedScope.conversationId } : {}),
        ...(associatedScope.requestId ? { requestId: associatedScope.requestId } : {}),
        ...(associatedScope.targetId ? { targetId: associatedScope.targetId } : {}),
        ...(associatedScope.targetType ? { targetType: associatedScope.targetType } : {}),
        ...(associatedScope.traceId ? { traceId: associatedScope.traceId } : {}),
      };
      setResult(await listLogs(query));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
    } finally {
      setLoading(false);
    }
  }, [associatedScope, mode, t]);

  useEffect(() => {
    let active = true;
    getAccessProfile()
      .then((access) => {
        if (!active) return;
        setProfile(access);
        if (canSearchLogs(access, associatedScope)) void load(access, filters);
        else setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : t("bknTrace.errors.accessProfileFailed"));
        setLoading(false);
      });
    return () => { active = false; };
    // The initial request intentionally uses the URL-derived filter snapshot once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associatedScope, load, t]);

  const columns = useMemo<ColumnsType<LogRecord>>(() => [
    { dataIndex: "eventTime", key: "time", title: t("bknTrace.logs.columns.time"), width: 150, render: formatTime },
    {
      dataIndex: "businessModule", key: "businessModule", title: t("bknTrace.logs.columns.module"), width: 145,
      render: (value: string) => <Tag>{moduleLabel(value, t)}</Tag>,
    },
    {
      dataIndex: "action", key: "action", title: t("bknTrace.logs.columns.action"), width: 190,
      render: (_value: string, record) => <ClampedText value={presentLogAction(record, t)} />,
    },
    {
      dataIndex: "target", key: "target", title: t("bknTrace.logs.columns.target"), width: 230,
      render: (_target: LogRecord["target"], record) => {
        const value = presentLogTarget(record, t);
        return <ClampedText secondary={value.secondary} value={value.primary} />;
      },
    },
    {
      dataIndex: "actor", key: "actor", title: t("bknTrace.logs.columns.actor"), width: 180,
      render: (_actor: LogRecord["actor"], record) => {
        const value = presentLogActor(record, t, userDirectory);
        return <ClampedText secondary={value.secondary} value={value.primary} />;
      },
    },
    {
      dataIndex: "outcome", key: "outcome", title: t("bknTrace.logs.columns.outcome"), width: 105,
      render: (value: AuditOutcome) => <Tag color={outcomeColor(value)}>{t(`bknTrace.logs.outcomes.${value}`)}</Tag>,
    },
    {
      dataIndex: "sourceId", key: "source", title: t("bknTrace.logs.columns.source"), width: 145,
      render: (value: string, record) => <ClampedText secondary={record.sourceChannel} value={value} />,
    },
  ], [t, userDirectory]);

  const submit = useCallback(() => {
    if (!profile) return;
    setPagination((current) => ({ ...current, page: 1 }));
    syncFiltersToUrl(filters, associatedScope);
    void load(profile, filters, 1, pagination.pageSize);
  }, [associatedScope, filters, load, pagination.pageSize, profile]);

  const reset = useCallback(() => {
    if (!profile) return;
    const next = defaultFilters(mode);
    setFilters(next);
    setPagination({ page: 1, pageSize: pagination.pageSize });
    syncFiltersToUrl(next, associatedScope);
    void load(profile, next, 1, pagination.pageSize);
  }, [associatedScope, load, mode, pagination.pageSize, profile]);

  const changePage = useCallback((page: number, pageSize: number) => {
    if (!profile) return;
    setPagination({ page, pageSize });
    void load(profile, filters, page, pageSize);
  }, [filters, load, profile]);

  if (loading && !profile) return <Spin />;
  if (profile && !canSearchLogs(profile, associatedScope)) {
    return <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;
  }

  const associated = associatedScope.actorId || associatedScope.conversationId || associatedScope.traceId || associatedScope.requestId || associatedScope.targetId;
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <Typography.Title level={3}>{t(mode === "audit" ? "bknTrace.logs.auditTitle" : "bknTrace.logs.title")}</Typography.Title>
          <Typography.Text type="secondary">{t(mode === "audit" ? "bknTrace.logs.auditDescription" : "bknTrace.logs.description")}</Typography.Text>
        </div>
        <Button aria-label={t("bknTrace.actions.refresh")} icon={<ReloadOutlined />} onClick={() => {
          if (profile) void load(profile, filters, pagination.page, pagination.pageSize);
        }}>{t("bknTrace.actions.refresh")}</Button>
      </header>

      {error ? <Alert message={error} showIcon type="error" /> : null}
      {result?.partial ? <Alert message={t("bknTrace.logs.partialWarning")} showIcon type="warning" /> : null}
      {result?.partial ? <SourceFailures sources={result.sourceStatus} t={t} /> : null}
      {associated ? <div className={styles.sourceStrip}><AssociatedScopeTag scope={associatedScope} t={t} userDirectory={userDirectory} /></div> : null}

      {profile?.globalLogSearch ? (
        <div className={styles.filterPanel}>
          <div className={styles.filterRowPrimary}>
            <Input allowClear onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} onPressEnter={submit} placeholder={t("bknTrace.logs.searchPlaceholder")} prefix={<SearchOutlined />} value={filters.query} />
            <DatePicker allowClear={false} onChange={(value) => { if (value) setFilters((current) => ({ ...current, timeRange: [value, current.timeRange[1]] })); }} placeholder={t("bknTrace.logs.startTime")} showTime value={filters.timeRange[0]} />
            <DatePicker allowClear={false} onChange={(value) => { if (value) setFilters((current) => ({ ...current, timeRange: [current.timeRange[0], value] })); }} placeholder={t("bknTrace.logs.endTime")} showTime value={filters.timeRange[1]} />
            <Select allowClear onChange={(businessModule) => setFilters((value) => ({ ...value, businessModule }))} options={BUSINESS_MODULES.map((module) => ({ label: moduleLabel(module, t), value: module }))} placeholder={t("bknTrace.logs.modulePlaceholder")} value={filters.businessModule} />
          </div>
          <div className={styles.filterRowSecondary}>
            <Input allowClear onChange={(event) => setFilters((value) => ({ ...value, actorId: event.target.value }))} onPressEnter={submit} placeholder={t("bknTrace.logs.actorPlaceholder")} value={filters.actorId} />
            <Select allowClear onChange={(outcome) => setFilters((value) => ({ ...value, outcome }))} options={AUDIT_OUTCOMES.map((outcome) => ({ label: t(`bknTrace.logs.outcomes.${outcome}`), value: outcome }))} placeholder={t("bknTrace.logs.outcomePlaceholder")} value={filters.outcome} />
            <Space><Button icon={<SearchOutlined />} onClick={submit} type="primary">{t("bknTrace.actions.query")}</Button><Button onClick={reset}>{t("bknTrace.actions.reset")}</Button></Space>
          </div>
        </div>
      ) : null}

      {loading && !result && !error ? <Spin /> : null}
      {!error && result ? <>
        <div className={styles.resultSummary}>
          <Typography.Text>{result.count.value === null
            ? t("bknTrace.logs.resultCountUnknown")
            : t("bknTrace.logs.resultCount", { count: result.count.value })}</Typography.Text>
          {result.sourceStatus.length ? <Space size={4} wrap>{result.sourceStatus.map((source) => <Tag color={sourceStatusColor(source.status)} key={source.sourceId}>{source.sourceId} · {sourceStatusLabel(source.status, t)}</Tag>)}</Space> : null}
        </div>

        <Spin spinning={loading}>
          <Table className={styles.auditTable} columns={columns} dataSource={result.data} locale={{ emptyText: t(associated ? "bknTrace.logs.emptyAssociated" : "bknTrace.logs.emptyRange") }} onRow={(record) => ({ onClick: () => setSelectedEventId(record.eventId) })} pagination={false} rowClassName={styles.clickableRow} rowKey="eventId" tableLayout="fixed" />
        </Spin>
        {result.count.value ? <TablePaginationBar current={result.page ?? pagination.page} onChange={changePage} pageSize={result.pageSize ?? pagination.pageSize} showSizeChanger showTotal={(total) => t("common.total", { total })} total={result.count.value} /> : null}
      </> : null}
      <LogDetailDrawer logId={selectedEventId} onClose={() => setSelectedEventId(undefined)} />
    </div>
  );
}

function ClampedText({ secondary, value }: { secondary?: string; value: string }) {
  return <div className={styles.clampedCell}>
    <Typography.Paragraph ellipsis={{ rows: 2, tooltip: value }}>{value}</Typography.Paragraph>
    {secondary && secondary !== value ? <Typography.Text className={styles.technicalId}>{secondary}</Typography.Text> : null}
  </div>;
}

function defaultFilters(mode: "audit" | "logs"): Filters {
  const end = dayjs();
  return { actorId: "", query: "", timeRange: [end.subtract(mode === "audit" ? 30 : 7, "day"), end] };
}

function readInitialFilters(mode: "audit" | "logs"): Filters {
  const defaults = defaultFilters(mode);
  const parameters = new URLSearchParams(window.location.search);
  const businessModule = parameters.get("business_module") ?? "";
  const outcome = parameters.get("outcome") ?? "";
  const timeFrom = dayjs(parameters.get("time_from"));
  const timeTo = dayjs(parameters.get("time_to"));
  const hasValidTimeRange = timeFrom.isValid() && timeTo.isValid() && !timeTo.isBefore(timeFrom);
  const exactActorMatch = parameters.get("actor_match") === EXACT_ACTOR_MATCH;
  return {
    ...defaults,
    actorId: parameters.get("actor") ?? (!exactActorMatch ? parameters.get("actor_id") : null) ?? "",
    ...(BUSINESS_MODULES.includes(businessModule as BusinessModule) ? { businessModule: businessModule as BusinessModule } : {}),
    ...(AUDIT_OUTCOMES.includes(outcome as AuditOutcome) ? { outcome: outcome as AuditOutcome } : {}),
    query: parameters.get("q") ?? "",
    ...(hasValidTimeRange ? { timeRange: [timeFrom, timeTo] } : {}),
  };
}

type AssociatedLogScope = { actorId: string; conversationId: string; requestId: string; targetId: string; targetType: string; traceId: string };

function readAssociatedLogScope(): AssociatedLogScope {
  const parameters = new URLSearchParams(window.location.search);
  const target = readAuditLogDrilldown(parameters);
  const exactActorMatch = parameters.get("actor_match") === EXACT_ACTOR_MATCH;
  return {
    actorId: exactActorMatch ? parameters.get("actor_id")?.trim() ?? "" : "",
    conversationId: parameters.get("conversation_id") ?? "",
    requestId: parameters.get("request_id") ?? "",
    targetId: target.targetId,
    targetType: target.apiResourceType,
    traceId: parameters.get("trace_id") ?? "",
  };
}

function syncFiltersToUrl(filters: Filters, scope: AssociatedLogScope) {
  const parameters = new URLSearchParams();
  if (scope.conversationId) parameters.set("conversation_id", scope.conversationId);
  if (scope.requestId) parameters.set("request_id", scope.requestId);
  if (scope.targetId) parameters.set("target_id", scope.targetId);
  if (scope.targetType) parameters.set("target_type", scope.targetType);
  if (scope.traceId) parameters.set("trace_id", scope.traceId);
  if (scope.actorId) {
    parameters.set("actor_id", scope.actorId);
    parameters.set("actor_match", EXACT_ACTOR_MATCH);
  }
  if (filters.query.trim()) parameters.set("q", filters.query.trim());
  if (filters.businessModule) parameters.set("business_module", filters.businessModule);
  if (filters.actorId.trim()) parameters.set("actor", filters.actorId.trim());
  if (filters.outcome) parameters.set("outcome", filters.outcome);
  parameters.set("time_from", filters.timeRange[0].toISOString());
  parameters.set("time_to", filters.timeRange[1].toISOString());
  const query = parameters.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function AssociatedScopeTag({ scope, t, userDirectory }: { scope: AssociatedLogScope; t: Translate; userDirectory: Map<string, string> }) {
  if (scope.targetId) {
    const displayType = scope.targetType === "user" ? "user" : "resource";
    return <Tag color="blue"><span>{t(`bknTrace.logs.associatedTarget.${displayType}`)}</span> <span>{userDirectory.get(scope.targetId) ?? scope.targetId}</span></Tag>;
  }
  if (scope.actorId) {
    return <Tag color="blue"><span>{t("bknTrace.logs.associatedTarget.user")}</span> <span>{userDirectory.get(scope.actorId) ?? scope.actorId}</span></Tag>;
  }
  return <Tag color="blue">{scope.conversationId || scope.traceId || scope.requestId}</Tag>;
}

function SourceFailures({ sources, t }: { sources: LogListResult["sourceStatus"]; t: Translate }) {
  const failed = sources.filter((source) => source.reason && !isHealthySource(source.status) && source.status !== "not_integrated");
  if (!failed.length) return null;
  return <div className={styles.sourceStrip}>{failed.map((source) => <Tag color="orange" key={source.sourceId}>{source.sourceId} · {sourceStatusLabel(source.status, t)} · {sourceFailureLabel(source.reason!, t)}</Tag>)}</div>;
}

function isHealthySource(status: string) {
  return status === "available" || status === "healthy";
}

function sourceStatusColor(status: string) {
  if (isHealthySource(status)) return "green";
  if (status === "unavailable") return "orange";
  return undefined;
}

function sourceStatusLabel(status: string, t: Translate) {
  if (isHealthySource(status)) return t("bknTrace.logs.sourceStatus.healthy");
  if (status === "unavailable") return t("bknTrace.logs.sourceStatus.unavailable");
  if (status === "not_integrated") return t("bknTrace.logs.sourceStatus.notIntegrated");
  return status;
}

function sourceFailureLabel(reason: string, t: Translate) {
  const key = reason === "source_query_failed" || reason === "source_timeout" ? reason : undefined;
  return key ? t(`bknTrace.logs.sourceFailures.${key}`) : reason;
}

function canSearchLogs(profile: TraceAccessProfile, scope: AssociatedLogScope) {
  return profile.globalLogSearch || (profile.businessProvenanceOwn && Boolean(scope.conversationId || scope.requestId || scope.traceId));
}

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function moduleLabel(module: string, t: (key: string, options?: Record<string, unknown>) => string) {
  return BUSINESS_MODULES.includes(module as BusinessModule)
    ? t(`bknTrace.logs.modules.${module}`)
    : module;
}

function outcomeColor(outcome: AuditOutcome) {
  if (outcome === "success") return "green";
  if (outcome === "failure" || outcome === "denied") return "red";
  if (outcome === "unknown") return "default";
  return "orange";
}
