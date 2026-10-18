/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricDataEntryV1 } from "@/modules/knowledge-network/types/object-metric";

export type ObjectMetricAutomaticAnalysisView = "summary" | "bar" | "line" | "heatmap" | "table";

function dimensionEntries(entry: ObjectMetricDataEntryV1): Array<[string, unknown]> {
  if (entry.dimension_cells?.length) {
    return entry.dimension_cells.map(({ ref, value }) => [
      JSON.stringify([ref.object_type_id, ref.relation_path_alias ?? "", ref.property_name]),
      value,
    ]);
  }
  return Object.entries(entry.dimensions ?? {});
}

export function getObjectMetricDimensionCount(entries: ObjectMetricDataEntryV1[]): number {
  return Math.max(0, ...entries.map((entry) => dimensionEntries(entry).length));
}

export function recommendObjectMetricAnalysisView(
  entries: ObjectMetricDataEntryV1[],
): ObjectMetricAutomaticAnalysisView {
  const dimensions = getObjectMetricDimensionCount(entries);
  if (entries.length <= 1 && !entries[0]?.time && !dimensions) {
    return "summary";
  }
  if (entries.some((entry) => entry.time !== undefined)) {
    const series = new Set(entries.map((entry) => JSON.stringify(dimensionEntries(entry))));
    return series.size > 6 ? "table" : "line";
  }
  if (dimensions >= 2) {
    const first = entries.find((entry) => dimensionEntries(entry).length >= 2);
    if (!first) return "table";
    const keys = dimensionEntries(first).map(([key]) => key);
    const [xKey, yKey] = keys;
    if (!xKey || !yKey) return "table";
    const uniqueValues = (key: string) =>
      new Set(
        entries.map((entry) =>
          JSON.stringify(dimensionEntries(entry).find(([item]) => item === key)?.[1] ?? null),
        ),
      ).size;
    const xCount = uniqueValues(xKey);
    const yCount = uniqueValues(yKey);
    // A one-column matrix or a long list of identities is better read as records.
    if (xCount < 2 || yCount < 2 || xCount * yCount > 64 || entries.length > 64) return "table";
    return "heatmap";
  }
  if (dimensions === 1 && entries.length > 20) return "table";
  return "bar";
}
