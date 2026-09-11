/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import {
  formatSemanticConditionLabel,
  formatSemanticPropertyList,
  mapMetricAnalysisDimensionFields,
  resolvePropertyDisplayName,
  toPublishedMetricPropertyOptions,
} from "./metric-property-display";

const propertyOptions: RelationTypePropertyOption[] = [
  {
    displayName: "数量",
    label: "数量",
    name: "qty",
    type: "integer",
    value: "qty",
  },
  {
    displayName: "状态",
    label: "状态",
    name: "status",
    type: "string",
    value: "status",
  },
];

describe("metric-property-display", () => {
  it("uses only minimal property metadata embedded in the metric", () => {
    const options = toPublishedMetricPropertyOptions({
      calculationFormula: { aggregation: { aggr: "sum", property: "amount" } },
      dependencyProperties: [
        { displayName: "Amount", name: "amount", type: "double" },
        { displayName: "Region", name: "region", type: "string" },
      ],
      description: "",
      id: "metric-1",
      metricType: "atomic",
      name: "Sales",
      scopeRef: "orders",
      scopeType: "object_type",
      tags: [],
      updateTime: "",
      updaterName: "",
    });

    expect(options.map(({ label, type, value }) => ({ label, type, value }))).toEqual([
      { label: "Amount", type: "double", value: "amount" },
      { label: "Region", type: "string", value: "region" },
    ]);
  });

  it("maps metric analysis dimensions to semantic fields", () => {
    expect(
      mapMetricAnalysisDimensionFields(["qty", "status"], [
        {
          displayKey: false,
          displayName: "数量",
          incrementalKey: false,
          name: "qty",
          primaryKey: false,
          type: "integer",
        },
        {
          displayKey: false,
          displayName: "状态",
          incrementalKey: false,
          name: "status",
          primaryKey: false,
          type: "string",
        },
      ]),
    ).toEqual([
      { displayName: "数量", name: "qty", type: "integer" },
      { displayName: "状态", name: "status", type: "string" },
    ]);
  });

  it("resolves property display names", () => {
    expect(resolvePropertyDisplayName("qty", propertyOptions)).toBe("数量");
    expect(resolvePropertyDisplayName("unknown", propertyOptions)).toBe("unknown");
  });

  it("formats semantic property lists and conditions", () => {
    expect(formatSemanticPropertyList(["qty", "status"], propertyOptions)).toBe("数量, 状态");
    expect(formatSemanticPropertyList([], propertyOptions)).toBe("--");
    expect(formatSemanticPropertyList(["", "  "], propertyOptions)).toBe("--");

    const label = formatSemanticConditionLabel(
      { field: "status", operation: "==", value: "Active" },
      propertyOptions,
      (key) => (key.endsWith("_==") ? "等于" : key),
      "--",
    );

    expect(label).toBe("状态 等于 Active");
  });
});
