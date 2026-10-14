/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type MetricSeriesPoint = {
  labels?: Record<string, unknown> | unknown[];
  proportions?: unknown[];
  times?: unknown[];
  values?: unknown[];
};

type MetricResultPayload = {
  datas?: MetricSeriesPoint[];
  model?: {
    unit?: string;
    unit_type?: string;
  };
};

function isMetricResultPayload(value: unknown): value is MetricResultPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const datas = (value as MetricResultPayload).datas;
  return Array.isArray(datas);
}

function formatScalarValue(value: unknown, emptyLabel: string) {
  if (value == null || value === "") {
    return emptyLabel;
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return String(value);
    }

    const fixed = Number(value.toFixed(4));
    return String(fixed);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "bigint" || typeof value === "symbol") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatMetricResultPayload(payload: MetricResultPayload, emptyLabel: string) {
  const unit = payload.model?.unit?.trim();
  const unitSuffix = unit ? ` ${unit}` : "";
  const values: unknown[] = [];

  for (const series of payload.datas ?? []) {
    values.push(...(series.proportions ?? series.values ?? []));
  }

  if (values.length === 0) {
    return emptyLabel;
  }

  if (values.length === 1) {
    return `${formatScalarValue(values[0], emptyLabel)}${unitSuffix}`;
  }

  const first = formatScalarValue(values[0], emptyLabel);
  const last = formatScalarValue(values[values.length - 1], emptyLabel);

  if (first === last) {
    return `${first}${unitSuffix} (${values.length})`;
  }

  return `${first} ~ ${last}${unitSuffix} (${values.length})`;
}

export function formatLogicPropertyTrialValue(value: unknown, emptyLabel = "No data"): string {
  if (value == null || value === "") {
    return emptyLabel;
  }

  if (typeof value !== "object") {
    return formatScalarValue(value, emptyLabel);
  }

  if (Array.isArray(value)) {
    const items = value as unknown[];
    return items.map((item) => formatLogicPropertyTrialValue(item, emptyLabel)).join(", ");
  }

  if (isMetricResultPayload(value)) {
    return formatMetricResultPayload(value, emptyLabel);
  }

  return JSON.stringify(value);
}
