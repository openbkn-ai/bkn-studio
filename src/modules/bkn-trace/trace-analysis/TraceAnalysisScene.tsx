/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ArrowLeftOutlined,
  CloseOutlined,
  CopyOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { buildAppPath } from "@/app/router/app-paths";
import type { PayloadEnvelope } from "@/modules/bkn-trace/shared/operation-fact.types";
import styles from "@/modules/bkn-trace/trace-analysis/TraceAnalysisScene.module.css";
import {
  getReferencedPayload,
  getTechnicalTrace,
  listTechnicalTraces,
} from "@/modules/bkn-trace/trace-analysis/trace-analysis.service";
import type {
  TechnicalTraceDetail,
  TechnicalTraceOperation,
  TechnicalTraceQuery,
  TechnicalTraceSummary,
  TechnicalSpanNode,
} from "@/modules/bkn-trace/trace-analysis/trace-analysis.types";

const defaultPageSize = 20;

export function TraceAnalysisScene() {
  const { t } = useTranslation();
  const [form] = Form.useForm<TechnicalTraceFilterValues>();
  const [listState, setListState] = useState<{ query: TechnicalTraceQuery; page: number }>({
    query: { limit: defaultPageSize },
    page: 1,
  });
  const { page, query } = listState;
  const [rows, setRows] = useState<TechnicalTraceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [partialReasons, setPartialReasons] = useState<string[]>([]);
  const [detail, setDetail] = useState<TechnicalTraceDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<TechnicalTraceOperation>();
  const listRequest = useRef(0);

  useEffect(() => {
    const traceId = new URLSearchParams(window.location.search).get("trace_id")?.trim();
    if (traceId) void openTrace(traceId);
  }, []);

  useEffect(() => {
    void loadList(query, page);
  }, [page, query]);

  async function loadList(nextQuery: TechnicalTraceQuery, nextPage: number) {
    const request = ++listRequest.current;
    setLoading(true);
    setListError(false);
    try {
      const result = await listTechnicalTraces({
        ...nextQuery,
        limit: nextQuery.limit ?? defaultPageSize,
        page: nextPage,
        pageSize: nextQuery.limit ?? defaultPageSize,
      });
      if (request !== listRequest.current) return;
      setRows(result.entries);
      setTotal(result.total);
      setPartialReasons(result.partialReasons);
    } catch {
      if (request === listRequest.current) setListError(true);
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }

  async function openTrace(traceId: string) {
    setDetailLoading(true);
    setDetailError(false);
    setSelectedOperation(undefined);
    try {
      const result = await getTechnicalTrace(traceId);
      setDetail(result);
      window.history.replaceState({}, "", `${window.location.pathname}?trace_id=${encodeURIComponent(traceId)}`);
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetail(undefined);
    setSelectedOperation(undefined);
    window.history.replaceState({}, "", window.location.pathname);
  }

  const columns = useMemo<ColumnsType<TechnicalTraceSummary>>(() => [
    {
      dataIndex: "startedAt",
      key: "startedAt",
      render: (value?: string) => value ? new Date(value).toLocaleString() : "-",
      title: t("bknTrace.traceWorkspace.columns.startedAt"),
      width: 185,
    },
    {
      dataIndex: "traceId",
      key: "traceId",
      render: (value: string) => (
        <Button aria-label={value} className={styles.traceLink} onClick={() => void openTrace(value)} type="link">
          {value}
        </Button>
      ),
      title: "Trace ID",
      width: 245,
    },
    {
      dataIndex: "rootOperation",
      key: "rootOperation",
      render: (value: string | undefined, row) => (
        <span className={styles.rootCall}>
          <span>{value || "-"}</span>
          {row.rootService ? <small>{row.rootService}</small> : null}
        </span>
      ),
      title: t("bknTrace.traceWorkspace.columns.rootOperation"),
      width: 145,
    },
    {
      dataIndex: "agentName",
      key: "agentName",
      render: (_: string | undefined, row) => row.agentName || row.agentOrApp || "-",
      title: t("bknTrace.traceWorkspace.columns.agent"),
      width: 150,
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: string) => <StatusTag status={value} />,
      title: t("bknTrace.traceWorkspace.columns.status"),
      width: 110,
    },
    {
      dataIndex: "durationMs",
      key: "durationMs",
      render: (value?: number) => value === undefined ? "-" : `${value} ms`,
      title: t("bknTrace.traceWorkspace.columns.duration"),
      width: 110,
    },
    {
      dataIndex: "spanCount",
      key: "spanCount",
      render: (value: number, row) => row.spanCountStatus === "unavailable"
        ? t("bknTrace.traceWorkspace.spanUnavailable")
        : String(value),
      title: "Span",
      width: 125,
    },
  ], [t]);

  if (detailLoading) return <Skeleton active />;
  if (detailError) {
    return <Alert action={<Button onClick={closeDetail}>{t("bknTrace.traceWorkspace.back")}</Button>} message={t("bknTrace.traceWorkspace.detailFailed")} showIcon type="error" />;
  }
  if (detail) {
    return (
      <TraceDetail
        detail={detail}
        onBack={closeDetail}
        onCloseOperation={() => setSelectedOperation(undefined)}
        onSelectOperation={setSelectedOperation}
        selectedOperation={selectedOperation}
      />
    );
  }

  return (
    <section className={`${styles.workspace} ${styles.pageSurface}`}>
      <header className={styles.pageHeader}>
        <div>
          <Typography.Title level={2}>{t("bknTrace.traceAnalysis.title")}</Typography.Title>
          <Typography.Paragraph type="secondary">{t("bknTrace.traceWorkspace.description")}</Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void loadList(query, page)}>{t("bknTrace.actions.refresh")}</Button>
      </header>

      <Form<TechnicalTraceFilterValues>
        className={styles.filters}
        form={form}
        initialValues={{}}
        layout="inline"
        onFinish={(values) => {
          setListState({
            page: 1,
            query: {
              ...values,
              from: toIsoDateTime(values.from),
              limit: defaultPageSize,
              to: toIsoDateTime(values.to),
            },
          });
        }}
      >
        <Form.Item name="traceId"><Input allowClear placeholder={t("bknTrace.traceWorkspace.filters.traceId")} /></Form.Item>
        <Form.Item name="service"><Input allowClear placeholder={t("bknTrace.traceWorkspace.filters.service")} /></Form.Item>
        <Form.Item name="tool"><Input allowClear placeholder={t("bknTrace.traceWorkspace.filters.tool")} /></Form.Item>
        <Form.Item name="status">
          <Select allowClear options={["completed", "failed", "running", "unknown"].map((value) => ({ label: value, value }))} placeholder={t("bknTrace.traceWorkspace.filters.status")} />
        </Form.Item>
        <Form.Item name="errorKeyword"><Input allowClear placeholder={t("bknTrace.traceWorkspace.filters.error")} /></Form.Item>
        <Form.Item name="from"><DatePicker aria-label={t("bknTrace.traceWorkspace.filters.from")} format="YYYY-MM-DD HH:mm" placeholder={t("bknTrace.traceWorkspace.filters.from")} showTime={{ format: "HH:mm", showSecond: false }} /></Form.Item>
        <Form.Item name="to"><DatePicker aria-label={t("bknTrace.traceWorkspace.filters.to")} format="YYYY-MM-DD HH:mm" placeholder={t("bknTrace.traceWorkspace.filters.to")} showTime={{ format: "HH:mm", showSecond: false }} /></Form.Item>
        <Button htmlType="submit" icon={<SearchOutlined />} type="primary">{t("bknTrace.actions.query")}</Button>
      </Form>

      {listError ? <Alert message={t("bknTrace.traceWorkspace.listFailed")} showIcon type="error" /> : null}
      {partialReasons.length ? <Alert description={partialReasons.join(" · ")} message={t("bknTrace.traceWorkspace.partial")} showIcon type="warning" /> : null}
      <div className={styles.tableCard}>
        <Table<TechnicalTraceSummary>
          columns={columns}
          dataSource={rows}
          loading={loading}
          locale={{ emptyText: <Empty description={t("bknTrace.traceWorkspace.empty")} /> }}
          pagination={false}
          rowKey="traceId"
          scroll={{ x: 1080 }}
          size="middle"
        />
        <Pagination
          current={page}
          onChange={(nextPage) => setListState((current) => ({ ...current, page: nextPage }))}
          pageSize={defaultPageSize}
          showSizeChanger={false}
          total={total}
        />
      </div>
    </section>
  );
}

