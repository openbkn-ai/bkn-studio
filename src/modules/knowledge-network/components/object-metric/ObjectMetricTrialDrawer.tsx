/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, DatePicker, Drawer, Form, Input, Select, Space, Table, Tag } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import { extractRequestErrorDetails } from "@/framework/request/error-message";
import { ObjectMetricAnalysisPanel } from "@/modules/knowledge-network/components/object-metric/ObjectMetricAnalysisPanel";
import { formatMetricTimeLabel } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  ObjectMetricDataV1,
  ObjectMetricDefinitionV1,
  ObjectMetricQueryRequestV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import {
  objectMetricPropertyDisplayLabels,
  objectMetricPropertyDisplayName,
} from "@/modules/knowledge-network/lib/object-metric-display";
import metricTheme from "./ObjectMetricTheme.module.css";
import styles from "./ObjectMetricTrialDrawer.module.css";
import { useTranslation } from "react-i18next";

type TrialFormValues = {
  analysisDimensions?: string[];
  identity?: Record<string, string>;
  time?: [import("dayjs").Dayjs, import("dayjs").Dayjs];
};

type ObjectMetricTrialDrawerProps = {
  definition: ObjectMetricDefinitionV1;
  mode: "draft" | "published";
  objectType?: ObjectTypeDetail | null;
  onClose: () => void;
  onRun: (query: ObjectMetricQueryRequestV1) => Promise<ObjectMetricDataV1>;
  open: boolean;
};

function parseIdentityValue(value: string, type?: string): unknown {
  const normalized = type?.toLowerCase();
  if (["integer", "int", "int32", "int64", "long"].includes(normalized ?? "")) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value;
  }
  if (["decimal", "double", "float", "number"].includes(normalized ?? "")) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (["bool", "boolean"].includes(normalized ?? "")) return value === "true";
  return value;
}

function displayMetricValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return "—";
}

function displayMetricFields(
  value: Record<string, unknown> | undefined,
  propertyLabels: Record<string, string>,
): string {
  if (!value || !Object.keys(value).length) return "—";
  return Object.entries(value)
    .map(([key, fieldValue]) => `${propertyLabels[key] || key}: ${displayMetricValue(fieldValue)}`)
    .join("、");
}

function trialErrorMessage(error: unknown): string {
  const details = extractRequestErrorDetails(error);
  if (details.details?.includes("requires numeric operands")) {
    return objectMetricText("mbaea9b35162e");
  }
  if (details.details?.includes("to_number")) {
    return objectMetricText("m228e2f6a7e9d");
  }
  return details.details ? `${details.description}：${details.details}` : details.description;
}

function trialStatusLabel(
  status: ObjectMetricDataV1["status"] | ObjectMetricDataV1["entries"][number]["status"],
): string {
  return objectMetricText(
    (
      {
        ok: "trialStatusSuccess",
        no_data: "trialStatusNoData",
        partial: "trialStatusPartial",
        unavailable: "trialStatusUnavailable",
      } as const
    )[status],
  );
}

