/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import dayjs from "dayjs";

export function parseStatisticsNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function unwrapStatisticsRecord<T extends Record<string, unknown>>(value: unknown): T | null {
  let candidate = value;

  if (Array.isArray(candidate)) {
    candidate = candidate.length === 1 ? candidate[0] : null;
  }

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as T;
}

export function normalizeStatisticsDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.trim().replace("T", " ");
}

export function sortStatisticsPoints<T extends { date: string }>(points: T[]) {
  return [...points].sort(
    (left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf(),
  );
}

export function formatStatisticsAxisTime(value: string | number) {
  return dayjs(value).format("HH:mm");
}

export function formatStatisticsTooltipTime(value: string | number) {
  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

export function isStatisticsHourMark(value: string) {
  if (!value) {
    return false;
  }

  const parsed = dayjs(value);
  return parsed.isValid() && parsed.minute() === 0 && parsed.second() === 0;
}

export function createStatisticsHourAxisLabelInterval(labels: string[]) {
  return (index: number) => isStatisticsHourMark(labels[index] ?? "");
}
