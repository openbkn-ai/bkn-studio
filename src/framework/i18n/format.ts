/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";
import type { SupportedLocale } from "@/framework/runtime/types";

type LocaleFormatOptions = {
  locale?: SupportedLocale;
};

type DateTimeInput = Date | number | string | null | undefined;

const DEFAULT_EMPTY_VALUE = "-";

const dateTimeComponentOptionKeys = [
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "timeZoneName",
] as const satisfies readonly (keyof Intl.DateTimeFormatOptions)[];

function hasExplicitDateTimeComponentOptions(options: Intl.DateTimeFormatOptions) {
  return dateTimeComponentOptionKeys.some((key) => options[key] !== undefined);
}

export function formatDateTime(
  value: DateTimeInput,
  options: Intl.DateTimeFormatOptions & LocaleFormatOptions = {},
) {
  const date = toDate(value);
  if (!date) {
    return DEFAULT_EMPTY_VALUE;
  }

  const { locale = getRuntimeConfig().locale, ...dateTimeOptions } = options;
  const defaultStyleOptions: Intl.DateTimeFormatOptions = hasExplicitDateTimeComponentOptions(dateTimeOptions)
    ? {}
    : {
        dateStyle: "medium",
        timeStyle: "medium",
      };
  return new Intl.DateTimeFormat(locale, {
    ...defaultStyleOptions,
    hour12: false,
    ...dateTimeOptions,
  }).format(date);
}

export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions & LocaleFormatOptions = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  const { locale = getRuntimeConfig().locale, ...numberOptions } = options;
  return new Intl.NumberFormat(locale, numberOptions).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions & LocaleFormatOptions = {},
) {
  return formatNumber(value, {
    style: "percent",
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatFileSize(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions & LocaleFormatOptions = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return DEFAULT_EMPTY_VALUE;
  }
  if (value < 0) {
    return DEFAULT_EMPTY_VALUE;
  }

  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"] as const;
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return formatNumber(size, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
    style: "unit",
    unit: units[unitIndex],
    unitDisplay: "short",
    ...options,
  });
}

function toDate(value: DateTimeInput) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
