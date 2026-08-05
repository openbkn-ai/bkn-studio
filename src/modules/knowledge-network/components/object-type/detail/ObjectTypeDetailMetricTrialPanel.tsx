/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { MetricDataQueryPanel } from "@/modules/knowledge-network/components/metric/MetricDataQueryPanel";
import { filterUnboundMetricsForTrial } from "@/modules/knowledge-network/lib/object-type-trial-metrics";
import { getKnowledgeNetworkMetric } from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
  ObjectTypeDataProperty,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";
import { toMetricPropertyOptions } from "@/modules/knowledge-network/utils/metric-property-display";

import styles from "./ObjectTypeDetailTrialPanel.module.css";

type ObjectTypeDetailMetricTrialPanelProps = {
  dataProperties: ObjectTypeDataProperty[];
  loading?: boolean;
  logicProperties: ObjectTypeLogicProperty[];
  metrics: KnowledgeNetworkMetricRecord[];
  networkId: string;
  objectTypeId: string;
  objectTypeName: string;
  onSelectMetricId: (metricId: string) => void;
  selectedMetricId: string | null;
};

export function ObjectTypeDetailMetricTrialPanel({
  dataProperties,
  loading = false,
  logicProperties,
  metrics,
  networkId,
  objectTypeId,
  objectTypeName,
  onSelectMetricId,
  selectedMetricId,
}: ObjectTypeDetailMetricTrialPanelProps) {
  const { t } = useTranslation();

  const trialMetrics = useMemo(
    () => filterUnboundMetricsForTrial(metrics, logicProperties),
    [logicProperties, metrics],
  );

  const selectedMetric = useMemo(
    () => trialMetrics.find((item) => item.id === selectedMetricId) ?? null,
    [selectedMetricId, trialMetrics],
  );

  const resolvedMetricId = selectedMetric?.id ?? trialMetrics[0]?.id ?? null;
  const resolvedMetricName = selectedMetric?.name ?? trialMetrics[0]?.name ?? "";
  const [analysisDimensions, setAnalysisDimensions] = useState<string[]>(
    selectedMetric?.calculationFormula.analysisDimensions ??
      trialMetrics[0]?.calculationFormula.analysisDimensions ??
      [],
  );

  useEffect(() => {
    const nextDimensions =
      selectedMetric?.calculationFormula.analysisDimensions ??
      trialMetrics[0]?.calculationFormula.analysisDimensions ??
      [];
    setAnalysisDimensions(nextDimensions);

    if (!networkId || !resolvedMetricId || nextDimensions.length > 0) {
      return;
    }

    let cancelled = false;

    void getKnowledgeNetworkMetric(networkId, resolvedMetricId)
      .then((metric) => {
        if (!cancelled && metric) {
          setAnalysisDimensions(metric.calculationFormula.analysisDimensions ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysisDimensions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [networkId, resolvedMetricId, selectedMetric, trialMetrics]);

  const objectTypes = useMemo<KnowledgeNetworkObjectTypeRecord[]>(
    () => [
      {
        color: "",
        conceptGroupIds: [],
        conceptGroupNames: [],
        description: "",
        hasIndex: false,
        icon: "",
        id: objectTypeId,
        name: objectTypeName,
        tags: [],
        updateTime: "",
        updaterName: "",
      },
    ],
    [objectTypeId, objectTypeName],
  );

  const propertyOptions = useMemo(
    () => toMetricPropertyOptions(dataProperties),
    [dataProperties],
  );

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (trialMetrics.length === 0) {
    return <Empty description={t("knowledgeNetwork.objectTypeDetailMetricTrialEmpty")} />;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.selectorRow}>
        <span className={styles.selectorLabel}>
          {t("knowledgeNetwork.objectTypeDetailTrialSelectMetric")}
        </span>
        <Select
          className={styles.selectorControl}
          onChange={(value: string) => {
            onSelectMetricId(value);
          }}
          options={trialMetrics.map((metric) => ({
            label: metric.name,
            value: metric.id,
          }))}
          value={resolvedMetricId ?? undefined}
        />
      </div>

      {resolvedMetricId ? (
        <MetricDataQueryPanel
          analysisDimensionOptions={analysisDimensions}
          boundObjectTypeId={objectTypeId}
          embedded
          metricId={resolvedMetricId}
          metricName={resolvedMetricName}
          networkId={networkId}
          objectTypes={objectTypes}
          propertyOptions={propertyOptions}
        />
      ) : null}
    </div>
  );
}

/** @deprecated Use ObjectTypeDetailMetricTrialPanel */
export const ObjectTypeDetailTrialPanel = ObjectTypeDetailMetricTrialPanel;
