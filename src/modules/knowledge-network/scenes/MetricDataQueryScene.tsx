/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { MetricDataQueryPanel } from "@/modules/knowledge-network/components/metric/MetricDataQueryPanel";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import type { MetricDataQuerySceneProps } from "@/modules/knowledge-network/contracts/scenes";
import {
  getKnowledgeNetworkMetric,
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { toMetricPropertyOptions } from "@/modules/knowledge-network/utils/metric-property-display";

import styles from "./MetricDetailScene.module.css";

export function MetricDataQueryScene({
  metricId: metricIdProp,
  networkId: networkIdProp,
  onBack,
}: MetricDataQuerySceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{
    metricId: string;
    networkId: string;
  }>();
  const metricId = metricIdProp ?? params.metricId ?? "";
  const networkId = networkIdProp ?? params.networkId ?? "";
  const [detail, setDetail] = useState<KnowledgeNetworkMetricRecord | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<RelationTypePropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detailPath = `/knowledge-network/workspace/${networkId}/metrics/${metricId}/detail`;

  useEffect(() => {
    const loadData = async () => {
      if (!networkId || !metricId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [metricResult, objectTypeResult] = await Promise.all([
          getKnowledgeNetworkMetric(networkId, metricId),
          listKnowledgeNetworkObjectTypes(networkId),
        ]);
        setDetail(metricResult);
        setObjectTypes(objectTypeResult);

        if (metricResult?.scopeType === "object_type" && metricResult.scopeRef) {
          const objectTypeDetail = await getKnowledgeNetworkObjectTypeDetail(
            networkId,
            metricResult.scopeRef,
          );
          setPropertyOptions(toMetricPropertyOptions(objectTypeDetail?.dataProperties ?? []));
        } else {
          setPropertyOptions([]);
        }
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [metricId, networkId]);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      onBack={() => {
        if (onBack) {
          onBack();
          return;
        }

        void navigate(detailPath);
      }}
      subtitle={t("knowledgeNetwork.metricDataQueryDescription")}
      title={t("knowledgeNetwork.metricDataQueryTitle", { name: detail.name })}
    >
      <MetricDataQueryPanel
        analysisDimensionOptions={detail.calculationFormula.analysisDimensions ?? []}
        boundObjectTypeId={detail.scopeType === "object_type" ? detail.scopeRef : undefined}
        metricId={detail.id}
        metricName={detail.name}
        networkId={networkId}
        objectTypes={objectTypes}
        propertyOptions={propertyOptions}
      />
    </KnowledgeNetworkResourceConfigShell>
  );
}
