/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Card, DatePicker, Form, InputNumber, Select, Space, Switch, Table } from "antd";
import type { TableProps } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { queryKnowledgeNetworkMetricData } from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  MetricDataQueryMode,
  MetricDataQueryParams,
  MetricDataQueryResult,
  MetricDataQueryTimeRange,
  MetricQueryCalendarStep,
  MetricSamePeriodMethod,
  MetricSamePeriodTimeGranularity,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./MetricDataQueryPanel.module.css";

const QUERY_MODE_OPTIONS: MetricDataQueryMode[] = ["instant", "trend", "sameperiod", "proportion"];
const TIME_RANGE_OPTIONS: MetricDataQueryTimeRange[] = [
  "last_1h",
  "last_24h",
  "last_7d",
  "last_30d",
  "calendar_day",
  "custom",
];
const CALENDAR_STEP_OPTIONS: MetricQueryCalendarStep[] = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
];
const SAME_PERIOD_METHOD_OPTIONS: MetricSamePeriodMethod[] = ["growth_value", "growth_rate"];
const SAME_PERIOD_GRANULARITY_OPTIONS: MetricSamePeriodTimeGranularity[] = [
  "day",
  "month",
  "quarter",
  "year",
];

function needsCalendarStep(mode: MetricDataQueryMode | undefined) {
  // Same-period hides step UI and syncs time.step from comparison granularity.
  return mode === "trend" || mode === "proportion";
}

function needsFillNull(mode: MetricDataQueryMode | undefined) {
  return mode === "trend" || mode === "sameperiod" || mode === "proportion";
}

type MetricDataQueryPanelProps = {
  embedded?: boolean;
  metricId: string;
  metricName: string;
  networkId: string;
};

