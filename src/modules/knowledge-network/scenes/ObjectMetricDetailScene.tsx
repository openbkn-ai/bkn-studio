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
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

const typeNames = {
  get atomic() {
    return objectMetricText("me5675ba4c2fd");
  },
  get composite() {
    return objectMetricText("m3e70c815f275");
  },
  get derived() {
    return objectMetricText("me88b222ae28a");
  },
};
const statusNames: Record<ObjectMetricRecordV1["definition"]["lifecycle"]["status"], string> = {
  get deprecated() {
    return objectMetricText("ma8c3698b5b8c");
  },
  get draft() {
    return objectMetricText("m2a2fd29bd27a");
  },
  get published() {
    return objectMetricText("md334724d6b2f");
  },
  get validated() {
    return objectMetricText("m1936eafc0c3c");
  },
};

const aggregationNames: Record<string, string> = {
  get avg() {
    return objectMetricText("mdb7538b96322");
  },
  get count() {
    return objectMetricText("m3a6663a758c9");
  },
  get count_distinct() {
    return objectMetricText("m1e96cd1f49bf");
  },
  get count_rows() {
    return objectMetricText("m21179deb9a74");
  },
  get identity() {
    return objectMetricText("m7ea9fbba115d");
  },
  get max() {
    return objectMetricText("m1e7a22820768");
  },
  get min() {
    return objectMetricText("mb2dcdcfabb6a");
  },
  get sum() {
    return objectMetricText("m2819237ddb01");
  },
};

function timeWindowLabel(
  window: Extract<
    ObjectMetricRecordV1["definition"]["specification"],
    { kind: "derived" }
  >["business_qualifiers"]["time_window"],
) {
  if (!window || window.mode === "unbounded") return objectMetricText("m12edbc42122f");
  if (window.mode === "rolling")
    return objectMetricText("mff99c135adbc", { p0: window.length, p1: window.unit });
  if (window.mode === "fixed_range") {
    return objectMetricText("mf971493b1e41", {
      p0: dayjs(window.start_at).format("YYYY-MM-DD HH:mm"),
      p1: dayjs(window.end_at).format("YYYY-MM-DD HH:mm"),
      p2: window.timezone,
    });
  }
  return `${objectMetricTimeWindowBusinessLabel(objectMetricTimeWindowSelection(window)) ?? window.period} · ${window.timezone}`;
}

function dependencyFailureLabel(error: unknown, version: number) {
  if (isRequestNotFound(error)) return objectMetricText("mf40f436696fb", { p0: version });
  if (isRequestForbidden(error)) return objectMetricText("m193341f84d98", { p0: version });
  return objectMetricText("m654b86d99a38", { p0: version });
}

function dependencyFailureDescription(error: unknown) {
  const details = extractRequestErrorDetails(error);
  return details.details ? `${details.description}：${details.details}` : details.description;
}

