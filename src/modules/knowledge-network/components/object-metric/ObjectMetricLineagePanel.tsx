/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Tag, Tooltip } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  atomicMeasureProperties,
  collectObjectMetricDownstream,
  collectObjectMetricUpstream,
  objectMetricVersionKey,
  type MetricLineageEntry,
} from "@/modules/knowledge-network/lib/object-metric-lineage";
import { objectMetricPropertyDisplayName } from "@/modules/knowledge-network/lib/object-metric-display";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectMetricLineagePanel.module.css";

const metricTypeKey = {
  atomic: "mdbd7a1806c97",
  composite: "mfb3d9250b174",
  derived: "m445278d8a39d",
} as const;

const metricStatusKey = {
  deprecated: "ma8c3698b5b8c",
  draft: "m2a2fd29bd27a",
  published: "md334724d6b2f",
  validated: "m1936eafc0c3c",
} as const;

function MetricReference({
  item,
  onOpenMetric,
}: {
  item: MetricLineageEntry;
  onOpenMetric?: (metricId: string, version: number) => void;
}) {
  const definition = item.record?.definition;
  const name = definition?.name ?? item.reference.metric_id;
  return (
    <div className={styles.reference}>
      <Tag
        color={
          !definition
            ? "default"
            : definition.metric_type === "composite"
              ? "purple"
              : definition.metric_type === "derived"
                ? "gold"
                : "green"
        }
      >
        {definition
          ? objectMetricText(metricTypeKey[definition.metric_type])
          : objectMetricText("lineageUnloaded")}
      </Tag>
      <span className={styles.metricIdentity}>
        <span className={styles.version}>v{item.reference.version}</span>
        <Tooltip title={`${name} · ${item.key}`}>
          <Button
            className={styles.metricLink}
            onClick={() => onOpenMetric?.(item.reference.metric_id, item.reference.version)}
            type="link"
          >
            {name}
          </Button>
        </Tooltip>
      </span>
      {definition ? (
        <Tag>{objectMetricText(metricStatusKey[definition.lifecycle.status])}</Tag>
      ) : null}
      {item.depth > 1 ? (
        <span className={styles.indirect}>{objectMetricText("lineageIndirect")}</span>
      ) : null}
    </div>
  );
}

type ObjectMetricLineagePanelProps = {
  metric: ObjectMetricRecordV1;
  metrics: ObjectMetricRecordV1[];
  ownerObjectType?:
    | (Pick<ObjectTypeDetail, "id" | "name" | "logicProperties"> & {
        dataProperties: Array<
          Pick<ObjectTypeDetail["dataProperties"][number], "name" | "displayName">
        >;
      })
    | null;
  onOpenMetric?: (metricId: string, version: number) => void;
};

export function ObjectMetricLineagePanel({
  metric,
  metrics,
  onOpenMetric,
  ownerObjectType,
}: ObjectMetricLineagePanelProps) {
  useTranslation();
  const { pendingDownstream, releasedDownstream, sourceProperties, upstream } = useMemo(() => {
    const recordsByKey = new Map(
      [...metrics, metric].map((item) => [
        objectMetricVersionKey(item.definition.id, item.definition.version),
        item,
      ]),
    );
    const downstream = collectObjectMetricDownstream(metric, metrics);
    return {
      pendingDownstream: downstream.filter(
        (item) =>
          item.record && ["draft", "validated"].includes(item.record.definition.lifecycle.status),
      ),
      releasedDownstream: downstream.filter(
        (item) =>
          item.record &&
          ["published", "deprecated"].includes(item.record.definition.lifecycle.status),
      ),
      sourceProperties: atomicMeasureProperties(metric),
      upstream: collectObjectMetricUpstream(metric, recordsByKey),
    };
  }, [metric, metrics]);

  return (
    <section
      className={styles.panel}
      aria-label={objectMetricText("lineageDependenciesAndReferences")}
    >
      {metric.definition.specification.kind === "atomic" ? (
        <div className={styles.row}>
          <strong>{objectMetricText("lineageMeasureSource")}</strong>
          <div className={styles.rowContent}>
            <span>{ownerObjectType?.name ?? metric.definition.owner_object_type_id}</span>
            {sourceProperties.length ? (
              sourceProperties.map((property) => {
                return (
                  <Tag
                    key={`${property.object_type_id}:${property.relation_path_alias ?? ""}:${property.property_name}`}
                  >
                    {objectMetricPropertyDisplayName(property, ownerObjectType)}
                    {property.relation_path_alias ? ` · ${property.relation_path_alias}` : ""}
                  </Tag>
                );
              })
            ) : (
              <span className={styles.muted}>{objectMetricText("lineageNoMeasureProperty")}</span>
            )}
          </div>
        </div>
      ) : null}
      {upstream.length ? (
        <div className={styles.row}>
          <strong>{objectMetricText("m419edc70d2ad")}</strong>
          <div className={styles.items}>
            {upstream.map((item) => (
              <MetricReference item={item} key={item.key} onOpenMetric={onOpenMetric} />
            ))}
          </div>
        </div>
      ) : metric.definition.specification.kind !== "atomic" ? (
        <p className={styles.muted}>{objectMetricText("lineageNoMetricDependencies")}</p>
      ) : null}
      {releasedDownstream.length ? (
        <div className={styles.row}>
          <strong>{objectMetricText("lineageReleasedDownstream")}</strong>
          <div className={styles.items}>
            {releasedDownstream.map((item) => (
              <MetricReference item={item} key={item.key} onOpenMetric={onOpenMetric} />
            ))}
          </div>
        </div>
      ) : null}
      {pendingDownstream.length ? (
        <div className={styles.row}>
          <strong>{objectMetricText("lineagePendingDownstream")}</strong>
          <div className={styles.items}>
            {pendingDownstream.map((item) => (
              <MetricReference item={item} key={item.key} onOpenMetric={onOpenMetric} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
