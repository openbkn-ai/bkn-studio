/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AimOutlined,
  ApartmentOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert, Button, Descriptions, Empty, Form, Input, Segmented, Spin, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "@/modules/bkn-trace/scenes/BknTraceExplorerScene.module.css";
import { BknTraceRunsScene } from "@/modules/bkn-trace/scenes/BknTraceRunsScene";
import {
  getAccessProfile,
  getBusinessGraph,
  getEvidenceChain,
  getSnapshotPreview,
  getTraceGraph,
  type BusinessGraph,
  type BusinessStoryStage,
  type EvidenceChain,
  type SnapshotPreview,
  type TraceBusinessNode,
  type TraceAccessProfile,
  type TraceGraph,
  type TraceGraphNode,
} from "@/modules/bkn-trace/services/trace.service";
import {
  businessStoryStages,
  businessNodePresentation,
  explainabilityPartialReasons,
  shortValue,
} from "@/modules/bkn-trace/utils/trace-explainability";

type ScopeMode = "request" | "trace";

type TraceExplorerState = {
  businessGraph?: BusinessGraph;
  evidenceChain?: EvidenceChain;
  snapshotPreview?: SnapshotPreview;
  traceGraph?: TraceGraph;
};

const propertyKeys = [
  "mode",
  "agent_id",
  "app_ref",
  "event_type",
  "producer_module",
  "operation_name",
  "read_kind",
  "kn_id",
  "query_type",
  "candidate_count",
  "row_count",
  "model_name",
  "model_provider",
  "claim_type",
  "ref_id",
  "ref_type",
  "source_system",
  "validity",
  "action_type",
  "status",
  "policy_ref",
  "task_ref",
  "artifact_ref",
  "version_status",
] as const;