function TraceDetail({
  detail,
  onBack,
  onCloseOperation,
  onSelectOperation,
  selectedOperation,
}: {
  detail: TechnicalTraceDetail;
  onBack: () => void;
  onCloseOperation: () => void;
  onSelectOperation: (operation: TechnicalTraceOperation) => void;
  selectedOperation?: TechnicalTraceOperation;
}) {
  const { t } = useTranslation();
  const summary = detail.summary;
  const diagnostics = buildDiagnostics(detail);
  const executionEvents = buildExecutionEvents(detail);
  return (
    <section className={`${styles.workspace} ${styles.pageSurface}`}>
      <Button className={styles.back} icon={<ArrowLeftOutlined />} onClick={onBack} type="text">
        {t("bknTrace.traceWorkspace.back")}
      </Button>
      <header className={styles.detailHeader}>
        <div>
          <Typography.Title level={2}>{t("bknTrace.traceWorkspace.detailTitle")}</Typography.Title>
          <Typography.Text type="secondary">{summary.traceId}</Typography.Text>
        </div>
        <StatusTag status={summary.status} />
      </header>

      <article className={styles.summaryCard}>
        <Descriptions column={4} size="small">
          <Descriptions.Item label={t("bknTrace.traceWorkspace.requestId")}>{summary.requestId || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.traceWorkspace.columns.agent")}>{summary.agentName || summary.agentOrApp || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.traceWorkspace.columns.duration")}>{summary.durationMs === undefined ? "-" : `${summary.durationMs} ms`}</Descriptions.Item>
          <Descriptions.Item label="Span">{summary.spanCountStatus === "unavailable" ? t("bknTrace.traceWorkspace.spanUnavailable") : summary.spanCount}</Descriptions.Item>
        </Descriptions>
        <div className={styles.summaryTextGrid}>
          <SummaryText label={t("bknTrace.traceWorkspace.question")} text={summary.questionPreview} />
          <SummaryText label={t("bknTrace.traceWorkspace.result")} text={summary.resultPreview} />
        </div>
      </article>

      {detail.partialReasons.length ? (
        <Alert className={styles.partialAlert} description={detail.partialReasons.join(" · ")} message={t("bknTrace.traceWorkspace.partial")} showIcon type="warning" />
      ) : null}

      {diagnostics.length ? (
        <article className={styles.diagnosticsCard}>
          <Typography.Title level={4}>{t("bknTrace.traceWorkspace.diagnostics.title")}</Typography.Title>
          <ul>{diagnostics.map((item) => <li key={item}>{t(`bknTrace.traceWorkspace.diagnostics.${item}`)}</li>)}</ul>
        </article>
      ) : null}

      <div className={`${styles.detailLayout} ${selectedOperation ? styles.detailLayoutOpen : ""}`}>
        <main className={styles.executionCard}>
          <div className={styles.sectionTitle}>
            <Typography.Title level={4}>{t("bknTrace.traceWorkspace.execution")}</Typography.Title>
            <Typography.Text type="secondary">{detail.operations.length} Operations · {detail.graph?.nodes.length ?? 0} Spans</Typography.Text>
          </div>
          <div className={styles.timeline}>
            <div className={styles.endpoint}><strong>{t("bknTrace.traceWorkspace.inputRecorded")}</strong><span>{formatTime(summary.startedAt)}</span></div>
            {executionEvents.map((event) => event.kind === "span" ? (
              <div className={styles.spanNode} key={`span-${event.value.spanId}`} style={{ marginInlineStart: event.depth * 14 }}>
                <span><strong>{event.value.name || event.value.spanId}</strong><small>{event.value.serviceName || "-"} · Span · {event.value.kind}</small></span>
                <span className={styles.operationState}><StatusTag status={event.value.status} /><small>{formatNanoDuration(event.value.durationNano)}</small></span>
              </div>
            ) : (
              <button
                aria-label={`${event.value.fact.toolName} ${event.value.fact.operationId}`}
                className={`${styles.operationNode} ${operationKey(selectedOperation) === operationKey(event.value) ? styles.operationNodeActive : ""}`}
                key={`operation-${operationKey(event.value)}`}
                onClick={() => onSelectOperation(event.value)}
                style={{ marginInlineStart: event.depth * 14 }}
                type="button"
              >
                <span>
                  <strong>{event.value.fact.toolName || t("bknTrace.traceWorkspace.unknownOperation")}</strong>
                  <small>{event.value.fact.sourceModule} · {event.value.fact.protocol.toUpperCase()} · {t("bknTrace.traceWorkspace.attempt", { attempt: event.value.fact.attempt })}</small>
                </span>
                <span className={styles.operationState}><StatusTag status={event.value.state} /><small>{operationDuration(event.value)}</small></span>
              </button>
            ))}
            <div className={styles.endpoint}><strong>{t("bknTrace.traceWorkspace.outputRecorded")}</strong><span>{formatTime(summary.completedAt)}</span></div>
          </div>
          {!detail.operations.length ? <Empty description={t("bknTrace.traceWorkspace.noOperations")} /> : null}
        </main>

        {selectedOperation ? (
          <OperationPanel key={operationKey(selectedOperation)} onClose={onCloseOperation} operation={selectedOperation} traceId={summary.traceId} />
        ) : null}
      </div>
    </section>
  );
}