export function ObjectMetricDetailScene() {
  useTranslation();
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
    const ownerObjectTypeId = record?.definition.owner_object_type_id;
    setOwnerObjectType(null);
    if (!ownerObjectTypeId) return;
    let active = true;
    void getKnowledgeNetworkObjectTypeDetail(networkId, ownerObjectTypeId)
      .then((detail) => {
        if (active) setOwnerObjectType(detail);
      })
      .catch(() => {
        if (active) setOwnerObjectType(null);
      });
    return () => {
      active = false;
    };
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
          description={objectMetricText("m9590c71c5808")}
          message={objectMetricText("m2a9ed8385cd1")}
          showIcon
          type="warning"
        />
      );
    }
    return (
      <Empty
        description={
          loadError === "unknown"
            ? objectMetricText("m51fc5b3bc879")
            : objectMetricText("mcbc612fb7c63")
        }
      />
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
    void message.success(objectMetricText("mbc21b4167a12"));
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
            {objectMetricText("me9d5ca6c1406")}
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
              ? objectMetricText("m5a3f1953b1fb")
              : objectMetricText("m9d0eedd99d2b")}
          </Button>
        </div>
      </div>
      <div className={styles.content}>
        {(location.state as { justPublished?: boolean } | null)?.justPublished ? (
          <Alert
            message={objectMetricText("m7d6fe77cb980", { p0: definition.version })}
            description={objectMetricText("ma9b914cb8eda")}
            type="success"
            showIcon
            closable
          />
        ) : null}
        <Card className={styles.sectionCard} title={objectMetricText("mb76466842ab3")}>
          <div className={styles.usageGrid}>
            <div className={styles.usageItem}>
              <div>
                <strong>{objectMetricText("m073728637a26")}</strong>
                <p>{objectMetricText("m7a26b9117cf8")}</p>
              </div>
              <Button disabled={!canQuery} onClick={() => setTrialOpen(true)}>
                {canQuery ? objectMetricText("mf143bd50d496") : objectMetricText("mf4389f020d9b")}
              </Button>
            </div>
            <div className={styles.usageItem}>
              <div>
                <strong>{objectMetricText("mb847b6e39e27")}</strong>
                <p>{objectMetricText("md320de80ff41")}</p>
              </div>
              <Button
                disabled={
                  definition.lifecycle.status !== "published" ||
                  definition.calculation_scope !== "object_instance"
                }
                onClick={() => setBindingOpen(true)}
              >
                {definition.calculation_scope !== "object_instance"
                  ? objectMetricText("m71a96d83271b")
                  : definition.lifecycle.status === "published"
                    ? objectMetricText("m915fe912305c")
                    : objectMetricText("m8f301dc74371")}
              </Button>
            </div>
          </div>
        </Card>
        <Card className={styles.sectionCard} title={objectMetricText("m419eb90613fd")}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label={objectMetricText("m7626be61e570")}>
              <Tag color="blue">{typeNames[definition.metric_type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m6320b4a8722a")}>
              <Tag color={definition.lifecycle.status === "published" ? "success" : "default"}>
                {statusNames[definition.lifecycle.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m26c439016066")}>
              {objectTypes.find((item) => item.id === definition.owner_object_type_id)?.name ??
                definition.owner_object_type_id}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("mec7844e49915")}>
              {definition.calculation_scope === "object_instance"
                ? objectMetricText("mabe9d02781fc")
                : objectMetricText("m9c51e86f9307")}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m419eb90613fd")} span={2}>
              {definition.description}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card className={styles.sectionCard} title={objectMetricText("m6c7b29b8b211")}>
          {specification.kind === "atomic" ? (
            <Descriptions column={2}>
              <Descriptions.Item label={objectMetricText("mb17e03bc6bad")}>
                {aggregationNames[specification.measure.aggregation] ??
                  specification.measure.aggregation}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("me92a76d3b298")}>
                {expression ? expressionLabel(expression) : objectMetricText("m21179deb9a74")}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {specification.kind === "derived" ? (
            <Descriptions column={2}>
              <Descriptions.Item label={objectMetricText("m4919ba2e9c0b")}>
                {publishedMetrics.find(
                  (item) =>
                    item.definition.id === specification.base_metric.metric_id &&
                    item.definition.version === specification.base_metric.version,
                )?.definition.name ?? specification.base_metric.metric_id}
                @v{specification.base_metric.version}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("me306e231fb23")}>
                {timeWindowLabel(specification.business_qualifiers.time_window)}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("m391f2f5d1034")} span={2}>
                {objectMetricBusinessConditionLabel(specification.business_qualifiers)}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("mf8c41076f5dc")} span={2}>
                {specification.business_qualifiers.relation_path?.steps
                  .map(
                    (step) =>
                      relationTypes.find((item) => item.id === step.relation_type_id)?.name ??
                      step.relation_type_id,
                  )
                  .join(" → ") || objectMetricText("m21f55b7680c9")}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {specification.kind === "composite" ? (
            <Descriptions column={1}>
              <Descriptions.Item label={objectMetricText("ma6ace5b29ab9")}>
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
                            ? objectMetricText("m12e768346231", {
                                p0: dependencyRecord.definition.name,
                                p1: dependencyRecord.definition.version,
                                p2: typeNames[dependencyRecord.definition.metric_type],
                                p3: statusNames[dependencyRecord.definition.lifecycle.status],
                                p4: dependency.alias,
                              })
                            : dependencyLoading
                              ? objectMetricText("m7d9782471028", {
                                  p0: dependency.metric_ref.version,
                                  p1: dependency.alias,
                                })
                              : objectMetricText("mcb1ed2f66b66", {
                                  p0: dependencyFailureLabel(error, dependency.metric_ref.version),
                                  p1: dependency.alias,
                                })}
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
              <Descriptions.Item label={objectMetricText("me1126763a0f0")}>
                {expressionLabel(
                  replaceObjectMetricDependencyAliases(
                    specification.expression,
                    compositeDependencyLabels,
                  ),
                )}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("m485ac2c76c24")}>
                {expressionLabel(specification.expression)}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
        </Card>
        <Card className={styles.sectionCard} title={objectMetricText("m7f4551dd15d1")}>
          <ObjectMetricLineagePanel
            logicProperties={ownerObjectType?.logicProperties ?? []}
            metric={record}
            metrics={lineageCatalog}
          />
        </Card>
        <Card className={styles.sectionCard} title={objectMetricText("mf006fe7f4bbf")}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label={objectMetricText("m88459b43afb6")}>
              {definition.result_semantics.statistical_grain.group_by_dimensions
                .map((item) => item.property_name)
                .join("、") || objectMetricText("m9f05b0e41cb5")}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m0a2ce90e187a")}>
              {definition.result_semantics.statistical_grain.time_granularity
                ? `${definition.result_semantics.statistical_grain.time_granularity} · ${definition.result_semantics.statistical_grain.timezone ?? objectMetricText("m589d84e4cca8")}${definition.result_semantics.statistical_grain.week_start ? objectMetricText("m8dba6895a41a", { p0: definition.result_semantics.statistical_grain.week_start }) : ""}`
                : objectMetricText("m484d55613910")}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("me659c05e3760")}>
              {definition.result_semantics.value.physical_type} /{" "}
              {definition.result_semantics.value.semantic_type}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m80b19d68b149")}>
              {definition.result_semantics.value.unit?.code ?? objectMetricText("m484d55613910")}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m9a004b7a1da9")}>
              {definition.query_capabilities.analysis_dimensions
                .map((item) => item.property_name)
                .join("、") || objectMetricText("m484d55613910")}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m40e232fef99f")}>
              {definition.query_capabilities.time_dimensions
                .map((item) => item.property_name)
                .join("、") || objectMetricText("m484d55613910")}
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
        title={objectMetricText("m6c461a9f092b")}
        width="min(520px, calc(100vw - 24px))"
      >
        <Alert
          message={objectMetricText("m517a1a8a0069")}
          description={objectMetricText("mca81dbf346a3", { p0: definition.owner_object_type_id })}
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
            label={objectMetricText("maac14899bd42")}
            name="property_name"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: objectMetricText("m1223e28b1644") },
            ]}
          >
            <Input placeholder={objectMetricText("m262469df7a5d")} />
          </Form.Item>
          <Form.Item
            label={objectMetricText("ma98585871c53")}
            name="display_name"
            rules={[{ required: true }]}
          >
            <Input placeholder={objectMetricText("me8b7c5d7cc73")} />
          </Form.Item>
          <Form.Item label={objectMetricText("m4262c45dc797")} name="comment">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button htmlType="submit" type="primary">
            {objectMetricText("md45097132e0d")}
          </Button>
        </Form>
      </Drawer>
    </main>
  );
}
