/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ArrowLeftOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "@/modules/bkn-trace/scenes/BknTraceRunsScene.module.css";
import {
  getBusinessGraph,
  getEvidenceArtifact,
  getEvidenceChain,
  getInteractionSummary,
  getRequestSummaries,
  getRequestSummary,
  getRequestTraces,
  getSnapshotPreview,
  getTraceGraph,
  type BusinessGraph,
  type EvidenceArtifact,
  type EvidenceChain,
  type InteractionSummary,
  type RequestSummaryQuery,
  type RequestSummary,
  type SnapshotPreview,
  type SummaryPage,
  type TraceExecutionSummary,
  type TraceGraph,
  type TraceGraphNode,
} from "@/modules/bkn-trace/services/trace.service";
import {
  businessStoryStages,
  businessNodePresentation,
} from "@/modules/bkn-trace/utils/trace-explainability";

type RequestDetail = {
  artifacts: EvidenceArtifact[];
  businessGraph: BusinessGraph;
  evidenceChain: EvidenceChain;
  interaction?: InteractionSummary;
  snapshotPreview: SnapshotPreview;
  summary: RequestSummary;
  traces: SummaryPage<TraceExecutionSummary>;
};

export function BknTraceRunsScene() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>();
  const [agentOrApp, setAgentOrApp] = useState("");
  const [businessDomain, setBusinessDomain] = useState("");
  const [knowledgeNetwork, setKnowledgeNetwork] = useState("");
  const [evidenceCompleteness, setEvidenceCompleteness] = useState<string>();
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const [activeQuery, setActiveQuery] = useState<RequestSummaryQuery>({});
  const [page, setPage] = useState<SummaryPage<RequestSummary>>();
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [detail, setDetail] = useState<RequestDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const loadRequests = useCallback(async (
    query: RequestSummaryQuery = {},
    append = false,
  ) => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await getRequestSummaries({
        ...query,
        limit: 30,
      });
      setPage((current) =>
        append && current
          ? {
              ...result,
              entries: uniqueRequests([...current.entries, ...result.entries]),
            }
          : result
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function currentQuery(): RequestSummaryQuery {
    return {
      ...(agentOrApp.trim() ? { agentOrApp: agentOrApp.trim() } : {}),
      ...(businessDomain.trim() ? { businessDomain: businessDomain.trim() } : {}),
      ...(evidenceCompleteness ? { evidenceCompleteness } : {}),
      ...(from ? { from } : {}),
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      ...(knowledgeNetwork.trim() ? { knowledgeNetwork: knowledgeNetwork.trim() } : {}),
      ...(status ? { status } : {}),
      ...(to ? { to } : {}),
    };
  }

  function searchRequests() {
    const query = currentQuery();
    setActiveQuery(query);
    void loadRequests(query);
  }

  async function openRequest(requestId: string) {
    setSelectedRequestId(requestId);
    setLoading(true);
    setError(undefined);
    try {
      const scope = { limit: 100, requestId } as const;
      const summary = await getRequestSummary(requestId);
      const [traces, evidenceChain, businessGraph, snapshotPreview, interaction] =
        await Promise.all([
          getRequestTraces(requestId, { limit: 100 }),
          getEvidenceChain(scope),
          getBusinessGraph(scope),
          getSnapshotPreview(scope),
          summary.interactionId
            ? getInteractionSummary(summary.interactionId)
            : Promise.resolve(undefined),
        ]);
      const artifactIds = [...new Set(
        evidenceChain.data.artifactLinks
          .map((link) => artifactId(link.artifactRef))
          .filter((value): value is string => Boolean(value)),
      )];
      const artifactResults = await Promise.allSettled(
        artifactIds.map((id) => getEvidenceArtifact(id)),
      );
      const artifacts = artifactResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );
      setDetail({
        artifacts,
        businessGraph,
        evidenceChain,
        interaction,
        snapshotPreview,
        summary,
        traces,
      });
    } catch (caught: unknown) {
      setDetail(undefined);
      setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
    } finally {
      setLoading(false);
    }
  }

  const columns: ColumnsType<RequestSummary> = [
    {
      dataIndex: "startedAt",
      key: "startedAt",
      render: (value?: string) => formatTime(value),
      title: t("bknTrace.fields.startedAt"),
      width: 170,
    },
    {
      dataIndex: "questionPreview",
      key: "questionPreview",
      render: (value: string | undefined, row) => (
        <Button
          className={styles.questionButton}
          onClick={() => void openRequest(row.requestId)}
          type="link"
        >
          {value || row.requestId}
        </Button>
      ),
      title: t("bknTrace.fields.question"),
    },
    {
      dataIndex: "resultPreview",
      key: "resultPreview",
      render: (value?: string) => value || "-",
      title: t("bknTrace.fields.result"),
    },
    {
      dataIndex: "agentOrApp",
      key: "agentOrApp",
      title: t("bknTrace.fields.agentOrApp"),
      width: 150,
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
      title: t("bknTrace.fields.status"),
      width: 110,
    },
    {
      dataIndex: "evidenceCompleteness",
      key: "evidenceCompleteness",
      render: (value: string) => (
        <Tag color={value === "complete" ? "green" : "orange"}>{value}</Tag>
      ),
      title: t("bknTrace.fields.evidenceCompleteness"),
      width: 150,
    },
    {
      dataIndex: "durationMs",
      key: "durationMs",
      render: (value?: number) => value === undefined ? "-" : `${value} ms`,
      title: t("bknTrace.fields.duration"),
      width: 110,
    },
  ];

  if (selectedRequestId && detail) {
    return (
      <Spin spinning={loading}>
        <div className={styles.detail}>
          <header className={styles.detailHeader}>
            <Button
              aria-label={t("bknTrace.actions.back")}
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                setSelectedRequestId(undefined);
                setDetail(undefined);
              }}
              type="text"
            />
            <div>
              <Typography.Title level={4}>{t("bknTrace.sections.requestDetail")}</Typography.Title>
              <Typography.Text type="secondary">{detail.summary.requestId}</Typography.Text>
            </div>
            <Space className={styles.detailStatus}>
              <Tag color={statusColor(detail.summary.status)}>{detail.summary.status}</Tag>
              <Tag color={detail.summary.evidenceCompleteness === "complete" ? "green" : "orange"}>
                {detail.summary.evidenceCompleteness}
              </Tag>
            </Space>
          </header>

          <Descriptions
            className={styles.identity}
            column={{ lg: 3, md: 1, sm: 1, xs: 1 }}
            size="small"
          >
            <Descriptions.Item label={t("bknTrace.fields.conversationId")}>
              {detail.summary.conversationId || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.fields.interactionId")}>
              {detail.summary.interactionId || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.fields.requestId")}>
              {detail.summary.requestId}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.fields.requestCount")}>
              {detail.interaction?.requests.length ?? 1}
            </Descriptions.Item>
          </Descriptions>

          <BusinessContent
            artifacts={detail.artifacts}
            fallbackQuestion={detail.summary.questionPreview}
            fallbackResult={detail.summary.resultPreview}
          />

          <Tabs
            items={[
              {
                children: <BusinessExplanation graph={detail.businessGraph} artifacts={detail.artifacts} />,
                key: "business",
                label: t("bknTrace.tabs.business"),
              },
              {
                children: (
                  <div className={styles.diagnostics}>
                    {detail.interaction ? (
                      <InteractionRequests requests={detail.interaction.requests} />
                    ) : null}
                    <TraceExecutions
                      traces={detail.interaction?.traces ?? detail.traces.entries}
                    />
                  </div>
                ),
                key: "diagnostics",
                label: t("bknTrace.tabs.diagnostics"),
              },
              {
                children: (
                  <Governance
                    chain={detail.evidenceChain}
                    snapshot={detail.snapshotPreview}
                    summary={detail.summary}
                  />
                ),
                key: "governance",
                label: t("bknTrace.tabs.governance"),
              },
            ]}
          />
        </div>
      </Spin>
    );
  }

  return (
    <div className={styles.scene}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <Typography.Title level={3}>{t("bknTrace.title")}</Typography.Title>
          <Typography.Text type="secondary">{t("bknTrace.runsDescription")}</Typography.Text>
        </div>
      </header>
      <div
        aria-label={t("bknTrace.title")}
        className={styles.filters}
        role="search"
      >
        <Input
          allowClear
          className={styles.keywordFilter}
          onChange={(event) => setKeyword(event.target.value)}
          onPressEnter={searchRequests}
          placeholder={t("bknTrace.placeholders.keyword")}
          prefix={<SearchOutlined />}
          value={keyword}
        />
        <Input
          aria-label={t("bknTrace.placeholders.timeFrom")}
          onChange={(event) => setFrom(toRFC3339(event.target.value))}
          type="datetime-local"
        />
        <Input
          aria-label={t("bknTrace.placeholders.timeTo")}
          onChange={(event) => setTo(toRFC3339(event.target.value))}
          type="datetime-local"
        />
        <Input
          allowClear
          onChange={(event) => setAgentOrApp(event.target.value)}
          placeholder={t("bknTrace.placeholders.agentOrApp")}
          value={agentOrApp}
        />
        <Input
          allowClear
          onChange={(event) => setBusinessDomain(event.target.value)}
          placeholder={t("bknTrace.placeholders.businessDomain")}
          value={businessDomain}
        />
        <Input
          allowClear
          onChange={(event) => setKnowledgeNetwork(event.target.value)}
          placeholder={t("bknTrace.placeholders.knowledgeNetwork")}
          value={knowledgeNetwork}
        />
        <Select
          allowClear
          onChange={setStatus}
          options={[
            { label: t("bknTrace.status.running"), value: "running" },
            { label: t("bknTrace.status.completed"), value: "completed" },
            { label: t("bknTrace.status.error"), value: "error" },
          ]}
          placeholder={t("bknTrace.placeholders.status")}
          value={status}
        />
        <Select
          allowClear
          onChange={setEvidenceCompleteness}
          options={[
            { label: t("bknTrace.completeness.complete"), value: "complete" },
            { label: t("bknTrace.completeness.partial"), value: "partial" },
            {
              label: t("bknTrace.completeness.contentUnavailable"),
              value: "content_unavailable",
            },
          ]}
          placeholder={t("bknTrace.placeholders.evidenceCompleteness")}
          value={evidenceCompleteness}
        />
        <Button
          icon={<SearchOutlined />}
          onClick={searchRequests}
          type="primary"
        >
          {t("bknTrace.actions.query")}
        </Button>
        <Button
          aria-label={t("bknTrace.actions.refresh")}
          icon={<ReloadOutlined />}
          onClick={searchRequests}
        />
      </div>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={page?.entries ?? []}
          locale={{ emptyText: <Empty description={t("bknTrace.emptyStates.runs")} /> }}
          pagination={false}
          rowKey="requestId"
          scroll={{ x: 1180 }}
          size="middle"
        />
        {page?.nextCursor ? (
          <div className={styles.loadMore}>
            <Button
              onClick={() =>
                void loadRequests(
                  { ...activeQuery, cursor: page.nextCursor },
                  true,
                )
              }
            >
              {t("bknTrace.actions.loadMore")}
            </Button>
          </div>
        ) : null}
      </Spin>
    </div>
  );
}