function OperationPanel({ onClose, operation, traceId }: { onClose: () => void; operation: TechnicalTraceOperation; traceId: string }) {
  const { t } = useTranslation();
  const items = [
    { children: <PayloadView interactionId={operation.fact.interactionId} payload={operation.fact.input} />, key: "input", label: t("bknTrace.traceWorkspace.input") },
    { children: <PayloadView interactionId={operation.fact.interactionId} payload={operation.fact.output} />, key: "output", label: t("bknTrace.traceWorkspace.output") },
    { children: <PayloadView interactionId={operation.fact.interactionId} payload={operation.fact.error} />, key: "error", label: t("bknTrace.traceWorkspace.error") },
  ];
  return (
    <aside className={styles.operationPanel}>
      <header>
        <div><Typography.Title level={4}>{operation.fact.toolName}</Typography.Title><Typography.Text type="secondary">{t("bknTrace.traceWorkspace.callDetail")}</Typography.Text></div>
        <Button aria-label={t("bknTrace.traceWorkspace.closeDetail")} icon={<CloseOutlined />} onClick={onClose} type="text" />
      </header>
      <Descriptions column={1} size="small">
        <Descriptions.Item label={t("bknTrace.traceWorkspace.operationId")}>{operation.fact.operationId}</Descriptions.Item>
        <Descriptions.Item label={t("bknTrace.traceWorkspace.requestId")}>{operation.fact.requestId || "-"}</Descriptions.Item>
        <Descriptions.Item label={t("bknTrace.traceWorkspace.source")}>{operation.fact.sourceModule} · {operation.fact.protocol.toUpperCase()}</Descriptions.Item>
        <Descriptions.Item label={t("bknTrace.traceWorkspace.state")}>{t("bknTrace.traceWorkspace.stateWithAttempt", { attempt: operation.fact.attempt, state: operation.state })}</Descriptions.Item>
        <Descriptions.Item label={t("bknTrace.traceWorkspace.startedAt")}>{operation.fact.startedAt || "-"}</Descriptions.Item>
      </Descriptions>
      <Tabs items={items} />
      <Button href={buildAppPath(`/observability/logs?trace_id=${encodeURIComponent(traceId)}`)}>{t("bknTrace.actions.viewLogs")}</Button>
    </aside>
  );
}

