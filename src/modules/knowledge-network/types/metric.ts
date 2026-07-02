/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type KnowledgeNetworkMetricType = "atomic" | "derived" | "composite";

export type KnowledgeNetworkMetricScopeType = "object_type" | "subgraph";

export type MetricAggregationAggr =
  | "sum"
  | "avg"
  | "max"
  | "min"
  | "count"
  | "count_distinct";

export type MetricUnitType =
  | "numUnit"
  | "storeUnit"
  | "percent"
  | "transmissionRate"
  | "timeUnit"
  | "currencyUnit"
  | "percentageUnit"
  | "countUnit"
  | "weightUnit"
  | "ordinalRankUnit";

export type MetricUnit =
  | "none"
  | "K"
  | "Mil"
  | "Bil"
  | "Tri"
  | "times"
  | "transaction"
  | "piece"
  | "item"
  | "household"
  | "man_day"
  | "ton"
  | "kg"
  | "rank"
  | "%"
  | "‰"
  | "CNY"
  | "10K_CNY"
  | "1M_CNY"
  | "100M_CNY"
  | "USD"
  | "Fen"
  | "Jiao"
  | "ms"
  | "s"
  | "m"
  | "h"
  | "day"
  | "week"
  | "month"
  | "year";

export type MetricOrderDirection = "asc" | "desc";

export type MetricDefaultRangePolicy =
  | "last_1h"
  | "last_24h"
  | "calendar_day"
  | "none";

export type MetricHavingOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export type MetricCalculationFormula = {
  aggregation: {
    aggr: MetricAggregationAggr;
    property: string;
  };
  analysisDimensions?: string[];
  condition?: import("./action-type").ActionTypeCondition;
  groupBy?: string[];
  having?: {
    operator: MetricHavingOperator;
    value?: number;
  };
  orderBy?: {
    direction: MetricOrderDirection;
    property: string;
  };
};

export type MetricTimeDimension = {
  defaultRangePolicy: MetricDefaultRangePolicy;
  property: string;
};

export type KnowledgeNetworkMetricRecord = {
  calculationFormula: MetricCalculationFormula;
  description: string;
  id: string;
  metricType: KnowledgeNetworkMetricType;
  name: string;
  scopeRef: string;
  scopeType: KnowledgeNetworkMetricScopeType;
  tags: string[];
  timeDimension?: MetricTimeDimension;
  unit?: MetricUnit;
  unitType?: MetricUnitType;
  updateTime: string;
  updaterName: string;
};

export type KnowledgeNetworkMetricMutationPayload = {
  calculationFormula: MetricCalculationFormula;
  description: string;
  metricType: KnowledgeNetworkMetricType;
  name: string;
  scopeRef: string;
  scopeType: KnowledgeNetworkMetricScopeType;
  tags: string[];
  timeDimension?: MetricTimeDimension;
  unit?: MetricUnit;
  unitType?: MetricUnitType;
};

export type MetricListQuery = {
  direction?: MetricOrderDirection;
  keyword?: string;
  limit?: number;
  offset?: number;
  sort?: "name" | "update_time";
  tag?: string;
};

export type MetricListResult = {
  entries: KnowledgeNetworkMetricRecord[];
  totalCount: number;
};

export type MetricDataQueryMode = "instant" | "trend" | "sameperiod" | "proportion";
export type MetricSamePeriodMethod = "growth_value" | "growth_rate";
export type MetricSamePeriodTimeGranularity = "day" | "month" | "quarter" | "year";

export type MetricDataQueryTimeRange =
  | "last_1h"
  | "last_24h"
  | "last_7d"
  | "last_30d"
  | "calendar_day"
  | "custom";

export type MetricDataQueryParams = {
  customEndTime?: unknown;
  customStartTime?: unknown;
  fillNull?: boolean;
  limit?: number;
  mode: MetricDataQueryMode;
  samePeriodGranularity?: MetricSamePeriodTimeGranularity;
  samePeriodMethod?: MetricSamePeriodMethod;
  samePeriodOffset?: number;
  timeRange: MetricDataQueryTimeRange;
};

export type MetricDataQueryColumn = {
  key: string;
  title: string;
};

export type MetricDataQueryResult = {
  columns: MetricDataQueryColumn[];
  durationMs?: number;
  rows: Array<Record<string, string | number>>;
  visualHint?: "instant-card" | "proportion-bars" | "trend-bars";
};

export function createDefaultMetricCalculationFormula(): MetricCalculationFormula {
  return {
    aggregation: {
      aggr: "count",
      property: "",
    },
    analysisDimensions: [],
    groupBy: [],
    orderBy: {
      direction: "desc",
      property: "",
    },
  };
}