function InteractionRequests({ requests }: { requests: RequestSummary[] }) {
  const { t } = useTranslation();
  return (
    <section>
      <Typography.Title level={5}>{t("bknTrace.sections.interactionRequests")}</Typography.Title>
      <Table
        columns={[
          {
            dataIndex: "requestId",
            key: "requestId",
            title: t("bknTrace.fields.requestId"),
          },
          {
            dataIndex: "questionPreview",
            key: "questionPreview",
            render: (value?: string) => value || "-",
            title: t("bknTrace.fields.question"),
          },
          {
            dataIndex: "resultPreview",
            key: "resultPreview",
            render: (value?: string) => value || "-",
            title: t("bknTrace.fields.result"),
          },
          {
            dataIndex: "status",
            key: "status",
            render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
            title: t("bknTrace.fields.status"),
            width: 120,
          },
        ]}
        dataSource={requests}
        pagination={false}
        rowKey="requestId"
        scroll={{ x: 800 }}
        size="small"
      />
    </section>
  );
}

function BusinessContent({
  artifacts,
  fallbackQuestion,
  fallbackResult,
}: {
  artifacts: EvidenceArtifact[];
  fallbackQuestion?: string;
  fallbackResult?: string;
}) {
  const { t } = useTranslation();
  const question = artifacts.find((artifact) => artifact.artifactType === "question");
  const result = [...artifacts].reverse().find((artifact) => artifact.artifactType === "result");
  return (
    <div className={styles.businessContent}>
      <section>
        <Typography.Text type="secondary">{t("bknTrace.fields.question")}</Typography.Text>
        <ArtifactContent content={question?.content ?? fallbackQuestion} />
      </section>
      <section>
        <Typography.Text type="secondary">{t("bknTrace.fields.result")}</Typography.Text>
        <ArtifactContent content={result?.content ?? fallbackResult} />
      </section>
    </div>
  );
}

