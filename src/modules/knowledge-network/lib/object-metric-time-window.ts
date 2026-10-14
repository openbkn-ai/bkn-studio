/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectMetricTimeGranularityV1,
  ObjectMetricTimeWindowV1,
} from "@/modules/knowledge-network/types/object-metric";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";

type CalendarPeriod = Exclude<ObjectMetricTimeGranularityV1, "minute" | "hour">;

export const DEFAULT_OBJECT_METRIC_TIMEZONE = "UTC";

export type ObjectMetricTimeWindowSelection =
  "unbounded" | "rolling" | "fixed_range" | `current_${CalendarPeriod}` | `full_${CalendarPeriod}`;

export type ObjectMetricTimeWindowDraft = {
  endAt?: number;
  length?: number;
  selection?: ObjectMetricTimeWindowSelection;
  startAt?: number;
  timezone?: string;
  unit?: ObjectMetricTimeGranularityV1;
  weekStart?: "monday" | "sunday";
};

export function objectMetricTimeWindowSelection(
  window?: ObjectMetricTimeWindowV1,
): ObjectMetricTimeWindowSelection | undefined {
  if (!window) return undefined;
  if (window.mode === "unbounded" || window.mode === "rolling" || window.mode === "fixed_range") {
    return window.mode;
  }
  return `${window.mode === "period_to_date" ? "current" : "full"}_${window.period}`;
}

export function objectMetricTimeWindowPeriod(
  selection?: ObjectMetricTimeWindowSelection,
): CalendarPeriod | undefined {
  if (!selection?.startsWith("current_") && !selection?.startsWith("full_")) return undefined;
  return selection.replace(/^(current|full)_/, "") as CalendarPeriod;
}

export function objectMetricTimeWindowBackendMode(
  selection?: ObjectMetricTimeWindowSelection,
): "calendar_period" | "period_to_date" | undefined {
  if (selection?.startsWith("current_")) return "period_to_date";
  if (selection?.startsWith("full_")) return "calendar_period";
  return undefined;
}

/**
 * Convert the business-facing selector into the exact backend contract.
 *
 * The form deliberately treats an unbounded range as "no fixed qualifier", so
 * it must be omitted rather than serialized as a partially populated object.
 * Calendar windows also receive their hidden defaults here instead of relying
 * on a Select onChange handler having run before validation.
 */
export function buildObjectMetricTimeWindow(
  draft: ObjectMetricTimeWindowDraft,
): ObjectMetricTimeWindowV1 | undefined {
  const { selection } = draft;
  if (!selection || selection === "unbounded") return undefined;

  if (selection === "rolling") {
    return {
      length: Math.max(1, Math.trunc(draft.length ?? 30)),
      mode: "rolling",
      timezone: draft.timezone ?? DEFAULT_OBJECT_METRIC_TIMEZONE,
      unit: draft.unit ?? "day",
    };
  }

  if (selection === "fixed_range") {
    if (draft.startAt == null || draft.endAt == null) return undefined;
    return {
      end_at: draft.endAt,
      mode: "fixed_range",
      start_at: draft.startAt,
      timezone: draft.timezone ?? DEFAULT_OBJECT_METRIC_TIMEZONE,
    };
  }

  const mode = objectMetricTimeWindowBackendMode(selection);
  const period = objectMetricTimeWindowPeriod(selection);
  if (!mode || !period) return undefined;

  return {
    mode,
    period,
    timezone: draft.timezone ?? DEFAULT_OBJECT_METRIC_TIMEZONE,
    week_start: period === "week" ? (draft.weekStart ?? "monday") : undefined,
  };
}

export function objectMetricTimeWindowBusinessLabel(
  selection?: ObjectMetricTimeWindowSelection,
): string | undefined {
  const periodLabels: Record<CalendarPeriod, string> = {
    day: objectMetricText("m5c9cf5e0dd47"),
    month: objectMetricText("m0eeecd26f2ba"),
    quarter: objectMetricText("mf142ffeef6d8"),
    week: objectMetricText("mb4c6c3eb0bce"),
    year: objectMetricText("m78ebb7f81db5"),
  };
  const period = objectMetricTimeWindowPeriod(selection);
  if (!period) return undefined;
  return selection?.startsWith("full_")
    ? objectMetricText("m23459309ff77", { p0: periodLabels[period] })
    : periodLabels[period];
}
