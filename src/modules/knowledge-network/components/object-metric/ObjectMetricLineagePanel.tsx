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
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

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
          ? objectMetricText("mfb3d9250b174")
          : definition?.metric_type === "derived"
            ? objectMetricText("m445278d8a39d")
            : definition?.metric_type === "atomic"
              ? objectMetricText("mdbd7a1806c97")
              : objectMetricText("mb87e67c7dae0")}
      </Tag>
      <Tooltip title={item.key}>
        <span>{definition?.name ?? item.reference.metric_id}</span>
      </Tooltip>
      <small>@v{item.reference.version}</small>
      {!definition ? <em>{objectMetricText("m3e4f197d0add")}</em> : null}
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
  useTranslation();
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
    <section className={styles.panel} aria-label={objectMetricText("m0e31df4b04a7")}>
      <div className={styles.header}>
        <div>
          <h3>
            <LinkOutlined /> {objectMetricText("m0e31df4b04a7")}
          </h3>
          <p>{objectMetricText("m3f2c7ca35393")}</p>
        </div>
        <div className={styles.counts}>
          <Tag>
            {objectMetricText("ma9ab292ea9fe")} {upstream.length}
          </Tag>
          <Tag color={downstream.length ? "warning" : "default"}>
            {objectMetricText("mfde36e14c8e9")} {downstream.length}
          </Tag>
          <Tag color={logicBindings.length ? "processing" : "default"}>
            {objectMetricText("mc5d0fa67a665")} {logicBindings.length}
          </Tag>
        </div>
      </div>
      <div className={styles.flow}>
        <div className={styles.column}>
          <h4>{objectMetricText("m419edc70d2ad")}</h4>
          {upstream.length ? (
            upstream.map((item) => <MetricNode item={item} key={item.key} />)
          ) : (
            <Empty
              description={objectMetricText("m58a0d1bd2597")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
        <ArrowDownOutlined className={styles.arrow} rotate={-90} />
        <div className={`${styles.column} ${styles.root}`}>
          <h4>{objectMetricText("m510521886ce8")}</h4>
          <div className={styles.rootNode}>
            <Tag color="blue">
              {metric.definition.metric_type === "atomic"
                ? objectMetricText("mdbd7a1806c97")
                : metric.definition.metric_type === "derived"
                  ? objectMetricText("m445278d8a39d")
                  : objectMetricText("mfb3d9250b174")}
            </Tag>
            <strong>{metric.definition.name}</strong>
            <small>@v{metric.definition.version}</small>
          </div>
        </div>
        <ArrowDownOutlined className={styles.arrow} rotate={-90} />
        <div className={styles.column}>
          <h4>{objectMetricText("m361847a7a129")}</h4>
          {downstream.length ? (
            downstream.map((item) => <MetricNode item={item} key={item.key} />)
          ) : (
            <Empty
              description={objectMetricText("m378d1f8deae6")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      </div>
      {logicBindings.length ? (
        <div className={styles.bindings}>
          <h4>{objectMetricText("m82a971b32787")}</h4>
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
