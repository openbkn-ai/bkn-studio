/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import type {
  ObjectMetricDefinitionV1,
  ObjectMetricPropertyRefV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

type PropertyCatalog = {
  id: ObjectTypeDetail["id"];
  dataProperties: Array<Pick<ObjectTypeDetail["dataProperties"][number], "name" | "displayName">>;
  logicProperties: Array<Pick<ObjectTypeDetail["logicProperties"][number], "name" | "displayName">>;
};

type MetricAggregation = Extract<
  ObjectMetricDefinitionV1["specification"],
  { kind: "atomic" }
>["measure"]["aggregation"];

const aggregationTextKeys: Record<MetricAggregation, Parameters<typeof objectMetricText>[0]> = {
  avg: "mdb7538b96322",
  count: "m3a6663a758c9",
  count_distinct: "m1e96cd1f49bf",
  count_rows: "m21179deb9a74",
  max: "m1e7a22820768",
  min: "mb2dcdcfabb6a",
  sum: "m2819237ddb01",
};

export function objectMetricAggregationDisplayName(aggregation: MetricAggregation): string {
  const key = aggregationTextKeys[aggregation];
  return key ? objectMetricText(key) : aggregation;
}

export function objectMetricPropertyDisplayName(
  reference: ObjectMetricPropertyRefV1,
  objectType?: PropertyCatalog | null,
): string {
  if (!objectType || objectType.id !== reference.object_type_id) return reference.property_name;
  const property =
    objectType.dataProperties.find((item) => item.name === reference.property_name) ??
    objectType.logicProperties.find((item) => item.name === reference.property_name);
  return property?.displayName?.trim() || reference.property_name;
}

export function objectMetricPropertyDisplayLabels(
  objectType?: PropertyCatalog | null,
  dimensionReferences: ObjectMetricPropertyRefV1[] = [],
): Record<string, string> {
  const labels = Object.fromEntries(
    [...(objectType?.dataProperties ?? []), ...(objectType?.logicProperties ?? [])].map((item) => [
      item.name,
      item.displayName?.trim() || item.name,
    ]),
  );
  for (const reference of dimensionReferences) {
    if (reference.object_type_id !== objectType?.id) delete labels[reference.property_name];
  }
  return labels;
}