function parseNumericValue(value: string | number | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderVisualResult(result: MetricDataQueryResult, metricName: string) {
  if (result.visualHint === "instant-card") {
    const value = result.rows[0]?.value ?? "--";
    return (
      <div className={styles.instantCard}>
        <div className={styles.instantValue}>{value}</div>
        <div className={styles.instantLabel}>{metricName}</div>
      </div>
    );
  }

  if (result.visualHint === "trend-bars" || result.visualHint === "proportion-bars") {
    const labelKey = result.columns[0]?.key ?? "label";
    const valueKey = result.columns[1]?.key ?? "value";
    const maxValue = Math.max(
      ...result.rows.map((row) => parseNumericValue(row[valueKey])),
      1,
    );

    return (
      <div className={styles.barList}>
        {result.rows.map((row, index) => {
          const label = String(row[labelKey] ?? index);
          const value = parseNumericValue(row[valueKey]);
          const width = `${Math.max((value / maxValue) * 100, 4)}%`;

          return (
            <div className={styles.barRow} key={`${label}-${index}`}>
              <span>{label}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width }} />
              </div>
              <span>{row[valueKey]}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

export function MetricDataQueryPanel({
  embedded = false,
  metricId,
  metricName,
  networkId,
}: MetricDataQueryPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<MetricDataQueryParams>();
  const [queryLoading, setQueryLoading] = useState(false);
  const [result, setResult] = useState<MetricDataQueryResult | null>(null);
  const queryMode = Form.useWatch("mode", form);
  const timeRange = Form.useWatch("timeRange", form);

  const columns: TableProps<Record<string, string | number>>["columns"] = useMemo(
    () =>
      (result?.columns ?? []).map((column) => ({
        dataIndex: column.key,
        key: column.key,
        title: column.title,
      })),
    [result?.columns],
  );

  const handleQuery = async () => {
    if (!networkId || !metricId) {
      return;
    }

    try {
      const values = await form.validateFields();
      setQueryLoading(true);
      const queryResult = await queryKnowledgeNetworkMetricData(networkId, metricId, values);
      setResult(queryResult);
      void message.success(t("knowledgeNetwork.metricQuerySuccess"));
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message) {
        void message.error(extractRequestErrorMessage(nextError));
      }
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div>
      <Card bordered={embedded ? false : undefined} title={t("knowledgeNetwork.metricQueryFormTitle")}>
        <Form
          className={styles.queryForm}
          form={form}
          initialValues={{
            fillNull: false,
            limit: 100,
            mode: "instant",
            samePeriodGranularity: "day",
            samePeriodMethod: "growth_value",
            samePeriodOffset: 1,
            step: "day",
            timeRange: "last_24h",
          }}
          layout="inline"
        >
          <Form.Item
            label={t("knowledgeNetwork.metricQueryModeLabel")}
            name="mode"
            rules={[{ required: true }]}
          >
            <Select
              options={QUERY_MODE_OPTIONS.map((value) => ({
                label: t(`knowledgeNetwork.metricQueryMode.${value}`),
                value,
              }))}
              style={{ width: 160 }}
            />
          </Form.Item>
          {queryMode !== "instant" ? (
            <Form.Item
              label={t("knowledgeNetwork.metricQueryTimeRangeLabel")}
              name="timeRange"
              rules={[{ required: true }]}
            >
              <Select
                options={TIME_RANGE_OPTIONS.map((value) => ({
                  label: t(`knowledgeNetwork.metricQueryTimeRange.${value}`),
                  value,
                }))}
                style={{ width: 180 }}
              />
            </Form.Item>
          ) : null}
          {queryMode !== "instant" && timeRange === "custom" ? (
            <Space>
              <Form.Item
                label={t("knowledgeNetwork.metricQueryCustomStartTime")}
                name="customStartTime"
                rules={[{ required: true }]}
              >
                <DatePicker showTime />
              </Form.Item>
              <Form.Item
                label={t("knowledgeNetwork.metricQueryCustomEndTime")}
                name="customEndTime"
                rules={[{ required: true }]}
              >
                <DatePicker showTime />
              </Form.Item>
            </Space>
          ) : null}
          {needsCalendarStep(queryMode) ? (
            <Form.Item
              label={t("knowledgeNetwork.metricQueryStepLabel")}
              name="step"
              rules={[{ required: true, message: t("knowledgeNetwork.metricQueryStepRequired") }]}
            >
              <Select
                options={CALENDAR_STEP_OPTIONS.map((value) => ({
                  label: t(`knowledgeNetwork.metricQueryStep.${value}`),
                  value,
                }))}
                style={{ width: 120 }}
              />
            </Form.Item>
          ) : null}
          {queryMode === "sameperiod" ? (
            <Space>
              <Form.Item label={t("knowledgeNetwork.metricQuerySamePeriodMethod")} name="samePeriodMethod">
                <Select
                  options={SAME_PERIOD_METHOD_OPTIONS.map((value) => ({
                    label: t(`knowledgeNetwork.metricQuerySamePeriodMethod.${value}`),
                    value,
                  }))}
                  style={{ width: 140 }}
                />
              </Form.Item>
              <Form.Item
                label={t("knowledgeNetwork.metricQuerySamePeriodGranularity")}
                name="samePeriodGranularity"
              >
                <Select
                  options={SAME_PERIOD_GRANULARITY_OPTIONS.map((value) => ({
                    label: t(`knowledgeNetwork.metricQuerySamePeriodGranularity.${value}`),
                    value,
                  }))}
                  style={{ width: 120 }}
                />
              </Form.Item>
              <Form.Item label={t("knowledgeNetwork.metricQuerySamePeriodOffset")} name="samePeriodOffset">
                <InputNumber min={1} max={12} style={{ width: 90 }} />
              </Form.Item>
            </Space>
          ) : null}
          <Form.Item label={t("knowledgeNetwork.metricQueryLimit")} name="limit">
            <InputNumber min={1} max={1000} style={{ width: 100 }} />
          </Form.Item>
          {needsFillNull(queryMode) ? (
            <Form.Item label={t("knowledgeNetwork.metricQueryFillNull")} name="fillNull" valuePropName="checked">
              <Switch />
            </Form.Item>
          ) : null}
          <Form.Item>
            <AppButton loading={queryLoading} onClick={() => void handleQuery()} type="primary">
              {t("knowledgeNetwork.metricQueryRun")}
            </AppButton>
          </Form.Item>
        </Form>
      </Card>

      <Card title={t("knowledgeNetwork.metricQueryResultTitle")}>
        {result?.visualHint ? renderVisualResult(result, metricName) : null}
        <Table
          columns={columns}
          dataSource={(result?.rows ?? []).map((row, index) => ({ ...row, key: index }))}
          locale={{ emptyText: t("knowledgeNetwork.metricQueryEmpty") }}
          pagination={false}
          scroll={{ x: true }}
          size="small"
        />
        {result?.durationMs ? (
          <div className={styles.metaRow}>
            {t("knowledgeNetwork.metricQueryDuration", { duration: result.durationMs })}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
