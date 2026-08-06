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
  return Array.isArray(datas) && datas.length > 0;
}

function formatScalarValue(value: unknown) {
  if (value == null || value === "") {
    return "--";
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

function formatMetricResultPayload(payload: MetricResultPayload) {
  const unit = payload.model?.unit?.trim();
  const unitSuffix = unit ? ` ${unit}` : "";
  const values: unknown[] = [];

  for (const series of payload.datas ?? []) {
    values.push(...(series.proportions ?? series.values ?? []));
  }

  if (values.length === 0) {
    return "--";
  }

  if (values.length === 1) {
    return `${formatScalarValue(values[0])}${unitSuffix}`;
  }

  const first = formatScalarValue(values[0]);
  const last = formatScalarValue(values[values.length - 1]);

  if (first === last) {
    return `${first}${unitSuffix} (${values.length})`;
  }

  return `${first} ~ ${last}${unitSuffix} (${values.length})`;
}

export function formatLogicPropertyTrialValue(value: unknown): string {
  if (value == null || value === "") {
    return "--";
  }

  if (typeof value !== "object") {
    return formatScalarValue(value);
  }

  if (Array.isArray(value)) {
    const items = value as unknown[];
    return items.map((item) => formatLogicPropertyTrialValue(item)).join(", ");
  }

  if (isMetricResultPayload(value)) {
    return formatMetricResultPayload(value);
  }

  return JSON.stringify(value);
}
