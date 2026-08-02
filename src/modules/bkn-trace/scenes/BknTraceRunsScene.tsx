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
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "@/modules/bkn-trace/scenes/BknTraceRunsScene.module.css";
import {
  getBusinessGraph,
  getConversationSummaries,
  getEvidenceArtifact,
  getEvidenceChain,
  getInteractionSummary,
  getInteractionSummaries,
  getRequestSummaries,
  getRequestSummary,
  getRequestTraces,
  getSnapshotPreview,
  getTraceGraph,
  type BusinessGraph,
  type ConversationSummary,
  type EvidenceArtifact,
  type EvidenceChain,
  type InteractionSummary,
  type InteractionListSummary,
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
  businessGraph?: BusinessGraph;
  evidenceChain?: EvidenceChain;
  interaction?: InteractionSummary;
  snapshotPreview?: SnapshotPreview;
  summary: RequestSummary;
  traces: SummaryPage<TraceExecutionSummary>;
};

type ProvenanceView = "conversations" | "interactions" | "requests";

type ProvenanceListRow = {
  agentOrApp?: string;
  conversationId?: string;
  durationMs?: number;
  evidenceCompleteness: string;
  id: string;
  interactionCount?: number;
  interactionId?: string;
	operationId?: string;
	operationLabel?: string;
  questionPreview?: string;
  requestCount?: number;
  requestId?: string;
  resultPreview?: string;
  startedAt?: string;
  status: string;
};