function BusinessExplanation({
  artifacts,
  graph,
}: {
  artifacts: EvidenceArtifact[];
  graph: BusinessGraph;
}) {
  const { t } = useTranslation();
  const stages = businessStoryStages(graph.data.nodes);
  const supportingArtifacts = artifacts.filter(
    (artifact) => !["question", "result"].includes(artifact.artifactType),
  );
  return (
    <div className={styles.explanation}>
      <section className={styles.semanticChain}>
        <Typography.Title level={5}>{t("bknTrace.sections.businessGraph")}</Typography.Title>
        <div className={styles.stageGrid}>
          {stages.map((stage) => (
            <div className={styles.stage} key={stage.stage}>
              <Typography.Text strong>{t(`bknTrace.stages.${stage.stage}`)}</Typography.Text>
              {stage.nodes.length ? stage.nodes.map((node) => (
                <div className={styles.node} key={node.id}>
                  <span className={styles.nodeTitle}>{businessNodePresentation(node).title}</span>
                  <Typography.Text type="secondary">{businessNodePresentation(node).subtitle}</Typography.Text>
                  <details className={styles.technicalDetails}>
                    <summary>{t("bknTrace.fields.technicalDetails")}</summary>
                    <Typography.Text copyable type="secondary">{businessNodePresentation(node).technicalId}</Typography.Text>
                    <Typography.Text type="secondary">{node.nodeType}</Typography.Text>
                  </details>
                </div>
              )) : <Typography.Text type="secondary">-</Typography.Text>}
            </div>
          ))}
        </div>
      </section>
      <section className={styles.artifactSection}>
        <Typography.Title level={5}>{t("bknTrace.sections.artifacts")}</Typography.Title>
        {supportingArtifacts.length ? supportingArtifacts.map((artifact) => (
          <div className={styles.artifact} key={artifact.artifactId}>
            <Space>
              <Tag>{artifact.artifactType}</Tag>
              <Typography.Text type="secondary">{artifact.observedAt}</Typography.Text>
            </Space>
            <ArtifactContent content={artifact.content} />
          </div>
        )) : <Empty description={t("bknTrace.emptyStates.artifacts")} />}
      </section>
    </div>
  );
}

