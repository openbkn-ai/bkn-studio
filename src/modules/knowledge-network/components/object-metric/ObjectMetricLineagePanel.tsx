/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowDownOutlined, LinkOutlined } from "@ant-design/icons";
import { Empty, Tag, Tooltip } from "antd";
import { useMemo } from "react";

import {
  collectObjectMetricDownstream,
  collectObjectMetricUpstream,
  objectMetricVersionKey,
  type MetricLineageEntry,
} from "@/modules/knowledge-network/lib/object-metric-lineage";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectMetricLineagePanel.module.css";

function logicPropertyUsesMetric(property: ObjectTypeLogicProperty, metric: ObjectMetricRecordV1) {
  return (
    property.dataSource?.id ===
    `object_metric_v1:${metric.definition.id}@${metric.definition.version}`
  );
}

function MetricNode({ item }: { item: MetricLineageEntry }) {
  const definition = item.record?.definition;
  return (
    <div className={styles.node} style={{ marginLeft: Math.min(item.depth - 1, 3) * 16 }}>
      <Tag
        color={
          definition?.metric_type === "composite"
            ? "purple"
            : definition?.metric_type === "derived"
              ? "gold"
              : "green"
        }
      >
        {definition?.metric_type === "composite"
          ? "复合"
          : definition?.metric_type === "derived"
            ? "衍生"
            : definition?.metric_type === "atomic"
              ? "原子"
              : "指标"}
      </Tag>
      <Tooltip title={item.key}>
        <span>{definition?.name ?? item.reference.metric_id}</span>
      </Tooltip>
      <small>@v{item.reference.version}</small>
      {!definition ? <em>当前没有可访问的定义</em> : null}
    </div>
  );
}

type ObjectMetricLineagePanelProps = {
  metric: ObjectMetricRecordV1;
  metrics: ObjectMetricRecordV1[];
  logicProperties: ObjectTypeLogicProperty[];
};

export function ObjectMetricLineagePanel({
  logicProperties,
  metric,
  metrics,
}: ObjectMetricLineagePanelProps) {
  const { downstream, logicBindings, upstream } = useMemo(() => {
    const recordsByKey = new Map(
      [...metrics, metric].map((item) => [
        objectMetricVersionKey(item.definition.id, item.definition.version),
        item,
      ]),
    );
    return {
      downstream: collectObjectMetricDownstream(metric, metrics),
      logicBindings: logicProperties.filter((item) => logicPropertyUsesMetric(item, metric)),
      upstream: collectObjectMetricUpstream(metric, recordsByKey),
    };
  }, [logicProperties, metric, metrics]);

  return (
    <section className={styles.panel} aria-label="指标血缘">
      <div className={styles.header}>
        <div>
          <h3>
            <LinkOutlined /> 指标血缘
          </h3>
          <p>查看当前版本的上下游依赖与逻辑属性引用。</p>
        </div>
        <div className={styles.counts}>
          <Tag>上游 {upstream.length}</Tag>
          <Tag color={downstream.length ? "warning" : "default"}>下游 {downstream.length}</Tag>
          <Tag color={logicBindings.length ? "processing" : "default"}>
            逻辑属性 {logicBindings.length}
          </Tag>
        </div>
      </div>
      <div className={styles.flow}>
        <div className={styles.column}>
          <h4>上游指标</h4>
          {upstream.length ? (
            upstream.map((item) => <MetricNode item={item} key={item.key} />)
          ) : (
            <Empty description="没有依赖指标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
        <ArrowDownOutlined className={styles.arrow} rotate={-90} />
        <div className={`${styles.column} ${styles.root}`}>
          <h4>当前指标</h4>
          <div className={styles.rootNode}>
            <Tag color="blue">
              {metric.definition.metric_type === "atomic"
                ? "原子"
                : metric.definition.metric_type === "derived"
                  ? "衍生"
                  : "复合"}
            </Tag>
            <strong>{metric.definition.name}</strong>
            <small>@v{metric.definition.version}</small>
          </div>
        </div>
        <ArrowDownOutlined className={styles.arrow} rotate={-90} />
        <div className={styles.column}>
          <h4>下游指标</h4>
          {downstream.length ? (
            downstream.map((item) => <MetricNode item={item} key={item.key} />)
          ) : (
            <Empty description="没有下游引用" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </div>
      {logicBindings.length ? (
        <div className={styles.bindings}>
          <h4>对象类逻辑属性</h4>
          {logicBindings.map((property) => (
            <Tag key={property.name}>
              {property.displayName || property.name} · {property.name}
            </Tag>
          ))}
        </div>
      ) : null}
    </section>
  );
}
