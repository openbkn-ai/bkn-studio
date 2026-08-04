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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
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
import { formatDuration } from "@/modules/bkn-trace/utils/duration";

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
	agentName?: string;
	applicationPrincipalId?: string;
	effectiveSubjectId?: string;
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
  const durationLabels = useMemo(() => ({
    hour: t("bknTrace.durationUnits.hour"),
    millisecond: t("bknTrace.durationUnits.millisecond"),
    minute: t("bknTrace.durationUnits.minute"),
    second: t("bknTrace.durationUnits.second"),
  }), [t]);

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
	const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [page, setPage] = useState<SummaryPage<ProvenanceListRow>>();
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [detail, setDetail] = useState<RequestDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const detailRequestSequence = useRef(0);
  const provenanceRequestSequence = useRef(0);
  const deepLinkConsumed = useRef(false);

  const loadProvenance = useCallback(async (
    targetView: ProvenanceView,
    query: RequestSummaryQuery = {},
  ) => {
    const requestSequence = ++provenanceRequestSequence.current;
    setLoading(true);
    setError(undefined);
    try {
      const request = {
        ...query,
		page: query.page ?? 1,
		pageSize: query.pageSize ?? 20,
      };
      const result = targetView === "conversations"
        ? mapProvenancePage(await getConversationSummaries(request), mapConversationRow)
        : targetView === "interactions"
          ? mapProvenancePage(await getInteractionSummaries(request), mapInteractionRow)
          : mapProvenancePage(await getRequestSummaries(request), (entry) => mapRequestRow(entry, t));
      if (requestSequence !== provenanceRequestSequence.current) return;
		setPage(result);
    } catch (caught: unknown) {
      if (requestSequence === provenanceRequestSequence.current) {
        setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
      }
    } finally {
      if (requestSequence === provenanceRequestSequence.current) setLoading(false);
    }
  }, [t]);

  const openRequest = useCallback(async (requestId: string) => {
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
		setSelectedRequestId(undefined);
		syncProvenanceURL(view, activeQuery);
        setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
      }
    } finally {
      if (requestSequence === detailRequestSequence.current) setLoading(false);
    }
  }, [activeQuery, t, view]);

  useEffect(() => {
    void loadProvenance(initialState.view, { ...initialState.query, page: 1, pageSize: 20 });
  }, [initialState, loadProvenance]);

  useEffect(() => {
    if (deepLinkConsumed.current || !initialState.requestId) return;
    deepLinkConsumed.current = true;
    void openRequest(initialState.requestId);
  }, [initialState.requestId, openRequest]);

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
		abandonRequestDetail();
    const query = currentQuery();
		setPagination((current) => ({ ...current, page: 1 }));
    setActiveQuery(query);
    syncProvenanceURL(view, query);
    void loadProvenance(view, { ...query, page: 1, pageSize: pagination.pageSize });
  }

  function changeView(nextView: ProvenanceView) {
	abandonRequestDetail();
	const query = currentQuery();
	if (nextView === "conversations") {
	  delete query.conversationId;
	  delete query.interactionId;
	} else if (nextView === "interactions") {
	  delete query.interactionId;
	}
	setView(nextView);
	setPagination((current) => ({ ...current, page: 1 }));
	setActiveQuery(query);
	setPage(undefined);
	syncProvenanceURL(nextView, query);
	void loadProvenance(nextView, { ...query, page: 1, pageSize: pagination.pageSize });
  }

  function openProvenanceRow(row: ProvenanceListRow) {
	if (view === "conversations" && row.conversationId) {
	  abandonRequestDetail();
	  const query = { ...currentQuery(), conversationId: row.conversationId };
	  setView("interactions");
	  setPagination((current) => ({ ...current, page: 1 }));
	  setActiveQuery(query);
	  setPage(undefined);
	  syncProvenanceURL("interactions", query);
	  void loadProvenance("interactions", { ...query, page: 1, pageSize: pagination.pageSize });
	  return;
	}
	if (view === "interactions" && row.interactionId) {
	  abandonRequestDetail();
	  const query = {
		...currentQuery(),
		conversationId: row.conversationId ?? activeQuery.conversationId,
		interactionId: row.interactionId,
	  };
	  setView("requests");
	  setPagination((current) => ({ ...current, page: 1 }));
	  setActiveQuery(query);
	  setPage(undefined);
	  syncProvenanceURL("requests", query);
	  void loadProvenance("requests", { ...query, page: 1, pageSize: pagination.pageSize });
	  return;
	}
	if (row.requestId) {
	  syncProvenanceURL(view, currentQuery(), row.requestId);
	  void openRequest(row.requestId);
	}
  }

  function abandonRequestDetail() {
    // List navigation can race an in-flight detail request. Advancing the
    // sequence makes the abandoned request unable to overwrite the new view.
    detailRequestSequence.current += 1;
    setSelectedRequestId(undefined);
    setDetail(undefined);
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
	  dataIndex: "agentName",
	  key: "agentName",
	  render: (value?: string) => value || t("bknTrace.unnamedAgent"),
	  title: t("bknTrace.fields.agentName"),
      width: 150,
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag color={statusColor(value)}>{statusLabel(value, t)}</Tag>,
      title: t("bknTrace.fields.status"),
      width: 110,
    },
    {
      dataIndex: "evidenceCompleteness",
      key: "evidenceCompleteness",
      render: (value: string) => (
        <Tag color={value === "complete" ? "green" : "orange"}>{evidenceLabel(value, t)}</Tag>
      ),
      title: t("bknTrace.fields.evidenceCompleteness"),
      width: 150,
    },
    {
      dataIndex: "durationMs",
      key: "durationMs",
      render: (value?: number) => formatDuration(value, durationLabels),
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
				abandonRequestDetail();
				syncProvenanceURL(view, currentQuery());
              }}
              type="text"
            />
            <div>
              <Typography.Title level={4}>{t("bknTrace.sections.requestDetail")}</Typography.Title>
              <Typography.Text type="secondary">{operationLabel(detail.summary, t)}</Typography.Text>
            </div>
            <Space className={styles.detailStatus}>
              <Tag color={statusColor(detail.summary.status)}>{statusLabel(detail.summary.status, t)}</Tag>
              <Tag color={detail.summary.evidenceCompleteness === "complete" ? "green" : "orange"}>
                {evidenceLabel(detail.summary.evidenceCompleteness, t)}
              </Tag>
            </Space>
          </header>

          <Descriptions
            className={styles.identity}
            column={{ lg: 3, md: 1, sm: 1, xs: 1 }}
            size="small"
          >
            <Descriptions.Item label={t("bknTrace.fields.agentName")}>
              {detail.summary.agentName || t("bknTrace.unnamedAgent")}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.fields.operation")}>
              {operationLabel(detail.summary, t)}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.fields.requestCount")}>
              {detail.interaction?.requests.length ?? 1}
            </Descriptions.Item>
          </Descriptions>

          <OpenBKNCallContent summary={detail.summary} />

          <details className={styles.technicalDetails}>
            <summary>{t("bknTrace.fields.technicalDetails")}</summary>
            <Descriptions column={{ lg: 3, md: 1, sm: 1, xs: 1 }} size="small">
              <Descriptions.Item label={t("bknTrace.fields.conversationId")}>
                {detail.summary.conversationId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.fields.interactionId")}>
                {detail.summary.interactionId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.fields.requestId")}>
                {detail.summary.requestId}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.fields.operationId")}>
                {detail.summary.operationId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.fields.applicationPrincipalId")}>
                {detail.summary.applicationPrincipalId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.fields.effectiveSubjectId")}>
                {detail.summary.effectiveSubjectId || "-"}
              </Descriptions.Item>
            </Descriptions>
          </details>

          <Tabs
            items={[
              {
                children: detail.businessGraph
                  ? (
					  <BusinessExplanation
						artifacts={detail.artifacts.filter((artifact) =>
						  !["question", "result"].includes(artifact.artifactType) ||
						  (Boolean(detail.summary.operationId) && artifact.operationId === detail.summary.operationId)
						)}
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
		{page && page.total > 0 ? (
			<TablePaginationBar
				current={page.page ?? pagination.page}
				onChange={(nextPage, nextPageSize) => {
					setPagination({ page: nextPage, pageSize: nextPageSize });
					void loadProvenance(view, { ...activeQuery, page: nextPage, pageSize: nextPageSize });
				}}
				pageSize={page.pageSize ?? pagination.pageSize}
				showSizeChanger
				showTotal={(total) => t("common.total", { total })}
				total={page.total}
			/>
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
            key: "operation",
            render: (_: unknown, value: RequestSummary) => operationLabel(value, t),
            title: t("bknTrace.fields.operation"),
          },
          {
            dataIndex: "controlledSummary",
            key: "controlledSummary",
            render: (value?: string) => value || "-",
            title: t("bknTrace.fields.inputSummary"),
          },
          {
            key: "resultPreview",
            render: (_: unknown, value: RequestSummary) => operationResult(value, t),
            title: t("bknTrace.fields.operationResult"),
          },
          {
            dataIndex: "status",
            key: "status",
            render: (value: string) => <Tag color={statusColor(value)}>{statusLabel(value, t)}</Tag>,
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

function OpenBKNCallContent({ summary }: { summary: RequestSummary }) {
  const { t } = useTranslation();
  return (
    <div className={styles.businessContent}>
      <section>
        <Typography.Text type="secondary">{t("bknTrace.fields.inputSummary")}</Typography.Text>
        <ArtifactContent content={summary.controlledSummary || summary.questionPreview} />
      </section>
      <section>
        <Typography.Text type="secondary">{t("bknTrace.fields.operationResult")}</Typography.Text>
        <ArtifactContent content={summary.errorSummary || operationResult(summary, t)} />
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
  const question = artifacts.find((artifact) => artifact.artifactType === "question")?.content;
  const result = artifacts.find((artifact) => artifact.artifactType === "result")?.content;
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
  const durationLabels = useMemo(() => ({
    hour: t("bknTrace.durationUnits.hour"),
    millisecond: t("bknTrace.durationUnits.millisecond"),
    minute: t("bknTrace.durationUnits.minute"),
    second: t("bknTrace.durationUnits.second"),
  }), [t]);
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
    {
      dataIndex: "spanCount",
      key: "spanCount",
      render: (value: number, record) => record.spanCountStatus === "available" ? value : "-",
      title: t("bknTrace.metrics.spans"),
      width: 100,
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag color={statusColor(value)}>{statusLabel(value, t)}</Tag>,
      title: t("bknTrace.fields.status"),
      width: 120,
    },
    {
      dataIndex: "durationMs",
      key: "durationMs",
      render: (value?: number) => formatDuration(value, durationLabels),
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
      render: (value: number) => formatDuration(value / 1_000_000, durationLabels),
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

function initialProvenanceState(): { query: RequestSummaryQuery; requestId?: string; view: ProvenanceView } {
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
	requestId: read("request_id"),
    view,
  };
}

function syncProvenanceURL(view: ProvenanceView, query: RequestSummaryQuery, requestId?: string) {
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
	if (requestId) params.set("request_id", requestId);
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
	agentName: summary.agentName,
	applicationPrincipalId: summary.applicationPrincipalId,
	effectiveSubjectId: summary.effectiveSubjectId,
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
	agentName: summary.agentName,
	applicationPrincipalId: summary.applicationPrincipalId,
	effectiveSubjectId: summary.effectiveSubjectId,
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
	agentName: summary.agentName,
	applicationPrincipalId: summary.applicationPrincipalId,
	effectiveSubjectId: summary.effectiveSubjectId,
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
    describe_resource: "bknTrace.operations.describeResource",
    find_skills: "bknTrace.operations.findSkills",
    get_action_info: "bknTrace.operations.getActionInfo",
    get_kn_detail: "bknTrace.operations.getKnowledgeNetworkDetail",
    get_logic_properties_values: "bknTrace.operations.calculateLogic",
    list_knowledge_networks: "bknTrace.operations.listKnowledgeNetworks",
    list_resources: "bknTrace.operations.listResources",
    query_instance_subgraph: "bknTrace.operations.querySubgraph",
    query_object_instance: "bknTrace.operations.queryObject",
    run_sql: "bknTrace.operations.runSql",
    search_schema: "bknTrace.operations.searchSchema",
  };
  const key = summary.toolName ? standardLabels[summary.toolName] : undefined;
  const base = key ? t(key) : summary.toolName || summary.operationKey || summary.questionPreview || summary.requestId;
  return summary.controlledSummary ? `${base} · ${summary.controlledSummary}` : base;
}

function operationResult(
  summary: RequestSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (summary.resultCount === 0) return t("bknTrace.operationResults.noData");
  if (summary.resultCount !== undefined) {
    return t("bknTrace.operationResults.dataCount", { count: summary.resultCount });
  }
	if (summary.status === "completed") {
	  return t("bknTrace.operationResults.completed", { count: summary.businessRefs.length });
	}
	if (summary.status === "error") return t("bknTrace.operationResults.error");
	if (summary.status === "active" || summary.status === "running") {
	  return t("bknTrace.operationResults.running");
	}
	return statusLabel(summary.status, t);
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

function statusColor(value: string) {
  if (value === "completed" || value === "closed" || value === "ok") return "green";
  if (value === "error" || value === "failed") return "red";
  if (value === "running" || value === "active") return "blue";
  if (["abandoned", "canceled", "expired", "handed_off"].includes(value)) return "orange";
  return "default";
}

function statusLabel(value: string, t: (key: string) => string) {
  return t(`bknTrace.status.${value || "unknown"}`);
}

function evidenceLabel(value: string, t: (key: string) => string) {
  return t(`bknTrace.evidence.${value || "content_unavailable"}`);
}