function TraceExecutions({ traces }: { traces: TraceExecutionSummary[] }) {
  const { t } = useTranslation();
  const [graph, setGraph] = useState<TraceGraph>();
  const [loadingTraceId, setLoadingTraceId] = useState<string>();
  const [error, setError] = useState<string>();

  async function openTrace(traceId: string) {
    setLoadingTraceId(traceId);
    setError(undefined);
    try {
      setGraph(await getTraceGraph(traceId));
    } catch {
      setGraph(undefined);
      setError(t("bknTrace.emptyStates.traceGraph"));
    } finally {
      setLoadingTraceId(undefined);
    }
  }

  const columns: ColumnsType<TraceExecutionSummary> = [
    {
      dataIndex: "traceId",
      key: "traceId",
      render: (value: string) => (
        <Button
          loading={loadingTraceId === value}
          onClick={() => void openTrace(value)}
          type="link"
        >
          {value}
        </Button>
      ),
      title: t("bknTrace.fields.traceId"),
    },
    { dataIndex: "rootOperation", key: "rootOperation", title: t("bknTrace.fields.operation") },
    { dataIndex: "spanCount", key: "spanCount", title: t("bknTrace.metrics.spans"), width: 100 },
    {
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
      title: t("bknTrace.fields.status"),
      width: 120,
    },
    {
      dataIndex: "durationMs",
      key: "durationMs",
      render: (value?: number) => value === undefined ? "-" : `${value} ms`,
      title: t("bknTrace.fields.duration"),
      width: 120,
    },
  ];
  const spanColumns: ColumnsType<TraceGraphNode> = [
    { dataIndex: "name", key: "name", title: t("bknTrace.fields.span") },
    { dataIndex: "serviceName", key: "serviceName", title: t("bknTrace.fields.service") },
    { dataIndex: "kind", key: "kind", title: t("bknTrace.fields.kind"), width: 120 },
    {
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
      title: t("bknTrace.fields.status"),
      width: 120,
    },
    {
      dataIndex: "durationNano",
      key: "durationNano",
      render: (value: number) => `${Math.round(value / 1_000_000)} ms`,
      title: t("bknTrace.fields.duration"),
      width: 120,
    },
  ];
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <Table
        columns={columns}
        dataSource={traces}
        pagination={false}
        rowKey="traceId"
        size="small"
      />
      {graph ? (
        <Table
          columns={spanColumns}
          dataSource={graph.data.nodes}
          pagination={false}
          rowKey="spanId"
          size="small"
        />
      ) : null}
    </Space>
  );
}

