/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  StatisticsHeaderFilter,
  type StatisticsFilterValue,
} from "@/modules/model-resources/components/statistics/StatisticsHeaderFilter";
import { StatisticsRateAndQps } from "@/modules/model-resources/components/statistics/StatisticsRateAndQps";
import { StatisticsSummary } from "@/modules/model-resources/components/statistics/StatisticsSummary";
import { StatisticsTimeConsuming } from "@/modules/model-resources/components/statistics/StatisticsTimeConsuming";
import { getModelStatisticsOverview } from "@/modules/model-resources/services/statistics.service";
import type { ModelStatisticsOverview } from "@/modules/model-resources/types/statistics";

import pageStyles from "./model-resources-page.module.css";

const emptyOverview: ModelStatisticsOverview = {
  summary: {
    totalUsage: 0,
    errorRate: 0,
    avgResponseTime: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
  },
  trends: [],
  qpsData: [],
};

function createDefaultFilter(): StatisticsFilterValue {
  return {
    modelId: "all",
    dateRange: [dayjs().subtract(1, "day"), dayjs()],
  };
}

export function ModelStatisticsScene() {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [filter, setFilter] = useState<StatisticsFilterValue>(createDefaultFilter);
  const [overview, setOverview] = useState<ModelStatisticsOverview>(emptyOverview);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      modelId: filter.modelId,
      startTime: filter.dateRange[0].format("YYYY-MM-DD"),
      endTime: filter.dateRange[1].format("YYYY-MM-DD"),
    }),
    [filter],
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await getModelStatisticsOverview(query);
      setOverview(result);
    } catch (error) {
      setOverview(emptyOverview);
      const errorMessage = extractRequestErrorMessage(error);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [message, query]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.pageIntro}>
        <h2 className={pageStyles.pageIntroTitle}>{t("modelResources.statistics.title")}</h2>
        <p className={pageStyles.pageIntroDescription}>{t("modelResources.statistics.description")}</p>
      </div>

      <StatisticsHeaderFilter
        onChange={setFilter}
        value={filter}
      />

      {loadError ? (
        <Alert
          message={loadError}
          showIcon
          style={{ marginTop: 16 }}
          type="error"
          action={
            <AppButton onClick={() => void loadOverview()} size="small">
              {t("common.retry")}
            </AppButton>
          }
        />
      ) : null}

      <Spin spinning={loading}>
        <StatisticsSummary overview={overview} />
        <StatisticsTimeConsuming overview={overview} />
        <StatisticsRateAndQps overview={overview} />
      </Spin>
    </section>
  );
}