function PayloadView({ interactionId, payload }: { interactionId: string; payload?: PayloadEnvelope }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  if (!payload) return <Empty description={t("bknTrace.traceWorkspace.notRecorded")} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  if (payload.mode === "referenced") {
    if (loaded !== undefined) return <InlinePayload value={loaded} />;
    return (
      <Alert
        action={(
          <Button
            loading={loading}
            onClick={() => {
              void (async () => {
                if (!payload.ref) return;
                setLoading(true);
                setLoadFailed(false);
                try {
                  setLoaded(await getReferencedPayload(payload.ref, interactionId));
                } catch {
                  setLoadFailed(true);
                } finally {
                  setLoading(false);
                }
              })();
            }}
            size="small"
          >
            {t("bknTrace.traceWorkspace.loadReferencedPayload")}
          </Button>
        )}
        description={loadFailed ? t("bknTrace.traceWorkspace.referencedPayloadFailed") : payload.ref}
        message={t("bknTrace.traceWorkspace.referencedPayload")}
        showIcon
        type={loadFailed ? "error" : "info"}
      />
    );
  }
  if (payload.mode === "omitted") {
    return <Alert description={payload.omittedReason || "unknown"} message={t("bknTrace.traceWorkspace.omittedPayload")} showIcon type="warning" />;
  }
  return <InlinePayload value={payload.inline} />;
}