export function BknTraceExplorerScene() {
  const { t } = useTranslation();
  const [accessProfile, setAccessProfile] = useState<TraceAccessProfile>();
  const [accessError, setAccessError] = useState(false);

  useEffect(() => {
    let active = true;
    getAccessProfile()
      .then((profile) => {
        if (active) setAccessProfile(profile);
      })
      .catch(() => {
        if (active) setAccessError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (accessError) {
    return <Alert message={t("bknTrace.errors.accessProfileFailed")} showIcon type="error" />;
  }
  if (!accessProfile) {
    return <Spin />;
  }

  const items = [];
  if (accessProfile.businessProvenanceOwn || accessProfile.businessProvenanceManagedNetworks) {
    items.push({
      children: <BknTraceRunsScene />,
      key: "runs",
      label: t("bknTrace.tabs.runs"),
    });
  }
  if (accessProfile.technicalTrace) {
    items.push({
      children: <BknTraceAdvancedExplorerScene />,
      key: "advanced",
      label: t("bknTrace.tabs.advanced"),
    });
  }
  if (!items.length) {
    return <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;
  }

  return (
    <Tabs
      className={styles.productTabs}
      defaultActiveKey={items[0].key}
      items={items}
    />
  );
}

function BknTraceAdvancedExplorerScene() {
  const { t } = useTranslation();
  const [scopeMode, setScopeMode] = useState<ScopeMode>("trace");
  const [traceId, setTraceId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [state, setState] = useState<TraceExplorerState>({});

  const spanColumns = useMemo<ColumnsType<TraceGraphNode>>(
    () => [
      { dataIndex: "name", key: "name", title: t("bknTrace.fields.span") },
      { dataIndex: "serviceName", key: "serviceName", title: t("bknTrace.fields.service") },
      { dataIndex: "kind", key: "kind", title: t("bknTrace.fields.kind"), width: 120 },
      {
        dataIndex: "status",
        key: "status",
        render: (status: string) => <Tag color={status === "error" ? "red" : "green"}>{status}</Tag>,
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
    ],
    [t],
  );

  const effectiveScope = useMemo(() => {
    const trimmedTraceId = traceId.trim();
    const trimmedRequestId = requestId.trim();
    if (scopeMode === "request" && trimmedRequestId) return { requestId: trimmedRequestId, limit: 100 };
    if (scopeMode === "trace" && trimmedTraceId) return { traceId: trimmedTraceId, limit: 100 };
    return null;
  }, [requestId, scopeMode, traceId]);

  async function handleQuery() {
    if (!effectiveScope) {
      setError(t("bknTrace.errors.missingScope"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const traceGraphResult = effectiveScope.traceId
        ? await getTraceGraph(effectiveScope.traceId)
            .then((value) => ({ status: "fulfilled" as const, value }))
            .catch((reason: unknown) => ({ reason, status: "rejected" as const }))
        : { status: "fulfilled" as const, value: undefined };
      const [evidenceChain, businessGraph, snapshotPreview] = await Promise.all([
        getEvidenceChain(effectiveScope),
        getBusinessGraph(effectiveScope),
        getSnapshotPreview(effectiveScope),
      ]);
      const traceGraph = traceGraphResult.status === "fulfilled" ? traceGraphResult.value : undefined;
      setState({ businessGraph, evidenceChain, snapshotPreview, traceGraph });
      setSelectedNodeId(businessGraph.data.nodes[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
    } finally {
      setLoading(false);
    }
  }

  const graphNodes = useMemo(() => state.businessGraph?.data.nodes ?? [], [state.businessGraph?.data.nodes]);
  const graphEdges = state.businessGraph?.data.edges ?? [];
  const stages = useMemo(() => businessStoryStages(graphNodes), [graphNodes]);
  const nodeById = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  const visibility = state.businessGraph?.visibilitySummary ?? state.evidenceChain?.visibilitySummary;
  const businessPartialReasons = explainabilityPartialReasons([
    state.evidenceChain?.partialReason ?? [],
    state.businessGraph?.partialReason ?? [],
    state.snapshotPreview?.partialReason ?? [],
  ], state.businessGraph);
  const partialReasons = explainabilityPartialReasons([
    state.traceGraph?.partialReason ?? [],
    state.evidenceChain?.partialReason ?? [],
    state.businessGraph?.partialReason ?? [],
    state.snapshotPreview?.partialReason ?? [],
  ], state.businessGraph);

  const nodeTitle = (node: TraceBusinessNode) => {
    return businessNodePresentation(node).title;
  };
  const nodeMeta = (node: TraceBusinessNode) => {
    const presentation = businessNodePresentation(node);
    const status = scalar(node.properties.status) || scalar(node.properties.validity);
    return [presentation.subtitle, status, node.versionStatus].filter(Boolean).join(" · ");
  };

  const story = (
    <div className={styles.storyWorkspace}>
      <div className={styles.storyMain}>
        {businessPartialReasons.length ? (
          <Alert
            className={styles.storyPartial}
            description={<div className={styles.reasonList}>{businessPartialReasons.map((reason) => <Tag key={reason}>{reason}</Tag>)}</div>}
            message={t("bknTrace.incompleteBusiness")}
            showIcon
            type="warning"
          />
        ) : null}
        <div className={styles.storyRail}>
          {stages.map((group) => (
            <section className={`${styles.stage} ${styles[`stage_${group.stage}`]}`} key={group.stage}>
              <header className={styles.stageHeader}>
                <span className={styles.stageIcon}>{stageIcon(group.stage)}</span>
                <div>
                  <Typography.Text strong>{t(`bknTrace.stages.${group.stage}`)}</Typography.Text>
                  <Typography.Text type="secondary" className={styles.stageCount}>{group.nodes.length}</Typography.Text>
                </div>
              </header>
              <div className={styles.stageNodes}>
                {group.nodes.length ? group.nodes.map((node) => (
                  <button
                    className={`${styles.storyNode} ${selectedNodeId === node.id ? styles.storyNodeSelected : ""}`}
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    type="button"
                  >
                    <span className={styles.storyNodeTitle}>{nodeTitle(node)}</span>
                    <span className={styles.storyNodeMeta}>{nodeMeta(node) || t("bknTrace.fields.observed")}</span>
                  </button>
                )) : <span className={styles.stageEmpty}>{t("bknTrace.emptyStates.stage")}</span>}
              </div>
            </section>
          ))}
        </div>

        <section className={styles.relations}>
          <Typography.Title level={5}>{t("bknTrace.sections.relations")}</Typography.Title>
          {graphEdges.length ? (
            <div className={styles.relationList}>
              {graphEdges.map((edge) => (
                <button className={styles.relationRow} key={edge.id} type="button" onClick={() => setSelectedNodeId(edge.targetId)}>
                  <span>{nodeById.has(edge.sourceId) ? nodeTitle(nodeById.get(edge.sourceId)!) : edge.sourceId}</span>
                  <Tag bordered={false}>{t(`bknTrace.edges.${edge.edgeType}`, { defaultValue: edge.edgeType })}</Tag>
                  <span>{nodeById.has(edge.targetId) ? nodeTitle(nodeById.get(edge.targetId)!) : edge.targetId}</span>
                </button>
              ))}
            </div>
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("bknTrace.emptyStates.relations")} />}
        </section>
      </div>

      <aside className={styles.nodeInspector}>
        <Typography.Title level={5}>{t("bknTrace.sections.nodeDetails")}</Typography.Title>
        {selectedNode ? (
          <>
            <Typography.Text strong className={styles.inspectorTitle}>{nodeTitle(selectedNode)}</Typography.Text>
            <Typography.Text type="secondary" className={styles.inspectorSubtitle}>
              {businessNodePresentation(selectedNode).subtitle}
            </Typography.Text>
            <div className={styles.inspectorTags}>
              <Tag>{t(`bknTrace.stages.${selectedNode.stage ?? "evidence"}`)}</Tag>
              {selectedNode.visibility ? <Tag color={selectedNode.visibility === "visible" ? "green" : "orange"}>{selectedNode.visibility}</Tag> : null}
              {selectedNode.versionStatus ? <Tag>{selectedNode.versionStatus}</Tag> : null}
            </div>
            <Descriptions className={styles.nodeDescriptions} column={1} size="small">
              {selectedNode.operationId ? <Descriptions.Item label={t("bknTrace.fields.operationId")}>{selectedNode.operationId}</Descriptions.Item> : null}
              {selectedNode.claimId ? <Descriptions.Item label={t("bknTrace.fields.claimId")}>{selectedNode.claimId}</Descriptions.Item> : null}
              {selectedNode.display?.businessPath?.length ? <Descriptions.Item label={t("bknTrace.fields.businessPath")}>{selectedNode.display.businessPath.join(" / ")}</Descriptions.Item> : null}
              {selectedNode.display?.controlledSummary ? <Descriptions.Item label={t("bknTrace.fields.controlledSummary")}>{selectedNode.display.controlledSummary}</Descriptions.Item> : null}
              {selectedNode.display?.resolutionStatus ? <Descriptions.Item label={t("bknTrace.fields.resolutionStatus")}>{selectedNode.display.resolutionStatus}</Descriptions.Item> : null}
              {selectedNode.display?.sourceVersion ? <Descriptions.Item label={t("bknTrace.fields.sourceVersion")}>{selectedNode.display.sourceVersion}</Descriptions.Item> : null}
              {propertyKeys.map((key) => selectedNode.properties[key] === undefined ? null : (
                <Descriptions.Item key={key} label={key}>{displayValue(selectedNode.properties[key])}</Descriptions.Item>
              ))}
            </Descriptions>
            <details className={styles.technicalDetails}>
              <summary>{t("bknTrace.fields.technicalDetails")}</summary>
              <Descriptions className={styles.nodeDescriptions} column={1} size="small">
                <Descriptions.Item label={t("bknTrace.fields.identifier")}>{selectedNode.id}</Descriptions.Item>
                <Descriptions.Item label="technical_ref">{businessNodePresentation(selectedNode).technicalId}</Descriptions.Item>
                <Descriptions.Item label="node_type">{selectedNode.nodeType}</Descriptions.Item>
              </Descriptions>
            </details>
          </>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("bknTrace.emptyStates.node")} />}
      </aside>
    </div>
  );

  const diagnostics = state.traceGraph ? (
    <Table columns={spanColumns} dataSource={state.traceGraph.data.nodes} pagination={false} rowKey="spanId" size="small" />
  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("bknTrace.traceGraphRequestOnly")} />;

  const governance = (
    <div className={styles.governanceGrid}>
      <section>
        <Typography.Title level={5}>{t("bknTrace.sections.visibility")}</Typography.Title>
        <Descriptions column={1} size="small">
          <Descriptions.Item label={t("bknTrace.visibility.authorized")}>{visibility?.authorizedRefCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.visibility.redacted")}>{visibility?.redactedRefCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.visibility.hidden")}>{visibility?.hiddenRefCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.visibility.unauthorized")}>{visibility?.unauthorizedRefCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.visibility.unresolved")}>{visibility?.unresolvedRefCount ?? 0}</Descriptions.Item>
        </Descriptions>
      </section>
      <section>
        <Typography.Title level={5}>{t("bknTrace.sections.snapshot")}</Typography.Title>
        <Descriptions column={1} size="small">
          <Descriptions.Item label={t("bknTrace.fields.mode")}>{state.snapshotPreview?.snapshotRef.mode ?? "-"}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.fields.snapshotId")}>{state.snapshotPreview?.snapshotRef.snapshotId ?? "-"}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.fields.complianceStatus")}>{displayValue(state.snapshotPreview?.manifest.compliance_status)}</Descriptions.Item>
          <Descriptions.Item label={t("bknTrace.fields.retentionPolicy")}>{displayValue(state.snapshotPreview?.manifest.retention_policy)}</Descriptions.Item>
        </Descriptions>
      </section>
      <section className={styles.governanceWide}>
        <Typography.Title level={5}>{t("bknTrace.sections.completeness")}</Typography.Title>
        {partialReasons.length ? <div className={styles.reasonList}>{partialReasons.map((reason) => <Tag key={reason}>{reason}</Tag>)}</div> : (
          <Typography.Text><CheckCircleOutlined className={styles.okIcon} /> {t("bknTrace.complete")}</Typography.Text>
        )}
      </section>
    </div>
  );

  return (
    <div className={styles.scene}>
      <section className={styles.toolbar}>
        <Typography.Title level={3} className={styles.title}>{t("bknTrace.title")}</Typography.Title>
        <Form layout="inline" className={styles.queryForm} onFinish={() => void handleQuery()}>
          <Form.Item>
            <Segmented
              value={scopeMode}
              onChange={(value) => setScopeMode(value as ScopeMode)}
              options={[
                { label: t("bknTrace.scope.trace"), value: "trace" },
                { label: t("bknTrace.scope.request"), value: "request" },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Input
              className={styles.scopeInput}
              onChange={(event) => scopeMode === "trace" ? setTraceId(event.target.value) : setRequestId(event.target.value)}
              placeholder={scopeMode === "trace" ? t("bknTrace.placeholders.traceId") : t("bknTrace.placeholders.requestId")}
              value={scopeMode === "trace" ? traceId : requestId}
            />
          </Form.Item>
          <Form.Item>
            <Button htmlType="submit" icon={<SearchOutlined />} type="primary" loading={loading}>{t("bknTrace.actions.query")}</Button>
          </Form.Item>
        </Form>
      </section>

      {error ? <Alert className={styles.alert} type="error" message={error} showIcon /> : null}
      <Spin spinning={loading}>
        {!state.businessGraph && !state.traceGraph ? <Empty className={styles.empty} description={t("bknTrace.empty")} /> : (
          <div className={styles.content}>
            <section className={styles.resultHeader}>
              <div>
                <Typography.Text type="secondary">{t("bknTrace.fields.traceId")}</Typography.Text>
                <Typography.Text className={styles.resultId}>{state.businessGraph?.traceId || state.traceGraph?.traceId || "-"}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">{t("bknTrace.fields.requestId")}</Typography.Text>
                <Typography.Text className={styles.resultId}>{state.businessGraph?.requestId || "-"}</Typography.Text>
              </div>
              <div className={styles.completeness}>
                {partialReasons.length ? <Tag icon={<ExclamationCircleOutlined />} color="warning">{t("bknTrace.partial")}</Tag> : <Tag icon={<CheckCircleOutlined />} color="success">{t("bknTrace.complete")}</Tag>}
              </div>
            </section>
            <Tabs
              className={styles.tabs}
              items={[
                { key: "business", label: t("bknTrace.tabs.business"), children: story },
                { key: "diagnostics", label: t("bknTrace.tabs.diagnostics"), children: diagnostics },
                { key: "governance", label: t("bknTrace.tabs.governance"), children: governance },
              ]}
            />
          </div>
        )}
      </Spin>
    </div>
  );
}

function stageIcon(stage: BusinessStoryStage) {
  switch (stage) {
    case "intent": return <AimOutlined />;
    case "execution": return <ApartmentOutlined />;
    case "evidence": return <DatabaseOutlined />;
    case "claim": return <BulbOutlined />;
    case "action": return <ThunderboltOutlined />;
  }
}

function scalar(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string") return shortValue(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).join(", ");
  return "-";
}
