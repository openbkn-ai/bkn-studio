/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  extractRequestErrorDetails,
  isRequestForbidden,
  isRequestNotFound,
} from "@/framework/request/error-message";
import { ObjectMetricLineagePanel } from "@/modules/knowledge-network/components/object-metric/ObjectMetricLineagePanel";
import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import {
  expressionLabel,
  replaceObjectMetricDependencyAliases,
} from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import { objectMetricBusinessConditionLabel } from "@/modules/knowledge-network/lib/object-metric-condition-label";
import {
  objectMetricTimeWindowBusinessLabel,
  objectMetricTimeWindowSelection,
} from "@/modules/knowledge-network/lib/object-metric-time-window";
import {
  directObjectMetricReferences,
  objectMetricVersionKey,
  resolveObjectMetricReferences,
  type MetricReferenceResolution,
} from "@/modules/knowledge-network/lib/object-metric-lineage";
import {
  bindObjectMetricLogicPropertyV1,
  createNextObjectMetricDraftV1,
  getObjectMetricV1,
  listObjectMetricsV1,
  listObjectMetricVersionsV1,
  queryObjectMetricDataV1,
} from "@/modules/knowledge-network/services/object-metric.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import {
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  MetricPropertyBindingV1,
  ObjectMetricRecordV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectMetricDetailScene.module.css";

const typeNames = { atomic: "原子指标", composite: "复合指标", derived: "衍生指标" };
const statusNames: Record<ObjectMetricRecordV1["definition"]["lifecycle"]["status"], string> = {
  deprecated: "已停用",
  draft: "草稿",
  published: "已发布",
  validated: "已校验",
};

const aggregationNames: Record<string, string> = {
  avg: "平均值",
  count: "非空计数",
  count_distinct: "去重计数",
  count_rows: "计数",
  identity: "直接读取",
  max: "最大值",
  min: "最小值",
  sum: "求和",
};

function timeWindowLabel(
  window: Extract<
    ObjectMetricRecordV1["definition"]["specification"],
    { kind: "derived" }
  >["business_qualifiers"]["time_window"],
) {
  if (!window || window.mode === "unbounded") return "不限时间";
  if (window.mode === "rolling") return `最近 ${window.length} ${window.unit}`;
  if (window.mode === "fixed_range") {
    return `${dayjs(window.start_at).format("YYYY-MM-DD HH:mm")} 至 ${dayjs(window.end_at).format("YYYY-MM-DD HH:mm")} · ${window.timezone}`;
  }
  return `${objectMetricTimeWindowBusinessLabel(objectMetricTimeWindowSelection(window)) ?? window.period} · ${window.timezone}`;
}

function dependencyFailureLabel(error: unknown, version: number) {
  if (isRequestNotFound(error)) return `依赖版本不存在 · v${version}`;
  if (isRequestForbidden(error)) return `无权读取依赖指标 · v${version}`;
  return `依赖指标读取失败 · v${version}`;
}

function dependencyFailureDescription(error: unknown) {
  const details = extractRequestErrorDetails(error);
  return details.details ? `${details.description}：${details.details}` : details.description;
}