export function ObjectMetricTrialDrawer({
  definition,
  mode,
  objectType,
  onClose,
  onRun,
  open,
}: ObjectMetricTrialDrawerProps) {
  useTranslation();
  const [form] = Form.useForm<TrialFormValues>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ObjectMetricDataV1>();
  const resultRef = useRef<HTMLDivElement>(null);
  const formId = `metric-trial-${definition.id}-${definition.version}`;
  const propertyLabels = useMemo(() => objectMetricPropertyDisplayLabels(objectType), [objectType]);
  const usesFixedDerivedTimeWindow =
    definition.specification.kind === "derived" &&
    definition.specification.business_qualifiers.time_window?.mode !== undefined &&
    definition.specification.business_qualifiers.time_window.mode !== "unbounded";

  useEffect(() => {
    if (result || error)
      resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [error, result]);

  const run = async (values: TrialFormValues) => {
    setLoading(true);
    setError(undefined);
    setResult(undefined);
    try {
      const identity = Object.fromEntries(
        objectType?.primaryKeys.map((name) => {
          const property = objectType.dataProperties.find((item) => item.name === name);
          return [name, parseIdentityValue(values.identity?.[name] ?? "", property?.type)];
        }) ?? [],
      );
      setResult(
        await onRun({
          analysis_dimensions: definition.query_capabilities.analysis_dimensions.filter((item) =>
            values.analysisDimensions?.includes(item.property_name),
          ),
          instance_identities:
            definition.calculation_scope === "object_instance" ? [identity] : undefined,
          time: values.time
            ? { start: values.time[0].valueOf(), end: values.time[1].valueOf() }
            : undefined,
        }),
      );
    } catch (requestError) {
      setError(trialErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      rootClassName={metricTheme.scope}
      destroyOnHidden
      footer={
        <div className={styles.footer}>
          <Button
            aria-label={objectMetricText("m073728637a26")}
            disabled={
              definition.calculation_scope === "object_instance" && !objectType?.primaryKeys.length
            }
            form={formId}
            htmlType="submit"
            loading={loading}
            type="primary"
          >
            {objectMetricText("m073728637a26")}
          </Button>
        </div>
      }
      forceRender
      onClose={onClose}
      open={open}
      title={
        <div className={styles.title}>
          <span>
            {objectMetricText("trialTitle", {
              p0: definition.name || objectMetricText("ma8da957c687c"),
            })}
          </span>
          <Tag>
            {objectMetricText(
              (
                {
                  draft: "m2a2fd29bd27a",
                  validated: "m1936eafc0c3c",
                  published: "md334724d6b2f",
                  deprecated: "m1948aabb85ed",
                } as const
              )[definition.lifecycle.status],
            )}
            {mode === "published" ? ` · v${definition.version}` : null}
          </Tag>
        </div>
      }
      width="min(760px, calc(100vw - 24px))"
    >
      <h3 className={styles.sectionTitle}>{objectMetricText("trialConditions")}</h3>
      <Form
        className={styles.form}
        form={form}
        id={formId}
        layout="vertical"
        onFinish={(values) => void run(values)}
      >
        {definition.calculation_scope === "object_instance" ? (
          objectType?.primaryKeys.length ? (
            objectType.primaryKeys.map((name) => {
              const property = objectType.dataProperties.find((item) => item.name === name);
              return (
                <Form.Item
                  key={name}
                  label={property?.displayName || name}
                  name={["identity", name]}
                  rules={[{ required: true, message: objectMetricText("m803fff99642e") }]}
                  tooltip={
                    property?.displayName && property.displayName !== name ? name : undefined
                  }
                >
                  <Input
                    placeholder={objectMetricText("m52a8e4de05d5", {
                      p0: property?.displayName || name,
                    })}
                  />
                </Form.Item>
              );
            })
          ) : (
            <Alert message={objectMetricText("md23ea9c2fae2")} type="error" showIcon />
          )
        ) : null}
        {usesFixedDerivedTimeWindow ? (
          <p className={styles.fixedTimeNotice}>{objectMetricText("m80365c614b62")}</p>
        ) : (
          <Form.Item
            label={objectMetricText("m76a5dbc71e2b")}
            name="time"
            tooltip={objectMetricText("mb4dd619d5bbc")}
          >
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
        )}
        {definition.calculation_scope === "object_set" &&
        definition.query_capabilities.analysis_dimensions.length > 0 ? (
          <Form.Item
            extra={objectMetricText("trialDimensionHint")}
            label={objectMetricText("m2acf103ad6cf")}
            name="analysisDimensions"
          >
            <Select
              mode="multiple"
              options={definition.query_capabilities.analysis_dimensions.map((item) => ({
                label: objectMetricPropertyDisplayName(item, objectType),
                value: item.property_name,
              }))}
              placeholder={objectMetricText("m6f346a890bc4")}
            />
          </Form.Item>
        ) : null}
      </Form>
      {error || result ? (
        <div className={styles.result} ref={resultRef}>
          <div className={styles.resultHeader}>
            <h3 className={styles.sectionTitle}>{objectMetricText("trialResults")}</h3>
            {result ? (
              <div className={styles.resultMeta}>
                <Tag
                  color={
                    result.status === "ok"
                      ? "success"
                      : result.status === "partial"
                        ? "warning"
                        : result.status === "unavailable"
                          ? "error"
                          : undefined
                  }
                >
                  {trialStatusLabel(result.status)}
                </Tag>
                <span>{objectMetricText("m164ba48e7c5d", { p0: result.overall_ms })}</span>
              </div>
            ) : null}
          </div>
          {error ? <Alert message={error} showIcon type="error" /> : null}
          {result ? (
            <Space direction="vertical" size={16} className={styles.resultContent}>
              {result.warnings?.length ? (
                <Alert message={result.warnings.join("；")} showIcon type="warning" />
              ) : null}
              {result.entries.length ? (
                <>
                  <ObjectMetricAnalysisPanel propertyLabels={propertyLabels} result={result} />
                  <Table
                    columns={[
                      {
                        dataIndex: "instance_identity",
                        key: "instance_identity",
                        render: (value: Record<string, unknown> | undefined) =>
                          displayMetricFields(value, propertyLabels),
                        title: objectMetricText("m99fc84c8b8ae"),
                      },
                      {
                        dataIndex: "dimensions",
                        key: "dimensions",
                        render: (value: Record<string, unknown> | undefined) =>
                          displayMetricFields(value, propertyLabels),
                        title: objectMetricText("m4fa164bacd53"),
                      },
                      {
                        dataIndex: "time",
                        key: "time",
                        render: (value: number | undefined) =>
                          value ? formatMetricTimeLabel(value) : "—",
                        title: objectMetricText("mbf80e223ad96"),
                      },
                      {
                        dataIndex: "value",
                        key: "value",
                        render: displayMetricValue,
                        title: objectMetricText("m6018e00aca78"),
                      },
                      {
                        dataIndex: "status",
                        key: "status",
                        render: (status: ObjectMetricDataV1["entries"][number]["status"]) =>
                          trialStatusLabel(status),
                        title: objectMetricText("m0d9a32dba031"),
                      },
                    ]}
                    dataSource={result.entries.map((item, index) => ({ ...item, key: index }))}
                    locale={{ emptyText: objectMetricText("ma1af72fea205") }}
                    pagination={false}
                    scroll={{ x: 680 }}
                    size="small"
                  />
                </>
              ) : null}
            </Space>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
