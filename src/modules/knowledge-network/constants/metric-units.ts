/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { MetricUnit, MetricUnitType } from "@/modules/knowledge-network/types/metric";

/** Mirrors bkn-backend `ValidMetricUnitTypesArr` (interfaces/metric.go). */
export const METRIC_UNIT_TYPE_OPTIONS = [
  "numUnit",
  "storeUnit",
  "percent",
  "transmissionRate",
  "timeUnit",
  "currencyUnit",
  "percentageUnit",
  "countUnit",
  "weightUnit",
  "ordinalRankUnit",
] as const satisfies readonly MetricUnitType[];

/** Mirrors bkn-backend `ValidMetricUnitsArr` (interfaces/metric.go). */
export const ALL_METRIC_UNITS = [
  "none",
  "K",
  "Mil",
  "Bil",
  "Tri",
  "bit",
  "Byte",
  "KB",
  "MB",
  "GB",
  "TB",
  "PB",
  "bps",
  "Kbps",
  "Mbps",
  "μs",
  "ms",
  "s",
  "m",
  "h",
  "day",
  "week",
  "month",
  "year",
  "quarter",
  "Fen",
  "Jiao",
  "CNY",
  "10K_CNY",
  "1M_CNY",
  "100M_CNY",
  "US_Cent",
  "USD",
  "EUR_Cent",
  "%",
  "‰",
  "household",
  "transaction",
  "piece",
  "item",
  "times",
  "man_day",
  "family",
  "hand",
  "sheet",
  "packet",
  "ton",
  "kg",
  "rank",
] as const satisfies readonly MetricUnit[];

/**
 * Semantic unit options per unit_type, grouped by backend enum order.
 * Backend validates unit_type and unit independently; this mapping drives form UX.
 */
export const METRIC_UNITS_BY_TYPE: Record<MetricUnitType, readonly MetricUnit[]> = {
  countUnit: [
    "household",
    "transaction",
    "piece",
    "item",
    "times",
    "man_day",
    "family",
    "hand",
    "sheet",
    "packet",
  ],
  currencyUnit: [
    "Fen",
    "Jiao",
    "CNY",
    "10K_CNY",
    "1M_CNY",
    "100M_CNY",
    "US_Cent",
    "USD",
    "EUR_Cent",
  ],
  numUnit: ["none", "K", "Mil", "Bil", "Tri"],
  ordinalRankUnit: ["rank"],
  percent: ["%"],
  percentageUnit: ["‰"],
  storeUnit: ["bit", "Byte", "KB", "MB", "GB", "TB", "PB"],
  timeUnit: ["μs", "ms", "s", "m", "h", "day", "week", "month", "year", "quarter"],
  transmissionRate: ["bps", "Kbps", "Mbps"],
  weightUnit: ["ton", "kg"],
};

export function getMetricUnitsForType(unitType?: MetricUnitType): MetricUnit[] {
  if (!unitType) {
    return [];
  }

  return [...METRIC_UNITS_BY_TYPE[unitType]];
}

export function isMetricUnitAllowedForType(
  unitType: MetricUnitType | undefined,
  unit: MetricUnit | undefined,
): boolean {
  if (!unitType || !unit) {
    return true;
  }

  return METRIC_UNITS_BY_TYPE[unitType].includes(unit);
}

export function resolveMetricUnitOptions(
  unitType: MetricUnitType | undefined,
  currentUnit?: MetricUnit,
): MetricUnit[] {
  const options = getMetricUnitsForType(unitType);

  if (
    currentUnit &&
    !options.includes(currentUnit) &&
    ALL_METRIC_UNITS.includes(currentUnit)
  ) {
    return [...options, currentUnit];
  }

  return options;
}
