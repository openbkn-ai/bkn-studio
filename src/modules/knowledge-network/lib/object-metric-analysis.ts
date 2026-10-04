/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricDataEntryV1 } from "@/modules/knowledge-network/types/object-metric";

export type ObjectMetricAutomaticAnalysisView = "summary" | "bar" | "line" | "heatmap";

export function getObjectMetricDimensionCount(entries: ObjectMetricDataEntryV1[]): number {
  return Math.max(0, ...entries.map((entry) => Object.keys(entry.dimensions ?? {}).length));
}

export function recommendObjectMetricAnalysisView(
  entries: ObjectMetricDataEntryV1[],
): ObjectMetricAutomaticAnalysisView {
  if (
    entries.length <= 1 &&
    !entries[0]?.time &&
    !Object.keys(entries[0]?.dimensions ?? {}).length
  ) {
    return "summary";
  }
  if (entries.some((entry) => entry.time !== undefined)) return "line";
  if (getObjectMetricDimensionCount(entries) >= 2) return "heatmap";
  return "bar";
}