export function BknTraceRunsScene() {
  const { t } = useTranslation();

  const [initialState] = useState(initialProvenanceState);
  const [view, setView] = useState<ProvenanceView>(initialState.view);
  const [keyword, setKeyword] = useState(initialState.query.keyword ?? "");
  const [status, setStatus] = useState<string | undefined>(initialState.query.status);
  const [agentOrApp, setAgentOrApp] = useState(initialState.query.agentOrApp ?? "");
  const [businessDomain, setBusinessDomain] = useState(initialState.query.businessDomain ?? "");
  const [knowledgeNetwork, setKnowledgeNetwork] = useState(initialState.query.knowledgeNetwork ?? "");
  const [evidenceCompleteness, setEvidenceCompleteness] = useState<string | undefined>(initialState.query.evidenceCompleteness);
  const [from, setFrom] = useState<string | undefined>(initialState.query.from);
  const [to, setTo] = useState<string | undefined>(initialState.query.to);
  const [activeQuery, setActiveQuery] = useState<RequestSummaryQuery>(initialState.query);
  const [page, setPage] = useState<SummaryPage<ProvenanceListRow>>();
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [detail, setDetail] = useState<RequestDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const detailRequestSequence = useRef(0);
  const provenanceRequestSequence = useRef(0);

  const loadProvenance = useCallback(async (
    targetView: ProvenanceView,
    query: RequestSummaryQuery = {},
    append = false,
  ) => {
    const requestSequence = ++provenanceRequestSequence.current;
    setLoading(true);
    setError(undefined);
    try {
      const request = {
        ...query,
        limit: 30,
      };
      const result = targetView === "conversations"
        ? mapProvenancePage(await getConversationSummaries(request), mapConversationRow)
        : targetView === "interactions"
          ? mapProvenancePage(await getInteractionSummaries(request), mapInteractionRow)
          : mapProvenancePage(await getRequestSummaries(request), (entry) => mapRequestRow(entry, t));
      if (requestSequence !== provenanceRequestSequence.current) return;
      setPage((current) =>
        append && current
          ? {
              ...result,
              entries: uniqueProvenanceRows([...current.entries, ...result.entries]),
            }
          : result
      );
    } catch (caught: unknown) {
      if (requestSequence === provenanceRequestSequence.current) {
        setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
      }
    } finally {
      if (requestSequence === provenanceRequestSequence.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadProvenance(initialState.view, initialState.query);
  }, [initialState, loadProvenance]);

  function currentQuery(): RequestSummaryQuery {
    return {
	  ...(view !== "conversations" && activeQuery.conversationId
		? { conversationId: activeQuery.conversationId }
		: {}),
	  ...(view === "requests" && activeQuery.interactionId
		? { interactionId: activeQuery.interactionId }
		: {}),
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
    syncProvenanceURL(view, query);
    void loadProvenance(view, query);
  }

  function changeView(nextView: ProvenanceView) {
	const query = currentQuery();
	if (nextView === "conversations") {
	  delete query.conversationId;
	  delete query.interactionId;
	} else if (nextView === "interactions") {
	  delete query.interactionId;
	}
	setView(nextView);
	setActiveQuery(query);
	setPage(undefined);
	syncProvenanceURL(nextView, query);
	void loadProvenance(nextView, query);
  }

  function openProvenanceRow(row: ProvenanceListRow) {
	if (view === "conversations" && row.conversationId) {
	  const query = { ...currentQuery(), conversationId: row.conversationId };
	  setView("interactions");
	  setActiveQuery(query);
	  setPage(undefined);
	  syncProvenanceURL("interactions", query);
	  void loadProvenance("interactions", query);
	  return;
	}
	if (view === "interactions" && row.interactionId) {
	  const query = {
		...currentQuery(),
		conversationId: row.conversationId ?? activeQuery.conversationId,
		interactionId: row.interactionId,
	  };
	  setView("requests");
	  setActiveQuery(query);
	  setPage(undefined);
	  syncProvenanceURL("requests", query);
	  void loadProvenance("requests", query);
	  return;
	}
	if (row.requestId) {
	  void openRequest(row.requestId);
	}
  }

  async function openRequest(requestId: string) {
    const requestSequence = ++detailRequestSequence.current;
    setSelectedRequestId(requestId);
    setLoading(true);
    setError(undefined);
    try {
      const scope = { limit: 100, requestId } as const;
      const summary = await getRequestSummary(requestId);
      const [tracesResult, evidenceChainResult, businessGraphResult, snapshotResult, interactionResult] =
        await Promise.allSettled([
          getRequestTraces(requestId, { limit: 100 }),
          getEvidenceChain(scope),
          getBusinessGraph(scope),
          getSnapshotPreview(scope),
          summary.interactionId
            ? getInteractionSummary(summary.interactionId)
            : Promise.resolve(undefined),
        ]);
      const traces = settledValue(tracesResult) ?? emptySummaryPage<TraceExecutionSummary>();
      const evidenceChain = settledValue(evidenceChainResult);
      const businessGraph = settledValue(businessGraphResult);
      const snapshotPreview = settledValue(snapshotResult);
      const interaction = settledValue(interactionResult);
      const artifactIds = [...new Set(
        (evidenceChain?.data.artifactLinks ?? [])
          .map((link) => artifactId(link.artifactRef))
          .filter((value): value is string => Boolean(value)),
      )];
      const artifactResults = await Promise.allSettled(
        artifactIds.map((id) => getEvidenceArtifact(id)),
      );
      const artifacts = artifactResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );
      if (requestSequence !== detailRequestSequence.current) return;
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
      if (requestSequence === detailRequestSequence.current) {
        setDetail(undefined);
        setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
      }
    } finally {
      if (requestSequence === detailRequestSequence.current) setLoading(false);
    }
  }

  const columns: ColumnsType<ProvenanceListRow> = [
    {
      dataIndex: "startedAt",
      key: "startedAt",
      render: (value?: string) => formatTime(value),
      title: t("bknTrace.fields.startedAt"),
      width: 170,
    },
    {
      dataIndex: view === "requests" ? "operationLabel" : "questionPreview",
      key: view === "requests" ? "operationLabel" : "questionPreview",
      render: (value: string | undefined, row) => (
        <Button
          className={styles.questionButton}
          onClick={() => openProvenanceRow(row)}
          type="link"
        >
          {value || row.id}
        </Button>
      ),
      title: t(view === "requests" ? "bknTrace.fields.operation" : "bknTrace.fields.question"),
    },
	...(view !== "requests" ? [{
	  dataIndex: view === "conversations" ? "interactionCount" : "requestCount",
	  key: "childCount",
	  title: view === "conversations"
		? t("bknTrace.fields.interactionCount")
		: t("bknTrace.fields.requestCount"),
	  width: 120,
	}] as ColumnsType<ProvenanceListRow> : []),
    {
      dataIndex: "resultPreview",
      key: "resultPreview",
      render: (value?: string) => value || "-",
      title: t(view === "requests" ? "bknTrace.fields.operationResult" : "bknTrace.fields.result"),
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
            <Descriptions.Item label={t("bknTrace.fields.operation")}>
              {operationLabel(detail.summary, t)}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.fields.operationId")}>
              {detail.summary.operationId || "-"}
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
                children: detail.businessGraph
                  ? (
					  <BusinessExplanation
						artifacts={detail.artifacts}
						fallbackQuestion={detail.summary.questionPreview}
						fallbackResult={detail.summary.resultPreview}
						graph={detail.businessGraph}
					  />
					)
                  : <Empty description={t("bknTrace.emptyStates.businessNodes")} />,
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
	  <div className={styles.viewNavigation}>
		<Segmented<ProvenanceView>
		  onChange={changeView}
		  options={[
			{ label: t("bknTrace.views.conversations"), value: "conversations" },
			{ label: t("bknTrace.views.interactions"), value: "interactions" },
			{ label: t("bknTrace.views.requests"), value: "requests" },
		  ]}
		  value={view}
		/>
		<Space wrap>
		  {activeQuery.conversationId ? (
			<Tag closable onClose={() => changeView("conversations")}>
			  {t("bknTrace.fields.conversationId")}: {activeQuery.conversationId}
			</Tag>
		  ) : null}
		  {activeQuery.interactionId ? (
			<Tag closable onClose={() => changeView("interactions")}>
			  {t("bknTrace.fields.interactionId")}: {activeQuery.interactionId}
			</Tag>
		  ) : null}
		</Space>
	  </div>
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
		  value={toLocalDateTimeInput(from)}
        />
        <Input
          aria-label={t("bknTrace.placeholders.timeTo")}
          onChange={(event) => setTo(toRFC3339(event.target.value))}
          type="datetime-local"
		  value={toLocalDateTimeInput(to)}
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
	  {page?.partial || page?.truncated ? (
		<Alert
		  description={page.partialReasons.length ? page.partialReasons.join(", ") : undefined}
		  message={t("bknTrace.partial")}
		  showIcon
		  type="warning"
		/>
	  ) : null}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={page?.entries ?? []}
          locale={{ emptyText: <Empty description={t("bknTrace.emptyStates.runs")} /> }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1180 }}
          size="middle"
        />
        {page?.nextCursor ? (
          <div className={styles.loadMore}>
            <Button
              onClick={() =>
                void loadProvenance(
				  view,
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
	fallbackQuestion,
	fallbackResult,
  graph,
}: {
  artifacts: EvidenceArtifact[];
	fallbackQuestion?: string;
	fallbackResult?: string;
  graph: BusinessGraph;
}) {
  const { t } = useTranslation();
  const stages = businessStoryStages(graph.data.nodes);
	const question = artifacts.find((artifact) => artifact.artifactType === "question")?.content ?? fallbackQuestion;
	const result = artifacts.find((artifact) => artifact.artifactType === "result")?.content ?? fallbackResult;
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
			  )) : stage.stage === "intent" && question ? (
				<ArtifactContent content={question} />
			  ) : stage.stage === "claim" && result ? (
				<ArtifactContent content={result} />
			  ) : <Typography.Text type="secondary">-</Typography.Text>}
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
  chain?: EvidenceChain;
  snapshot?: SnapshotPreview;
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
        {chain?.visibilitySummary.authorizedRefCount ?? "-"}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.visibility.unresolved")}>
        {chain?.visibilitySummary.unresolvedRefCount ?? "-"}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.fields.snapshotId")}>
        {snapshot?.snapshotRef.snapshotId || "-"}
      </Descriptions.Item>
      <Descriptions.Item label={t("bknTrace.fields.mode")}>
        {snapshot?.snapshotRef.mode || "-"}
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

function toLocalDateTimeInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initialProvenanceState(): { query: RequestSummaryQuery; view: ProvenanceView } {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  const view: ProvenanceView = requestedView === "interactions" || requestedView === "requests"
    ? requestedView
    : "conversations";
  const conversationId = params.get("conversation_id")?.trim();
  const interactionId = params.get("interaction_id")?.trim();
	const read = (name: string) => params.get(name)?.trim() || undefined;
  return {
    query: {
	  ...(read("agent_or_app") ? { agentOrApp: read("agent_or_app") } : {}),
	  ...(read("business_domain") ? { businessDomain: read("business_domain") } : {}),
      ...(conversationId ? { conversationId } : {}),
	  ...(read("evidence_completeness") ? { evidenceCompleteness: read("evidence_completeness") } : {}),
	  ...(read("from") ? { from: read("from") } : {}),
      ...(interactionId ? { interactionId } : {}),
	  ...(read("keyword") ? { keyword: read("keyword") } : {}),
	  ...(read("knowledge_network") ? { knowledgeNetwork: read("knowledge_network") } : {}),
	  ...(read("status") ? { status: read("status") } : {}),
	  ...(read("to") ? { to: read("to") } : {}),
    },
    view,
  };
}

function syncProvenanceURL(view: ProvenanceView, query: RequestSummaryQuery) {
  const params = new URLSearchParams();
  if (view !== "conversations") params.set("view", view);
  if (query.conversationId) params.set("conversation_id", query.conversationId);
  if (query.interactionId) params.set("interaction_id", query.interactionId);
  if (query.keyword) params.set("keyword", query.keyword);
	if (query.from) params.set("from", query.from);
	if (query.to) params.set("to", query.to);
	if (query.status) params.set("status", query.status);
	if (query.agentOrApp) params.set("agent_or_app", query.agentOrApp);
	if (query.businessDomain) params.set("business_domain", query.businessDomain);
	if (query.knowledgeNetwork) params.set("knowledge_network", query.knowledgeNetwork);
	if (query.evidenceCompleteness) params.set("evidence_completeness", query.evidenceCompleteness);
  const suffix = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}`);
}

function mapProvenancePage<T>(
  page: SummaryPage<T>,
  mapEntry: (entry: T) => ProvenanceListRow,
): SummaryPage<ProvenanceListRow> {
  return { ...page, entries: page.entries.map(mapEntry) };
}

function mapConversationRow(summary: ConversationSummary): ProvenanceListRow {
  return {
    agentOrApp: summary.agentOrApp,
    conversationId: summary.conversationId,
    durationMs: summary.durationMs,
    evidenceCompleteness: summary.evidenceCompleteness,
    id: summary.conversationId,
    interactionCount: summary.interactionCount,
    questionPreview: summary.questionPreview,
    requestCount: summary.requestCount,
    resultPreview: summary.resultPreview,
    startedAt: summary.startedAt,
    status: summary.status,
  };
}

function mapInteractionRow(summary: InteractionListSummary): ProvenanceListRow {
  return {
    agentOrApp: summary.agentOrApp,
    conversationId: summary.conversationId,
    durationMs: summary.durationMs,
    evidenceCompleteness: summary.evidenceCompleteness,
    id: summary.interactionId,
    interactionId: summary.interactionId,
    questionPreview: summary.questionPreview,
    requestCount: summary.requestCount,
    resultPreview: summary.resultPreview,
    startedAt: summary.startedAt,
    status: summary.status,
  };
}

function mapRequestRow(
  summary: RequestSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
): ProvenanceListRow {
  return {
    agentOrApp: summary.agentOrApp,
    conversationId: summary.conversationId,
    durationMs: summary.durationMs,
    evidenceCompleteness: summary.evidenceCompleteness,
    id: summary.operationId || summary.requestId,
    interactionId: summary.interactionId,
    operationId: summary.operationId,
    operationLabel: operationLabel(summary, t),
    questionPreview: summary.questionPreview,
    requestId: summary.requestId,
    resultPreview: operationResult(summary, t),
    startedAt: summary.startedAt,
    status: summary.status,
  };
}

function operationLabel(
  summary: RequestSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const standardLabels: Record<string, string> = {
    run_sql: "bknTrace.operations.runSql",
    search_schema: "bknTrace.operations.searchSchema",
  };
  const key = summary.toolName ? standardLabels[summary.toolName] : undefined;
  return key ? t(key) : summary.toolName || summary.operationKey || summary.questionPreview || summary.requestId;
}

function operationResult(
  summary: RequestSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return t(`bknTrace.operationResults.${summary.status}`, { count: summary.businessRefs.length });
}

function settledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : undefined;
}

function emptySummaryPage<T>(): SummaryPage<T> {
  return {
    entries: [],
    partial: true,
    partialReasons: ["content_unavailable"],
    total: 0,
    truncated: false,
  };
}

function uniqueProvenanceRows(rows: ProvenanceListRow[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function statusColor(value: string) {
  if (value === "completed" || value === "ok") return "green";
  if (value === "error") return "red";
  if (value === "running") return "blue";
  return "default";
}
