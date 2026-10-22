/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Descriptions, Drawer, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import { objectMetricActions } from "@/modules/knowledge-network/lib/object-metric-actions";
import { findMetricLogicProperty } from "@/modules/knowledge-network/lib/object-metric-binding";
import {
  objectMetricAggregationDisplayName,
  objectMetricPropertyDisplayName,
} from "@/modules/knowledge-network/lib/object-metric-display";
import {
  directObjectMetricReferences,
  objectMetricVersionKey,
  resolveObjectMetricReferences,
} from "@/modules/knowledge-network/lib/object-metric-lineage";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { objectMetricUnitDisplayLabel } from "@/modules/knowledge-network/lib/object-metric-unit-catalog";
import { rootRelationTypeIds } from "@/modules/knowledge-network/lib/object-metric-relation-usage";
import { getObjectMetricV1 } from "@/modules/knowledge-network/services/object-metric.service";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectMetricGraphDetailDrawer.module.css";
import metricTheme from "./ObjectMetricTheme.module.css";

type Props = {
  canDelete?: boolean;
  canModify: boolean;
  metric?: ObjectMetricRecordV1;
  metrics?: ObjectMetricRecordV1[];
  networkId: string;
  onClose: () => void;
  onDeleteVersion?: (metric: ObjectMetricRecordV1) => void;
  onDeprecate?: (metric: ObjectMetricRecordV1) => void;
  onEditMetric?: (metric: ObjectMetricRecordV1) => void;
  onOpenMetric: (metric: ObjectMetricRecordV1) => void;
  onTrialMetric?: (metric: ObjectMetricRecordV1) => void;
  open: boolean;
  ownerObjectType?: ObjectTypeDetail | null;
  ownerObjectTypeName: string;
  relationNames?: Map<string, string>;
  refreshVersion?: number;
};

type DependencyNames = {
  requestKey: string;
  values: Record<string, string | null>;
};

const metricTypeNames = {
  get atomic() {
    return objectMetricText("me5675ba4c2fd");
  },
  get derived() {
    return objectMetricText("me88b222ae28a");
  },
  get composite() {
    return objectMetricText("m3e70c815f275");
  },
};

const metricStatusKeys = {
  deprecated: "m1948aabb85ed",
  draft: "m2a2fd29bd27a",
  published: "md334724d6b2f",
  validated: "m1936eafc0c3c",
} as const;

type MetricTextKey = Parameters<typeof objectMetricText>[0];
const physicalTypeKeys: Record<
  ObjectMetricRecordV1["definition"]["result_semantics"]["value"]["physical_type"],
  MetricTextKey
> = {
  boolean: "mc08142c140ff",
  date: "m70d0c1b33626",
  datetime: "m6ac8b7718121",
  decimal: "m75a7f49573c8",
  duration: "m3e777ea8f1e8",
  int64: "m67e2bb6ef67b",
  string: "mdd81861811e5",
};

const semanticTypeKeys: Record<
  ObjectMetricRecordV1["definition"]["result_semantics"]["value"]["semantic_type"],
  MetricTextKey
> = {
  amount: "mffc624300de8",
  boolean: "mc08142c140ff",
  category: "m20fcf2eb775f",
  count: "m21179deb9a74",
  date: "m70d0c1b33626",
  duration: "m04a95e0654d3",
  measure: "m208d85fd9f3a",
  percentage: "m03af18e36797",
  rank: "m6570a98f2850",
  ratio: "m8a457b6b1337",
  score: "m96fff2e26c8d",
  timestamp: "m2d1060334622",
};

