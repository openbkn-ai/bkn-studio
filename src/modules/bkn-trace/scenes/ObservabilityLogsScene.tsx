/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Select, Space, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { buildAppPath } from "@/app/router/app-paths";
import { LogDetailDrawer } from "@/modules/bkn-trace/components/LogDetailDrawer";
import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import { listLogFacets, listLogs, type LogCategory, type LogListResult, type LogRecord } from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile, type TraceAccessProfile } from "@/modules/bkn-trace/services/trace.service";

export function ObservabilityLogsScene() {
  const { t } = useTranslation();
  const [associatedScope] = useState(readAssociatedLogScope);
  const [profile, setProfile] = useState<TraceAccessProfile>();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<LogCategory[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [serviceOptions, setServiceOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedLogId, setSelectedLogId] = useState<string>();
  const [result, setResult] = useState<LogListResult>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

	const logQuery = useCallback((cursor?: string) => ({
		...(categories.length ? { categories } : {}),
		...(cursor ? { cursor } : {}),
		limit: 50,
		...(query.trim() ? { query: query.trim() } : {}),
		...(services.length ? { services } : {}),
		...(associatedScope.requestId ? { requestId: associatedScope.requestId } : {}),
		...(associatedScope.traceId ? { traceId: associatedScope.traceId } : {}),
	}), [associatedScope, categories, query, services]);

  const load = useCallback(async (access: TraceAccessProfile, nextQuery = "", nextCategories: LogCategory[] = [], nextServices: string[] = []) => {
    if (!canSearchLogs(access, associatedScope)) return;
    setLoading(true);
    setError(undefined);
    try {
      setResult(await listLogs({
        ...(nextCategories.length ? { categories: nextCategories } : {}),
        limit: 50,
        ...(nextQuery.trim() ? { query: nextQuery.trim() } : {}),
        ...(nextServices.length ? { services: nextServices } : {}),
        ...(associatedScope.requestId ? { requestId: associatedScope.requestId } : {}),
        ...(associatedScope.traceId ? { traceId: associatedScope.traceId } : {}),
      }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
    } finally {
      setLoading(false);
    }
  }, [associatedScope, t]);

  useEffect(() => {
    let active = true;
    getAccessProfile()
      .then((access) => {
        if (!active) return;
        setProfile(access);
        if (canSearchLogs(access, associatedScope)) {
          void load(access, "", [], []);
          if (access.globalLogSearch) void listLogFacets("service_name")
            .then((facets) => {
              if (active) setServiceOptions(facets.data.map((item) => ({ label: `${item.value} (${item.count})`, value: item.value })));
            })
            .catch(() => { if (active) setServiceOptions([]); });
        }
        else setLoading(false);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : t("bknTrace.errors.accessProfileFailed"));
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [associatedScope, load, t]);

  const columns = useMemo<ColumnsType<LogRecord>>(() => [
    { dataIndex: "eventTimestamp", key: "eventTimestamp", title: t("bknTrace.logs.columns.time"), width: 180, render: formatTime },
    {
      dataIndex: "summary", key: "summary", title: t("bknTrace.logs.columns.event"),
      render: (value: string, record) => <div className={styles.summaryCell}><span>{operationLabel(record.toolName, value, record.eventName, t)}</span><span className={styles.technicalId}>{record.eventName} · {record.logId}</span></div>,
    },
    { dataIndex: "category", key: "category", title: t("bknTrace.logs.columns.category"), width: 150, render: (value: string) => <Tag>{value}</Tag> },
    { dataIndex: "serviceName", key: "serviceName", title: t("bknTrace.logs.columns.service"), width: 160 },
    { dataIndex: "severityText", key: "severityText", title: t("bknTrace.logs.columns.severity"), width: 100 },
    {
      dataIndex: "traceId", key: "traceId", title: t("bknTrace.logs.columns.trace"), width: 180,
      render: (value?: string) => value ? <a href={buildAppPath(`/observability/traces?trace_id=${encodeURIComponent(value)}`)}>{value.slice(0, 16)}…</a> : "-",
    },
  ], [t]);

	const loadMore = useCallback(async () => {
		if (!result?.nextCursor) return;
		setLoading(true);
		setError(undefined);
		try {
			const next = await listLogs(logQuery(result.nextCursor));
			const records = new Map(result.data.map((record) => [record.logId, record]));
			for (const record of next.data) records.set(record.logId, record);
			setResult({ ...next, data: [...records.values()] });
		} catch (caught: unknown) {
			setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
		} finally {
			setLoading(false);
		}
	}, [logQuery, result, t]);

  if (loading && !profile) return <Spin />;
  if (profile && !canSearchLogs(profile, associatedScope)) return <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div><Typography.Title level={3}>{t("bknTrace.logs.title")}</Typography.Title><Typography.Text type="secondary">{t("bknTrace.logs.description")}</Typography.Text></div>
      </header>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      {result?.partial ? <Alert message={t("bknTrace.logs.partialWarning")} showIcon type="warning" /> : null}
      {associatedScope.traceId || associatedScope.requestId ? <div className={styles.sourceStrip}><Tag color="blue">{associatedScope.traceId ? `Trace ${associatedScope.traceId}` : `Request ${associatedScope.requestId}`}</Tag></div> : null}
      {profile?.globalLogSearch ? <div className={styles.filters}>
        <Input allowClear onChange={(event) => setQuery(event.target.value)} onPressEnter={() => profile && void load(profile, query, categories, services)} placeholder={t("bknTrace.logs.searchPlaceholder")} prefix={<SearchOutlined />} value={query} />
        <Select allowClear mode="multiple" onChange={setCategories} options={(profile?.allowedLogCategories ?? []).map((category) => ({ label: category, value: category }))} placeholder={t("bknTrace.logs.categoryPlaceholder")} value={categories} />
        <Select allowClear mode="multiple" onChange={setServices} options={serviceOptions} placeholder={t("bknTrace.logs.servicePlaceholder")} value={services} />
        <Space><Button icon={<SearchOutlined />} onClick={() => profile && void load(profile, query, categories, services)} type="primary">{t("bknTrace.actions.query")}</Button><Button aria-label={t("bknTrace.actions.refresh")} icon={<ReloadOutlined />} onClick={() => profile && void load(profile, query, categories, services)} /></Space>
      </div> : null}
      {result?.sourceStatus.length ? <div className={styles.sourceStrip}>{result.sourceStatus.map((source) => <Tag color={source.status === "healthy" ? "green" : "orange"} key={source.sourceId}>{source.sourceId} · {source.status}</Tag>)}</div> : null}
      <Spin spinning={loading}><Table columns={columns} dataSource={result?.data ?? []} onRow={(record) => ({ onClick: () => setSelectedLogId(record.logId) })} pagination={false} rowClassName={styles.clickableRow} rowKey="logId" scroll={{ x: 1050 }} /></Spin>
      {result?.nextCursor ? <div className={styles.loadMore}><Button disabled={loading} onClick={() => void loadMore()}>{t("bknTrace.actions.loadMore")}</Button></div> : null}
      <LogDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(undefined)} />
    </div>
  );
}

function readAssociatedLogScope() {
  const parameters = new URLSearchParams(window.location.search);
  return { requestId: parameters.get("request_id") ?? "", traceId: parameters.get("trace_id") ?? "" };
}

function canSearchLogs(profile: TraceAccessProfile, scope: { requestId: string; traceId: string }) {
  return profile.globalLogSearch || (profile.businessProvenanceOwn && Boolean(scope.requestId || scope.traceId));
}

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function operationLabel(toolName: string | undefined, summary: string, eventName: string, t: (key: string) => string) {
  if (toolName === "run_sql") return t("bknTrace.operations.runSql");
  if (toolName === "search_schema") return t("bknTrace.operations.searchSchema");
  return toolName || summary || eventName;
}