export function ObjectMetricDetailScene() {
  const { metricId = "", networkId = "" } = useParams<{ metricId: string; networkId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [record, setRecord] = useState<ObjectMetricRecordV1>();
  const [versions, setVersions] = useState<ObjectMetricRecordV1[]>([]);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [lineageMetrics, setLineageMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [publishedMetrics, setPublishedMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [dependencyResolution, setDependencyResolution] = useState<{
    entries: MetricReferenceResolution[];
    rootKey: string;
  }>();
  const [ownerObjectType, setOwnerObjectType] = useState<ObjectTypeDetail | null>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"forbidden" | "not-found" | "unknown" | null>(null);
  const [bindingOpen, setBindingOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [bindingForm] =
    Form.useForm<Pick<MetricPropertyBindingV1, "comment" | "display_name" | "property_name">>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setRecord(undefined);

    void getObjectMetricV1(networkId, metricId, undefined, { skipErrorToast: true })
      .then(async (latest) => {
        if (!latest || !active) {
          if (active) setLoadError("not-found");
          return;
        }
        setRecord(latest);
        const [entries, objects, relations, metrics, allMetrics] = await Promise.all([
          listObjectMetricVersionsV1(networkId, metricId, { skipErrorToast: true }),
          listKnowledgeNetworkObjectTypes(networkId, { skipErrorToast: true }),
          listKnowledgeNetworkRelationTypes(networkId),
          listObjectMetricsV1(
            networkId,
            { limit: 500, status: "published" },
            { skipErrorToast: true },
          ),
          listObjectMetricsV1(networkId, { limit: 500 }, { skipErrorToast: true }),
        ]);
        if (!active) return;
        setVersions(entries);
        setObjectTypes(objects);
        setRelationTypes(relations);
        setPublishedMetrics(metrics.entries);
        setLineageMetrics(allMetrics.entries);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          isRequestForbidden(error)
            ? "forbidden"
            : isRequestNotFound(error)
              ? "not-found"
              : "unknown",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [metricId, networkId]);

  useEffect(() => {
    if (!record?.definition.owner_object_type_id) return;
    void getKnowledgeNetworkObjectTypeDetail(
      networkId,
      record.definition.owner_object_type_id,
    ).then(setOwnerObjectType);
  }, [networkId, record?.definition.owner_object_type_id]);

  const dependencyReferenceSignature = record
    ? directObjectMetricReferences(record)
        .map((item) => objectMetricVersionKey(item.metric_id, item.version))
        .join("|")
    : "";

  useEffect(() => {
    const current = record?.definition;
    if (!current) {
      setDependencyResolution(undefined);
      return;
    }
    let active = true;
    const rootKey = objectMetricVersionKey(current.id, current.version);
    void resolveObjectMetricReferences(
      directObjectMetricReferences(record),
      (dependencyMetricId, dependencyVersion) =>
        getObjectMetricV1(networkId, dependencyMetricId, dependencyVersion, {
          skipErrorToast: true,
        }),
    ).then((entries) => {
      if (active) setDependencyResolution({ entries, rootKey });
    });
    return () => {
      active = false;
    };
  }, [dependencyReferenceSignature, networkId, record]);

  if (loading)
    return (
      <div className={styles.loading}>
        <Spin />
      </div>
    );
  if (!record) {
    if (loadError === "forbidden") {
      return (
        <Alert
          description="当前账号没有查看该指标定义的权限，请联系知识网络管理员授权。"
          message="无权查看该指标"
          showIcon
          type="warning"
        />
      );
    }
    return (
      <Empty description={loadError === "unknown" ? "指标加载失败，请稍后重试" : "指标不存在"} />
    );
  }
  const definition = record.definition;
  const specification = definition.specification;
  const expression =
    specification.kind === "atomic"
      ? specification.measure.expression
      : specification.kind === "composite"
        ? specification.expression
        : undefined;
  const canQuery = ["published", "deprecated"].includes(definition.lifecycle.status);
  const currentRootKey = objectMetricVersionKey(definition.id, definition.version);
  const dependenciesResolving = dependencyResolution?.rootKey !== currentRootKey;
  const exactDependencies = new Map(
    dependencyResolution?.rootKey === currentRootKey
      ? dependencyResolution.entries.map((entry) => [entry.key, entry])
      : [],
  );
  const compositeDependencies =
    specification.kind === "composite"
      ? specification.dependencies.map((dependency) => {
          const resolution = exactDependencies.get(
            objectMetricVersionKey(dependency.metric_ref.metric_id, dependency.metric_ref.version),
          );
          return {
            dependency,
            error: resolution?.error,
            loading: dependenciesResolving,
            record: resolution?.record,
          };
        })
      : [];
  const compositeDependencyLabels = Object.fromEntries(
    compositeDependencies.flatMap(({ dependency, record }) =>
      record ? [[dependency.alias, record.definition.name]] : [],
    ),
  );
  const exactDependencyRecords =
    dependencyResolution?.rootKey === currentRootKey
      ? dependencyResolution.entries.flatMap(({ record: dependencyRecord }) =>
          dependencyRecord ? [dependencyRecord] : [],
        )
      : [];
  const lineageCatalog = [
    ...lineageMetrics.filter(
      (candidate) =>
        !exactDependencyRecords.some(
          (exact) =>
            exact.definition.id === candidate.definition.id &&
            exact.definition.version === candidate.definition.version,
        ),
    ),
    ...exactDependencyRecords,
  ];

  const bindLogicProperty = async (
    values: Pick<MetricPropertyBindingV1, "comment" | "display_name" | "property_name">,
  ) => {
    await bindObjectMetricLogicPropertyV1(networkId, definition.id, definition.version, {
      ...values,
      execution: { mode: "realtime" },
      metric_ref: { metric_id: definition.id, version: definition.version },
      no_data_policy: definition.result_semantics.no_data_policy,
      object_type_id: definition.owner_object_type_id,
      on_error: "unavailable",
      status: "published",
    });
    void message.success("已添加到对象类逻辑属性");
    setBindingOpen(false);
  };

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <Select
            onChange={(version) => {
              const selected = versions.find((item) => item.definition.version === version);
              if (selected) setRecord(selected);
            }}
            options={versions.map((item) => ({
              label: `v${item.definition.version} · ${statusNames[item.definition.lifecycle.status] ?? item.definition.lifecycle.status}`,
              value: item.definition.version,
            }))}
            value={definition.version}
            className={styles.versionSelect}
          />
          <h1>{definition.name}</h1>
          <p>
            {definition.code}@v{definition.version}
          </p>
        </div>
        <div className={styles.actions}>
          <Button
            onClick={() => void navigate(`/knowledge-network/workspace/${networkId}/metrics`)}
          >
            返回列表
          </Button>
          <Button
            onClick={() => {
              void (async () => {
                if (["published", "deprecated"].includes(definition.lifecycle.status)) {
                  await createNextObjectMetricDraftV1(networkId, definition.id);
                }
                void navigate(
                  `/knowledge-network/workspace/${networkId}/metrics/${definition.id}/edit`,
                );
              })();
            }}
            type="primary"
          >
            {["published", "deprecated"].includes(definition.lifecycle.status)
              ? "创建新版本"
              : "编辑草稿"}
          </Button>
        </div>
      </div>
      <div className={styles.content}>
        {(location.state as { justPublished?: boolean } | null)?.justPublished ? (
          <Alert
            message={`指标已发布为 v${definition.version}`}
            description="可以继续试算已发布版本，或将单个实例指标配置为逻辑属性。"
            type="success"
            showIcon
            closable
          />
        ) : null}
        <Card className={styles.sectionCard} title="使用与验证">
          <div className={styles.usageGrid}>
            <div className={styles.usageItem}>
              <div>
                <strong>试算真实数据</strong>
                <p>使用当前已发布版本读取业务数据，核对指标结果。</p>
              </div>
              <Button disabled={!canQuery} onClick={() => setTrialOpen(true)}>
                {canQuery ? "开始试算" : "发布后可试算"}
              </Button>
            </div>
            <div className={styles.usageItem}>
              <div>
                <strong>作为逻辑属性使用</strong>
                <p>让单个实例指标像对象属性一样被查询和引用。</p>
              </div>
              <Button
                disabled={
                  definition.lifecycle.status !== "published" ||
                  definition.calculation_scope !== "object_instance"
                }
                onClick={() => setBindingOpen(true)}
              >
                {definition.calculation_scope !== "object_instance"
                  ? "仅适用于单个实例"
                  : definition.lifecycle.status === "published"
                    ? "配置逻辑属性"
                    : "发布后可配置"}
              </Button>
            </div>
          </div>
        </Card>
        <Card className={styles.sectionCard} title="业务定义">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="指标类型">
              <Tag color="blue">{typeNames[definition.metric_type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={definition.lifecycle.status === "published" ? "success" : "default"}>
                {statusNames[definition.lifecycle.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="主归属对象类">
              {objectTypes.find((item) => item.id === definition.owner_object_type_id)?.name ??
                definition.owner_object_type_id}
            </Descriptions.Item>
            <Descriptions.Item label="计算对象">
              {definition.calculation_scope === "object_instance" ? "单个实例" : "实例集合"}
            </Descriptions.Item>
            <Descriptions.Item label="业务定义" span={2}>
              {definition.description}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card className={styles.sectionCard} title="计算逻辑">
          {specification.kind === "atomic" ? (
            <Descriptions column={2}>
              <Descriptions.Item label="聚合方式">
                {aggregationNames[specification.measure.aggregation] ??
                  specification.measure.aggregation}
              </Descriptions.Item>
              <Descriptions.Item label="度量表达式">
                {expression ? expressionLabel(expression) : "计数"}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {specification.kind === "derived" ? (
            <Descriptions column={2}>
              <Descriptions.Item label="基础原子指标">
                {publishedMetrics.find(
                  (item) =>
                    item.definition.id === specification.base_metric.metric_id &&
                    item.definition.version === specification.base_metric.version,
                )?.definition.name ?? specification.base_metric.metric_id}
                @v{specification.base_metric.version}
              </Descriptions.Item>
              <Descriptions.Item label="时间窗口">
                {timeWindowLabel(specification.business_qualifiers.time_window)}
              </Descriptions.Item>
              <Descriptions.Item label="业务条件" span={2}>
                {objectMetricBusinessConditionLabel(specification.business_qualifiers)}
              </Descriptions.Item>
              <Descriptions.Item label="关系类路径" span={2}>
                {specification.business_qualifiers.relation_path?.steps
                  .map(
                    (step) =>
                      relationTypes.find((item) => item.id === step.relation_type_id)?.name ??
                      step.relation_type_id,
                  )
                  .join(" → ") || "未使用关系路径"}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {specification.kind === "composite" ? (
            <Descriptions column={1}>
              <Descriptions.Item label="依赖指标">
                <Space size={[8, 8]} wrap>
                  {compositeDependencies.map(
                    ({
                      dependency,
                      error,
                      loading: dependencyLoading,
                      record: dependencyRecord,
                    }) => {
                      const tag = (
                        <Tag
                          color={
                            dependencyRecord ? "blue" : dependencyLoading ? "default" : "error"
                          }
                          key={`${dependency.metric_ref.metric_id}@${dependency.metric_ref.version}`}
                        >
                          {dependencyRecord
                            ? `${dependencyRecord.definition.name} · v${dependencyRecord.definition.version} · ${typeNames[dependencyRecord.definition.metric_type]} · ${statusNames[dependencyRecord.definition.lifecycle.status]}（公式符号：${dependency.alias}）`
                            : dependencyLoading
                              ? `正在读取依赖指标 · v${dependency.metric_ref.version}（公式符号：${dependency.alias}）`
                              : `${dependencyFailureLabel(error, dependency.metric_ref.version)}（公式符号：${dependency.alias}）`}
                        </Tag>
                      );
                      return error ? (
                        <Tooltip
                          key={`${dependency.metric_ref.metric_id}@${dependency.metric_ref.version}`}
                          title={dependencyFailureDescription(error)}
                        >
                          {tag}
                        </Tooltip>
                      ) : (
                        tag
                      );
                    },
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="业务公式">
                {expressionLabel(
                  replaceObjectMetricDependencyAliases(
                    specification.expression,
                    compositeDependencyLabels,
                  ),
                )}
              </Descriptions.Item>
              <Descriptions.Item label="技术表达式">
                {expressionLabel(specification.expression)}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
        </Card>
        <Card className={styles.sectionCard} title="血缘与影响">
          <ObjectMetricLineagePanel
            logicProperties={ownerObjectType?.logicProperties ?? []}
            metric={record}
            metrics={lineageCatalog}
          />
        </Card>
        <Card className={styles.sectionCard} title="结果与分析">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="固定分组维度">
              {definition.result_semantics.statistical_grain.group_by_dimensions
                .map((item) => item.property_name)
                .join("、") || "无（返回汇总值）"}
            </Descriptions.Item>
            <Descriptions.Item label="时间粒度">
              {definition.result_semantics.statistical_grain.time_granularity
                ? `${definition.result_semantics.statistical_grain.time_granularity} · ${definition.result_semantics.statistical_grain.timezone ?? "未指定时区"}${definition.result_semantics.statistical_grain.week_start ? ` · 每周从 ${definition.result_semantics.statistical_grain.week_start} 开始` : ""}`
                : "无"}
            </Descriptions.Item>
            <Descriptions.Item label="值类型">
              {definition.result_semantics.value.physical_type} /{" "}
              {definition.result_semantics.value.semantic_type}
            </Descriptions.Item>
            <Descriptions.Item label="单位">
              {definition.result_semantics.value.unit?.code ?? "无"}
            </Descriptions.Item>
            <Descriptions.Item label="开放分析维度">
              {definition.query_capabilities.analysis_dimensions
                .map((item) => item.property_name)
                .join("、") || "无"}
            </Descriptions.Item>
            <Descriptions.Item label="可查询时间维度">
              {definition.query_capabilities.time_dimensions
                .map((item) => item.property_name)
                .join("、") || "无"}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="published"
        objectType={ownerObjectType}
        onClose={() => setTrialOpen(false)}
        onRun={(query) =>
          queryObjectMetricDataV1(networkId, definition.id, definition.version, query)
        }
        open={trialOpen}
      />
      <Drawer
        destroyOnHidden
        forceRender
        onClose={() => setBindingOpen(false)}
        open={bindingOpen}
        rootClassName={styles.drawer}
        title="绑定为对象类逻辑属性"
        width="min(520px, calc(100vw - 24px))"
      >
        <Alert
          message="逻辑属性随实例按需计算"
          description={`该属性绑定到对象类 ${definition.owner_object_type_id}，唯一标识沿用对象类主键，不需要再次配置。`}
          type="info"
          showIcon
        />
        <Form
          form={bindingForm}
          layout="vertical"
          onFinish={(values) => {
            void bindLogicProperty(values);
          }}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="属性名称"
            name="property_name"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: "请输入合法属性名称" },
            ]}
          >
            <Input placeholder="例如 fulfilment_duration" />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name" rules={[{ required: true }]}>
            <Input placeholder="例如 履约耗时" />
          </Form.Item>
          <Form.Item label="说明" name="comment">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button htmlType="submit" type="primary">
            确认绑定
          </Button>
        </Form>
      </Drawer>
    </main>
  );
}