export function ObjectMetricGraphDetailDrawer({
  canDelete = false,
  canModify,
  metric,
  metrics = [],
  networkId,
  onClose,
  onDeleteVersion,
  onDeprecate,
  onEditMetric,
  onOpenMetric,
  onTrialMetric,
  open,
  ownerObjectType,
  ownerObjectTypeName,
  relationNames = new Map(),
  refreshVersion = 0,
}: Props) {
  const [dependencyNames, setDependencyNames] = useState<DependencyNames>({
    requestKey: "",
    values: {},
  });
  const dependencies = useMemo(
    () => (metric?.definition.specification ? directObjectMetricReferences(metric) : []),
    [metric],
  );
  const dependencyRequestKey = JSON.stringify([
    networkId,
    refreshVersion,
    metric?.definition.id,
    metric?.definition.version,
    dependencies.map((reference) => objectMetricVersionKey(reference.metric_id, reference.version)),
  ]);

  useEffect(() => {
    const unresolved = dependencies.filter(
      (reference) =>
        !metrics.some(
          (entry) =>
            entry.definition.id === reference.metric_id &&
            entry.definition.version === reference.version,
        ),
    );
    if (!unresolved.length) return;
    let active = true;
    void resolveObjectMetricReferences(unresolved, (id, version) =>
      getObjectMetricV1(networkId, id, version, { skipErrorToast: true }),
    ).then((entries) => {
      if (!active) return;
      setDependencyNames({
        requestKey: dependencyRequestKey,
        values: Object.fromEntries(
          entries.map(({ record, reference, key }) => [
            key,
            record?.definition.id === reference.metric_id &&
            record.definition.version === reference.version
              ? record.definition.name
              : null,
          ]),
        ),
      });
    });
    return () => {
      active = false;
    };
  }, [dependencies, dependencyRequestKey, metrics, networkId]);

  const loadedMetricNames = new Map(
    metrics.map((entry) => [
      objectMetricVersionKey(entry.definition.id, entry.definition.version),
      `${entry.definition.name} · v${entry.definition.version}`,
    ]),
  );
  const relationLabels = metric?.definition.specification
    ? rootRelationTypeIds(metric)
        .map((id) => relationNames.get(id))
        .filter((name): name is string => Boolean(name))
    : [];
  const boundProperty = metric
    ? findMetricLogicProperty(ownerObjectType, metric.definition.id)
    : undefined;
  const atomicSpecification =
    metric?.definition.specification?.kind === "atomic"
      ? metric.definition.specification
      : undefined;
  const atomicExpression = atomicSpecification?.measure.expression;
  const atomicSource =
    atomicExpression?.node_type === "property"
      ? objectMetricPropertyDisplayName(atomicExpression.property_ref, ownerObjectType)
      : undefined;
  const value = metric?.definition.result_semantics?.value;
  const actions = metric
    ? objectMetricActions(metric, canModify, canDelete, ownerObjectType)
    : undefined;

  return (
    <Drawer
      className={`${styles.drawer} ${metricTheme.scope}`}
      onClose={onClose}
      open={open}
      title={objectMetricText("graphMetricDetails")}
      width={400}
    >
      {metric ? (
        <div className={styles.content}>
          <strong className={styles.metricName}>{metric.definition.name}</strong>
          <div className={styles.drawerActions}>
            <Button autoInsertSpace={false} onClick={() => onOpenMetric(metric)} type="primary">
              {objectMetricText("m979a332955c8")}
            </Button>
            {onTrialMetric ? (
              <Button autoInsertSpace={false} onClick={() => onTrialMetric(metric)}>
                {objectMetricText("m073728637a26")}
              </Button>
            ) : null}
            {actions?.canEdit && onEditMetric ? (
              <Button autoInsertSpace={false} onClick={() => onEditMetric(metric)}>
                {objectMetricText("m9d0eedd99d2b")}
              </Button>
            ) : null}
            {actions?.canDeleteVersion && onDeleteVersion ? (
              <Button autoInsertSpace={false} danger onClick={() => onDeleteVersion(metric)}>
                {objectMetricText("metricDeleteVersion")}
              </Button>
            ) : null}
            {actions?.canDeprecate && onDeprecate ? (
              <Tooltip title={actions.deprecateReason}>
                <span>
                  <Button
                    autoInsertSpace={false}
                    danger
                    disabled={Boolean(actions.deprecateReason)}
                    onClick={() => onDeprecate(metric)}
                  >
                    {objectMetricText("mca0ff1e63793")}
                  </Button>
                </span>
              </Tooltip>
            ) : null}
          </div>
          <Descriptions column={1} size="small">
            <Descriptions.Item label={objectMetricText("graphMetricCode")}>
              <Typography.Text copyable={{ text: metric.definition.code }} type="secondary">
                {metric.definition.code}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("graphMetricVersion")}>
              v{metric.definition.version}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m7626be61e570")}>
              {metricTypeNames[metric.definition.metric_type]}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m6320b4a8722a")}>
              {metric.definition.lifecycle?.status
                ? objectMetricText(metricStatusKeys[metric.definition.lifecycle.status])
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m26c439016066")}>
              {ownerObjectTypeName}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("mec7844e49915")}>
              {objectMetricText(
                metric.definition.calculation_scope === "object_instance"
                  ? "mabe9d02781fc"
                  : "m9c51e86f9307",
              )}
            </Descriptions.Item>
            {metric.definition.calculation_scope === "object_instance" ? (
              <Descriptions.Item label={objectMetricText("bindingStatusLabel")}>
                {ownerObjectType === undefined
                  ? objectMetricText("bindingLoading")
                  : ownerObjectType === null
                    ? objectMetricText("bindingUnknown")
                    : boundProperty?.metricBinding
                      ? boundProperty.metricBinding.metric_ref.version === metric.definition.version
                        ? `${boundProperty.displayName || boundProperty.name} · v${metric.definition.version}`
                        : objectMetricText("graphBindingOtherVersion", {
                            p0: boundProperty.displayName || boundProperty.name,
                            p1: boundProperty.metricBinding.metric_ref.version,
                          })
                      : objectMetricText("bindingUnbound")}
              </Descriptions.Item>
            ) : null}
            {atomicSpecification ? (
              <Descriptions.Item label={objectMetricText("graphCalculationSummary")}>
                {objectMetricAggregationDisplayName(atomicSpecification.measure.aggregation)}
                {atomicSource ? ` · ${atomicSource}` : null}
              </Descriptions.Item>
            ) : null}
            {value ? (
              <Descriptions.Item label={objectMetricText("me659c05e3760")}>
                {objectMetricText(physicalTypeKeys[value.physical_type])}
                {" / "}
                {objectMetricText(semanticTypeKeys[value.semantic_type])}
              </Descriptions.Item>
            ) : null}
            {value?.unit ? (
              <Descriptions.Item label={objectMetricText("m80b19d68b149")}>
                <Tooltip title={value.unit.code}>
                  <span>{objectMetricUnitDisplayLabel(value.unit)}</span>
                </Tooltip>
              </Descriptions.Item>
            ) : null}
            {relationLabels.length ? (
              <Descriptions.Item label={objectMetricText("graphUsedRelations")}>
                {relationLabels.join("、")}
              </Descriptions.Item>
            ) : null}
            {dependencies.length ? (
              <Descriptions.Item label={objectMetricText("graphDirectDependencies")}>
                {dependencies
                  .map((reference, index) => {
                    const key = objectMetricVersionKey(reference.metric_id, reference.version);
                    const loadedName = loadedMetricNames.get(key);
                    if (loadedName) return loadedName;
                    const resolvedName =
                      dependencyNames.requestKey === dependencyRequestKey
                        ? dependencyNames.values[key]
                        : undefined;
                    if (resolvedName) return `${resolvedName} · v${reference.version}`;
                    return objectMetricText(
                      resolvedName === null
                        ? "graphDependencyUnavailable"
                        : "graphDependencyLoading",
                      { p0: index + 1, p1: reference.version },
                    );
                  })
                  .join("、")}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
          <div className={styles.businessDefinition}>
            <span className={styles.businessDefinitionLabel}>
              {objectMetricText("m419eb90613fd")}
            </span>
            <div className={styles.businessDefinitionContent}>
              {metric.definition.description || "—"}
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
