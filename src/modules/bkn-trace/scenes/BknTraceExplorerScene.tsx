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
  Form,
  Input,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "@/modules/bkn-trace/scenes/BknTraceExplorerScene.module.css";
import {
  getBusinessGraph,
  getEvidenceChain,
  getSnapshotPreview,
  getTraceGraph,
  type BusinessGraph,
  type EvidenceChain,
  type SnapshotPreview,
  type TraceGraph,
  type TraceGraphNode,
} from "@/modules/bkn-trace/services/trace.service";

type ScopeMode = "request" | "trace";

type TraceExplorerState = {
  businessGraph?: BusinessGraph;
  evidenceChain?: EvidenceChain;
  snapshotPreview?: SnapshotPreview;
  traceGraph?: TraceGraph;
};

const spanColumns: ColumnsType<TraceGraphNode> = [
  { dataIndex: "name", key: "name", title: "Span" },
  { dataIndex: "serviceName", key: "serviceName", title: "Service" },
  { dataIndex: "kind", key: "kind", title: "Kind", width: 120 },
  {
    dataIndex: "status",
    key: "status",
    render: (status: string) => <Tag color={status === "error" ? "red" : "green"}>{status}</Tag>,
    title: "Status",
    width: 120,
  },
  {
    dataIndex: "durationNano",
    key: "durationNano",
    render: (value: number) => `${Math.round(value / 1_000_000)} ms`,
    title: "Duration",
    width: 120,
  },
];

export function BknTraceExplorerScene() {
  const { t } = useTranslation();
  const [scopeMode, setScopeMode] = useState<ScopeMode>("trace");
  const [traceId, setTraceId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TraceExplorerState>({});

  const effectiveScope = useMemo(() => {
    const trimmedTraceId = traceId.trim();
    const trimmedRequestId = requestId.trim();
    if (scopeMode === "request" && trimmedRequestId) {
      return { requestId: trimmedRequestId, limit: 100 };
    }
    if (scopeMode === "trace" && trimmedTraceId) {
      return { traceId: trimmedTraceId, limit: 100 };
    }
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
      const [traceGraph, evidenceChain, businessGraph, snapshotPreview] =
        effectiveScope.traceId
          ? await Promise.all([
              getTraceGraph(effectiveScope.traceId),
              getEvidenceChain(effectiveScope),
              getBusinessGraph(effectiveScope),
              getSnapshotPreview(effectiveScope),
            ])
          : await Promise.all([
              Promise.resolve(undefined),
              getEvidenceChain(effectiveScope),
              getBusinessGraph(effectiveScope),
              getSnapshotPreview(effectiveScope),
            ]);
      setState({ businessGraph, evidenceChain, snapshotPreview, traceGraph });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
    } finally {
      setLoading(false);
    }
  }

  const visibility = state.evidenceChain?.visibilitySummary ?? state.businessGraph?.visibilitySummary;
  const partialReason = [
    ...(state.traceGraph?.partialReason ?? []),
    ...(state.evidenceChain?.partialReason ?? []),
    ...(state.businessGraph?.partialReason ?? []),
    ...(state.snapshotPreview?.partialReason ?? []),
  ];

  return (
    <div className={styles.scene}>
      <section className={styles.toolbar}>
        <div>
          <Typography.Title level={3} className={styles.title}>
            {t("bknTrace.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("bknTrace.description")}</Typography.Text>
        </div>
        <Form layout="inline" className={styles.queryForm}>
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
          {scopeMode === "trace" ? (
            <Form.Item>
              <Input
                className={styles.scopeInput}
                onChange={(event) => setTraceId(event.target.value)}
                placeholder={t("bknTrace.placeholders.traceId")}
                value={traceId}
              />
            </Form.Item>
          ) : (
            <Form.Item>
              <Input
                className={styles.scopeInput}
                onChange={(event) => setRequestId(event.target.value)}
                placeholder={t("bknTrace.placeholders.requestId")}
                value={requestId}
              />
            </Form.Item>
          )}
          <Form.Item>
            <Button type="primary" loading={loading} onClick={() => void handleQuery()}>
              {t("bknTrace.actions.query")}
            </Button>
          </Form.Item>
        </Form>
      </section>

      {error ? <Alert className={styles.alert} type="error" message={error} showIcon /> : null}

      <Spin spinning={loading}>
        {!state.evidenceChain && !state.traceGraph ? (
          <Empty className={styles.empty} description={t("bknTrace.empty")} />
        ) : (
          <div className={styles.content}>
            <section className={styles.metrics}>
              <Statistic title={t("bknTrace.metrics.spans")} value={state.traceGraph?.page.nodeCount ?? 0} />
              <Statistic title={t("bknTrace.metrics.claims")} value={state.evidenceChain?.data.claims.length ?? 0} />
              <Statistic title={t("bknTrace.metrics.evidenceRefs")} value={state.evidenceChain?.data.evidenceRefs.length ?? 0} />
              <Statistic title={t("bknTrace.metrics.businessNodes")} value={state.businessGraph?.data.nodes.length ?? 0} />
            </section>

            {partialReason.length ? (
              <Alert
                className={styles.alert}
                type="warning"
                message={t("bknTrace.partial")}
                description={
                  <Space wrap>
                    {[...new Set(partialReason)].map((reason) => (
                      <Tag key={reason}>{reason}</Tag>
                    ))}
                  </Space>
                }
                showIcon
              />
            ) : null}

            <section className={styles.panel}>
              <Typography.Title level={5}>{t("bknTrace.sections.traceGraph")}</Typography.Title>
              {state.traceGraph ? (
                <Table
                  columns={spanColumns}
                  dataSource={state.traceGraph.data.nodes}
                  pagination={false}
                  rowKey="spanId"
                  size="small"
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("bknTrace.traceGraphRequestOnly")} />
              )}
            </section>

            <section className={styles.grid}>
              <div className={styles.panel}>
                <Typography.Title level={5}>{t("bknTrace.sections.evidenceChain")}</Typography.Title>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t("bknTrace.metrics.claims")}>
                    {state.evidenceChain?.data.claims.length ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("bknTrace.metrics.evidenceRefs")}>
                    {state.evidenceChain?.data.evidenceRefs.length ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("bknTrace.metrics.businessRefs")}>
                    {state.evidenceChain?.data.businessRefs.length ?? 0}
                  </Descriptions.Item>
                </Descriptions>
              </div>
              <div className={styles.panel}>
                <Typography.Title level={5}>{t("bknTrace.sections.visibility")}</Typography.Title>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="authorized">{visibility?.authorizedRefCount ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="redacted">{visibility?.redactedRefCount ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="hidden">{visibility?.hiddenRefCount ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="unresolved">{visibility?.unresolvedRefCount ?? 0}</Descriptions.Item>
                </Descriptions>
              </div>
              <div className={styles.panel}>
                <Typography.Title level={5}>{t("bknTrace.sections.businessGraph")}</Typography.Title>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t("bknTrace.metrics.businessNodes")}>
                    {state.businessGraph?.data.nodes.length ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("bknTrace.metrics.businessEdges")}>
                    {state.businessGraph?.data.edges.length ?? 0}
                  </Descriptions.Item>
                </Descriptions>
              </div>
              <div className={styles.panel}>
                <Typography.Title level={5}>{t("bknTrace.sections.snapshot")}</Typography.Title>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="mode">
                    {state.snapshotPreview?.snapshotRef.mode ?? "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="snapshot">
                    {state.snapshotPreview?.snapshotRef.snapshotId ?? "-"}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </section>
          </div>
        )}
      </Spin>
    </div>
  );
}
