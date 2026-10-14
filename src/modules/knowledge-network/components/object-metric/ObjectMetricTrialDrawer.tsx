/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, DatePicker, Drawer, Form, Input, Select, Space, Table } from "antd";
import { useState } from "react";

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
  const usesFixedDerivedTimeWindow =
    definition.specification.kind === "derived" &&
    definition.specification.business_qualifiers.time_window?.mode !== undefined &&
    definition.specification.business_qualifiers.time_window.mode !== "unbounded";

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
      destroyOnHidden
      forceRender
      onClose={onClose}
      open={open}
      title={
        mode === "draft"
          ? objectMetricText("mf007eccc9fb2", {
              p0: definition.name || objectMetricText("ma8da957c687c"),
            })
          : objectMetricText("m0c19c9a5c9aa", { p0: definition.name, p1: definition.version })
      }
      width="min(760px, calc(100vw - 24px))"
    >
      <Alert
        message={
          mode === "draft" ? objectMetricText("m938b57be39c0") : objectMetricText("m0926f375ff3b")
        }
        description={
          mode === "draft" ? objectMetricText("m0f8ba014cedf") : objectMetricText("m2ac58784332f")
        }
        type="info"
        showIcon
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void run(values)}
        style={{ marginTop: 20 }}
      >
        {definition.calculation_scope === "object_instance" ? (
          objectType?.primaryKeys.length ? (
            objectType.primaryKeys.map((name) => {
              const property = objectType.dataProperties.find((item) => item.name === name);
              return (
                <Form.Item
                  key={name}
                  label={`${property?.displayName || name} · ${name}`}
                  name={["identity", name]}
                  rules={[{ required: true, message: objectMetricText("m803fff99642e") }]}
                >
                  <Input placeholder={objectMetricText("m52a8e4de05d5", { p0: name })} />
                </Form.Item>
              );
            })
          ) : (
            <Alert message={objectMetricText("md23ea9c2fae2")} type="error" showIcon />
          )
        ) : null}
        {usesFixedDerivedTimeWindow ? (
          <Alert
            message={objectMetricText("m80365c614b62")}
            description={objectMetricText("mf3d478db033d")}
            showIcon
            style={{ marginBottom: 20 }}
            type="info"
          />
        ) : (
          <Form.Item
            label={objectMetricText("m76a5dbc71e2b")}
            name="time"
            tooltip={objectMetricText("mb4dd619d5bbc")}
          >
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
        )}
        {definition.calculation_scope === "object_set" ? (
          <Form.Item label={objectMetricText("m2acf103ad6cf")} name="analysisDimensions">
            <Select
              mode="multiple"
              options={definition.query_capabilities.analysis_dimensions.map((item) => ({
                label: item.property_name,
                value: item.property_name,
              }))}
              placeholder={objectMetricText("m6f346a890bc4")}
            />
          </Form.Item>
        ) : null}
        <Button
          disabled={
            definition.calculation_scope === "object_instance" && !objectType?.primaryKeys.length
          }
          htmlType="submit"
          loading={loading}
          type="primary"
        >
          {objectMetricText("mf143bd50d496")}
        </Button>
      </Form>
      {error ? (
        <Alert
          description={objectMetricText("m4b1d94a3b184")}
          message={error}
          showIcon
          style={{ marginTop: 20 }}
          type="error"
        />
      ) : null}
      {result ? (
        <Space direction="vertical" size={16} style={{ display: "flex", marginTop: 24 }}>
          <Alert
            message={objectMetricText("m4ff4d4be847e", { p0: result.status })}
            description={
              result.warnings?.length
                ? objectMetricText("md105cd96c338", {
                    p0: result.warnings.join("；"),
                    p1: result.overall_ms,
                  })
                : objectMetricText("m164ba48e7c5d", { p0: result.overall_ms })
            }
            type={result.status === "partial" ? "warning" : "success"}
            showIcon
          />
          <ObjectMetricAnalysisPanel result={result} />
          <Table
            columns={[
              {
                dataIndex: "instance_identity",
                key: "instance_identity",
                render: (value: Record<string, unknown> | undefined) =>
                  value ? JSON.stringify(value) : "—",
                title: objectMetricText("m99fc84c8b8ae"),
              },
              {
                dataIndex: "dimensions",
                key: "dimensions",
                render: (value: Record<string, unknown> | undefined) =>
                  value && Object.keys(value).length ? JSON.stringify(value) : "—",
                title: objectMetricText("m4fa164bacd53"),
              },
              {
                dataIndex: "time",
                key: "time",
                render: (value: number | undefined) => (value ? formatMetricTimeLabel(value) : "—"),
                title: objectMetricText("mbf80e223ad96"),
              },
              {
                dataIndex: "value",
                key: "value",
                render: displayMetricValue,
                title: objectMetricText("m6018e00aca78"),
              },
              { dataIndex: "status", key: "status", title: objectMetricText("m0d9a32dba031") },
            ]}
            dataSource={result.entries.map((item, index) => ({ ...item, key: index }))}
            locale={{ emptyText: objectMetricText("ma1af72fea205") }}
            pagination={false}
            size="small"
          />
        </Space>
      ) : null}
    </Drawer>
  );
}