function Governance({
  chain,
  snapshot,
  summary,
}: {
  chain: EvidenceChain;
  snapshot: SnapshotPreview;
  summary: RequestSummary;
}) {
  const { t } = useTranslation();
  return (
    <Descriptions bordered column={{ lg: 2, md: 1, sm: 1, xs: 1 }} size="small">
      <Descriptions.Item label={t("bknTrace.fields.evidenceCompleteness")}>
        {summary.evidenceCompleteness}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.fields.businessDomain")}>
        {summary.businessDomain || "-"}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.visibility.authorized")}>
        {chain.visibilitySummary.authorizedRefCount}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.visibility.unresolved")}>
        {chain.visibilitySummary.unresolvedRefCount}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.fields.snapshotId")}>
        {snapshot.snapshotRef.snapshotId || "-"}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.fields.mode")}>
        {snapshot.snapshotRef.mode}
      </Descriptions.Item>
    </Descriptions>
  );
}

function ArtifactContent({ content }: { content: unknown }) {
  if (content === undefined || content === null || content === "") {
    return <Typography.Text>-</Typography.Text>;
  }
  if (typeof content === "string") {
    return <Typography.Paragraph className={styles.contentText}>{content}</Typography.Paragraph>;
  }
  return <pre className={styles.contentJson}>{JSON.stringify(content, null, 2)}</pre>;
}

function artifactId(ref: string) {
  return ref.startsWith("artifact:") ? ref.slice("artifact:".length) : undefined;
}

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function toRFC3339(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function uniqueRequests(requests: RequestSummary[]) {
  return [...new Map(requests.map((request) => [request.requestId, request])).values()];
}

function statusColor(value: string) {
  if (value === "completed" || value === "ok") return "green";
  if (value === "error") return "red";
  if (value === "running") return "blue";
  return "default";
}
