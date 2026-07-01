/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatePicker, Select } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listLlmModels } from "@/modules/model-resources/services/llm.service";

import styles from "./statistics.module.css";

export type StatisticsFilterValue = {
  dateRange: [Dayjs, Dayjs];
  modelId: string;
};

type StatisticsHeaderFilterProps = {
  onChange: (value: StatisticsFilterValue) => void;
  value: StatisticsFilterValue;
};

type ModelOption = {
  label: string;
  value: string;
};

export function StatisticsHeaderFilter({ onChange, value }: StatisticsHeaderFilterProps) {
  const { t } = useTranslation();
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await listLlmModels({
          page: 1,
          size: 1000,
          order: "desc",
          rule: "update_time",
        });

        setModelOptions(
          result.items.map((item) => ({
            label: item.modelName,
            value: item.modelId,
          })),
        );
      } catch {
        setModelOptions([]);
      }
    })();
  }, []);

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterItem}>
        <span className={styles.filterLabel}>{t("modelResources.statistics.filters.modelName")}</span>
        <Select
          onChange={(modelId) => {
            onChange({ ...value, modelId });
          }}
          options={[
            { value: "all", label: t("common.all") },
            ...modelOptions,
          ]}
          placeholder={t("modelResources.statistics.filters.modelPlaceholder")}
          style={{ width: 180 }}
          value={value.modelId}
        />
      </div>
      <div className={styles.filterItem}>
        <span className={styles.filterLabel}>{t("modelResources.statistics.filters.date")}</span>
        <DatePicker.RangePicker
          disabledDate={(current) => Boolean(current && current > dayjs().endOf("day"))}
          onChange={(dates) => {
            if (!dates?.[0] || !dates[1]) {
              return;
            }

            onChange({
              ...value,
              dateRange: [dates[0], dates[1]],
            });
          }}
          value={value.dateRange}
        />
      </div>
    </div>
  );
}
