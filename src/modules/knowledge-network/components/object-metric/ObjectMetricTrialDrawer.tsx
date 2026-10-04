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
    return "计算属性返回了文本值，不能直接进行四则运算。请在对应的左侧值或右侧值中选择“文本转数值”后重试。";
  }
  if (details.details?.includes("to_number")) {
    return "存在无法转换为数值的文本。请检查所选属性中的空字符串、中文、货币符号或其他非数字内容。";
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
          ? `试算当前配置 · ${definition.name || "未命名指标"}`
          : `试算真实数据 · ${definition.name}@v${definition.version}`
      }
      width="min(760px, calc(100vw - 24px))"
    >
      <Alert
        message={mode === "draft" ? "使用当前配置试算真实数据" : "读取已发布指标的真实结果"}
        description={
          mode === "draft"
            ? "试算不会保存、发布或改写指标；正式发布仍需通过配置检查。"
            : "指标定义和固定口径不会被改写；这里只提供实例、查询时间范围和分析维度等运行时参数。"
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
                  rules={[{ required: true, message: "请输入实例 ID" }]}
                >
                  <Input placeholder={`按对象类主键 ${name} 定位实例`} />
                </Form.Item>
              );
            })
          ) : (
            <Alert message="对象类尚未配置主键，无法定位单个实例" type="error" showIcon />
          )
        ) : null}
        {usesFixedDerivedTimeWindow ? (
          <Alert
            message="本次试算使用当前配置中的固定时间范围"
            description="固定时间口径不会在试算时被临时查询条件覆盖。"
            showIcon
            style={{ marginBottom: 20 }}
            type="info"
          />
        ) : (
          <Form.Item
            label="查询时间范围（可选）"
            name="time"
            tooltip="未填写时查询全部可用数据；填写后仅影响本次试算，不会写回指标配置"
          >
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
        )}
        {definition.calculation_scope === "object_set" ? (
          <Form.Item label="按分析维度拆解（可选）" name="analysisDimensions">
            <Select
              mode="multiple"
              options={definition.query_capabilities.analysis_dimensions.map((item) => ({
                label: item.property_name,
                value: item.property_name,
              }))}
              placeholder="不选择时按指标固定粒度返回"
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
          开始试算
        </Button>
      </Form>
      {error ? (
        <Alert
          description="文本属性只有明确配置“文本转数值”后才会转换，系统不会隐式转换订单号、编码等文本。"
          message={error}
          showIcon
          style={{ marginTop: 20 }}
          type="error"
        />
      ) : null}
      {result ? (
        <Space direction="vertical" size={16} style={{ display: "flex", marginTop: 24 }}>
          <Alert
            message={`执行状态：${result.status}`}
            description={
              result.warnings?.length
                ? `${result.warnings.join("；")}（耗时 ${result.overall_ms} ms）`
                : `耗时 ${result.overall_ms} ms`
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
                title: "实例 ID",
              },
              {
                dataIndex: "dimensions",
                key: "dimensions",
                render: (value: Record<string, unknown> | undefined) =>
                  value && Object.keys(value).length ? JSON.stringify(value) : "—",
                title: "维度",
              },
              {
                dataIndex: "time",
                key: "time",
                render: (value: number | undefined) => (value ? formatMetricTimeLabel(value) : "—"),
                title: "时间（UTC）",
              },
              { dataIndex: "value", key: "value", render: displayMetricValue, title: "指标值" },
              { dataIndex: "status", key: "status", title: "结果状态" },
            ]}
            dataSource={result.entries.map((item, index) => ({ ...item, key: index }))}
            locale={{ emptyText: "当前条件下没有可返回的指标结果" }}
            pagination={false}
            size="small"
          />
        </Space>
      ) : null}
    </Drawer>
  );
}
