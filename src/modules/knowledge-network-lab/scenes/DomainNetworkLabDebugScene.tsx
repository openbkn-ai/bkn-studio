/**
 * 领域知识网络「检索沙盒 / 接口调试」（实验版）。
 * 对接真实指标试算接口（ontology-query）：构造请求、发送、查看请求 / 响应。
 */

import { ArrowLeftOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { Alert, Empty, InputNumber, Segmented, Select, Spin, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { AppButton } from "@/framework/ui/common/AppButton";
import { getDomainNetwork } from "@/modules/knowledge-network-lab/services/domain-networks.lab.service";
import {
  buildMetricQueryRequest,
  listSandboxMetrics,
  runMetricQuery,
  type SandboxRunResult,
} from "@/modules/knowledge-network-lab/services/sandbox.lab.service";
import type { DomainNetwork } from "@/modules/knowledge-network-lab/types/domain-network";
import type {
  KnowledgeNetworkMetricRecord,
  MetricDataQueryMode,
  MetricDataQueryParams,
  MetricDataQueryTimeRange,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./DomainNetworkLabDebugScene.module.css";

const TIME_RANGES: MetricDataQueryTimeRange[] = [
  "last_1h",
  "last_24h",
  "last_7d",
  "last_30d",
  "calendar_day",
];

function formatRequest(request: ReturnType<typeof buildMetricQueryRequest>): string {
  const headerLines = Object.entries(request.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `${request.method} ${request.url}\n${headerLines}\n\n${JSON.stringify(request.body, null, 2)}`;
}

export function DomainNetworkLabDebugScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { networkId } = useParams<{ networkId: string }>();

  const [network, setNetwork] = useState<DomainNetwork | null>(null);
  const [metrics, setMetrics] = useState<KnowledgeNetworkMetricRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [metricId, setMetricId] = useState<string>();
  const [mode, setMode] = useState<MetricDataQueryMode>("instant");
  const [timeRange, setTimeRange] = useState<MetricDataQueryTimeRange>("last_24h");
  const [limit, setLimit] = useState(100);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<SandboxRunResult | null>(null);
  const [activeTab, setActiveTab] = useState("request");

  const load = useCallback(async () => {
    if (!networkId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [record, metricList] = await Promise.all([
        getDomainNetwork(networkId),
        listSandboxMetrics(networkId),
      ]);
      setNetwork(record);
      setMetrics(metricList);
      setMetricId(metricList[0]?.id);
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void load();
  }, [load]);

  const params: MetricDataQueryParams = useMemo(
    () => ({ mode, timeRange, limit, fillNull: true }),
    [mode, timeRange, limit],
  );

  const request = useMemo(
    () => (networkId && metricId ? buildMetricQueryRequest(networkId, metricId, params) : null),
    [networkId, metricId, params],
  );

  const onRun = useCallback(async () => {
    if (!networkId || !metricId) {
      return;
    }
    setRunning(true);
    setRunResult(null);
    try {
      const result = await runMetricQuery(networkId, metricId, params);
      setRunResult(result);
      setActiveTab("response");
    } finally {
      setRunning(false);
    }
  }, [networkId, metricId, params]);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  if (!network) {
    return (
      <div className={styles.center}>
        <Empty description={t("knowledgeNetworkLab.detail.notFound")}>
          <AppButton onClick={() => navigate("/knowledge-network-lab")}>
            {t("knowledgeNetworkLab.detail.back")}
          </AppButton>
        </Empty>
      </div>
    );
  }

  return (
    <section className={styles.page}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate(`/knowledge-network-lab/${network.id}`)}
      >
        <ArrowLeftOutlined />
        {t("knowledgeNetworkLab.sandbox.backToDetail")}
      </button>

      <div className={styles.titleRow}>
        <h2 className={styles.title}>{t("knowledgeNetworkLab.sandbox.title")}</h2>
        <span className={styles.labBadge}>{t("knowledgeNetworkLab.labBadge")}</span>
        <span className={styles.netName}>{network.name}</span>
        <span className={styles.slug}>{network.slug}</span>
      </div>

      {metrics.length === 0 ? (
        <Empty className={styles.noMetrics} description={t("knowledgeNetworkLab.sandbox.noMetrics")} />
      ) : (
        <div className={styles.layout}>
          {/* ----- 请求构造 ----- */}
          <div className={styles.builderCard}>
            <div className={styles.cardTitle}>{t("knowledgeNetworkLab.sandbox.builder")}</div>

            <label className={styles.fieldLabel}>{t("knowledgeNetworkLab.sandbox.metric")}</label>
            <Select
              value={metricId}
              onChange={setMetricId}
              options={metrics.map((metric) => ({
                value: metric.id,
                label: metric.unit ? `${metric.name} · ${metric.unit}` : metric.name,
              }))}
            />

            <label className={styles.fieldLabel}>{t("knowledgeNetworkLab.sandbox.mode")}</label>
            <Segmented<MetricDataQueryMode>
              block
              value={mode}
              onChange={(value) => setMode(value)}
              options={[
                { value: "instant", label: t("knowledgeNetworkLab.sandbox.modeInstant") },
                { value: "trend", label: t("knowledgeNetworkLab.sandbox.modeTrend") },
                { value: "proportion", label: t("knowledgeNetworkLab.sandbox.modeProportion") },
              ]}
            />

            <label className={styles.fieldLabel}>{t("knowledgeNetworkLab.sandbox.timeRange")}</label>
            <Select<MetricDataQueryTimeRange>
              value={timeRange}
              onChange={setTimeRange}
              options={TIME_RANGES.map((range) => ({
                value: range,
                label: t(`knowledgeNetworkLab.sandbox.timeRangeOption.${range}`),
              }))}
            />

            <label className={styles.fieldLabel}>{t("knowledgeNetworkLab.sandbox.limit")}</label>
            <InputNumber
              min={1}
              max={1000}
              value={limit}
              onChange={(value) => setLimit(value ?? 100)}
              style={{ width: "100%" }}
            />

            <AppButton
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={running}
              onClick={onRun}
              block
              className={styles.runBtn}
            >
              {t("knowledgeNetworkLab.sandbox.send")}
            </AppButton>
          </div>

          {/* ----- 请求 / 响应 ----- */}
          <div className={styles.ioCard}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "request",
                  label: t("knowledgeNetworkLab.sandbox.requestTab"),
                  children: request ? <pre className={styles.code}>{formatRequest(request)}</pre> : null,
                },
                {
                  key: "response",
                  label: t("knowledgeNetworkLab.sandbox.responseTab"),
                  children: <ResponsePanel running={running} result={runResult} />,
                },
              ]}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ResponsePanel({ running, result }: { running: boolean; result: SandboxRunResult | null }) {
  const { t } = useTranslation();

  if (running) {
    return (
      <div className={styles.responseEmpty}>
        <Spin />
      </div>
    );
  }
  if (!result) {
    return (
      <div className={styles.responseEmpty}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("knowledgeNetworkLab.sandbox.responseEmpty")}
        />
      </div>
    );
  }
  if (!result.ok) {
    return <Alert type="error" showIcon message={t("knowledgeNetworkLab.sandbox.failed")} description={result.error} />;
  }

  const columns: ColumnsType<Record<string, string | number>> = result.result.columns.map((column) => ({
    title: column.title,
    dataIndex: column.key,
    key: column.key,
    render: (value: unknown) => String(value ?? ""),
  }));

  return (
    <div className={styles.responseWrap}>
      <div className={styles.responseMeta}>
        <Tag color="success" bordered={false}>
          200 OK
        </Tag>
        <span className={styles.latency}>
          {t("knowledgeNetworkLab.sandbox.latency", { ms: result.durationMs })}
        </span>
      </div>
      <Table
        className={styles.hitsTable}
        rowKey={(_, index) => String(index)}
        size="small"
        columns={columns}
        dataSource={result.result.rows}
        pagination={false}
        scroll={{ x: true }}
      />
      <pre className={styles.code}>{JSON.stringify(result.result, null, 2)}</pre>
    </div>
  );
}
