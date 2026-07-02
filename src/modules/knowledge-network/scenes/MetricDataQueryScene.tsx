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
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import type { MetricDataQuerySceneProps } from "@/modules/knowledge-network/contracts/scenes";
import { getKnowledgeNetworkMetric } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkMetricRecord } from "@/modules/knowledge-network/types/knowledge-network";

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
        const metricResult = await getKnowledgeNetworkMetric(networkId, metricId);
        setDetail(metricResult);
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
      <MetricDataQueryPanel metricId={detail.id} metricName={detail.name} networkId={networkId} />
    </KnowledgeNetworkResourceConfigShell>
  );
}