function InlinePayload({ value }: { value: unknown }) {
  const { t } = useTranslation();
  const content = JSON.stringify(value, null, 2) ?? "null";
  return (
    <div className={styles.payloadBlock}>
      <Button icon={<CopyOutlined />} onClick={() => void navigator.clipboard?.writeText(content)} size="small">
        {t("bknTrace.traceWorkspace.copy")}
      </Button>
      <pre className={styles.payload}>{content}</pre>
    </div>
  );
}

function SummaryText({ label, text }: { label: string; text?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  const content = text || "-";
  const button = <button className={styles.clampedText} onClick={() => setOpen(true)} ref={ref} type="button">{content}</button>;
  return (
    <div className={styles.summaryText}>
      <span>{label}</span>
      {overflow ? <Tooltip mouseEnterDelay={0.3} placement="bottomLeft" title={content}>{button}</Tooltip> : button}
      <Modal
        footer={(
          <Button icon={<CopyOutlined />} onClick={() => void navigator.clipboard?.writeText(content)}>
            {t("bknTrace.traceWorkspace.copyFullText")}
          </Button>
        )}
        onCancel={() => setOpen(false)}
        open={open}
        title={label}
      >
        <pre className={styles.fullText}>{content}</pre>
      </Modal>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const color = status === "completed" || status === "ok" ? "green" : status === "failed" || status === "error" || status === "missing_terminal" ? "red" : "blue";
  return <Tag color={color}>{status}</Tag>;
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString() : "-";
}

function operationDuration(operation: TechnicalTraceOperation) {
  if (!operation.fact.startedAt || !operation.fact.finishedAt) return "-";
  const duration = Date.parse(operation.fact.finishedAt) - Date.parse(operation.fact.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? `${duration} ms` : "-";
}

function operationKey(operation?: TechnicalTraceOperation) {
  return operation ? `${operation.fact.operationId}-${operation.fact.attempt}` : "";
}

function formatNanoDuration(durationNano: number) {
  return durationNano > 0 ? `${Math.round(durationNano / 1_000_000)} ms` : "-";
}

function buildDiagnostics(detail: TechnicalTraceDetail) {
  const diagnostics = new Set<string>();
  if (detail.summary.spanCountStatus === "unavailable" || detail.partialReasons.includes("span_unavailable")) {
    diagnostics.add("spanUnavailable");
  }
  if (detail.operations.some((operation) => operation.state === "missing_terminal")) {
    diagnostics.add("missingTerminal");
  }
  if (detail.operations.some((operation) => operation.state === "failed" || operation.fact.status === "failed")) {
    diagnostics.add("operationFailed");
  }
  return [...diagnostics];
}

type TechnicalTraceFilterValues = Omit<TechnicalTraceQuery, "from" | "to"> & {
  from?: Dayjs;
  to?: Dayjs;
};

function toIsoDateTime(value?: Dayjs) {
  return value?.isValid() ? value.toISOString() : undefined;
}

type ExecutionEvent =
  | { depth: number; kind: "operation"; startedAt: number; value: TechnicalTraceOperation }
  | { depth: number; kind: "span"; startedAt: number; value: TechnicalSpanNode };

function buildExecutionEvents(detail: TechnicalTraceDetail): ExecutionEvent[] {
  const spans = detail.graph?.nodes ?? [];
  const operations = detail.operations;
  const spanById = new Map(spans.map((span) => [span.spanId, span]));
  const operationById = new Map(operations.map((operation) => [operation.fact.operationId, operation]));
  const spanDepth = (span: TechnicalSpanNode) => {
    let result = 0;
    const visited = new Set<string>();
    let parentId = span.parentSpanId;
    while (parentId && spanById.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      parentId = spanById.get(parentId)?.parentSpanId;
      result += 1;
    }
    return result;
  };
  const operationDepth = (operation: TechnicalTraceOperation) => {
    let result = 0;
    const visited = new Set<string>();
    let parentId = operation.fact.parentOperationId;
    while (parentId && operationById.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      parentId = operationById.get(parentId)?.fact.parentOperationId;
      result += 1;
    }
    return result;
  };
  const events: ExecutionEvent[] = [
    ...spans.map((span) => ({
      depth: spanDepth(span),
      kind: "span" as const,
      startedAt: span.startNano / 1_000_000,
      value: span,
    })),
    ...operations.map((operation) => ({
      depth: operationDepth(operation),
      kind: "operation" as const,
      startedAt: Date.parse(operation.fact.startedAt),
      value: operation,
    })),
  ];
  return events.sort((left, right) => left.startedAt - right.startedAt || left.kind.localeCompare(right.kind));
}
