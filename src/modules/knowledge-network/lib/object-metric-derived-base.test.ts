/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";

import { derivedBaseMetricFormPatch } from "./object-metric-derived-base";

describe("derived base metric form patch", () => {
  it("inherits the new value contract and clears fields owned by the previous base", () => {
    const base = createObjectMetricDefinitionV1("atomic", "order");
    base.result_semantics.no_data_policy = "zero";
    base.result_semantics.value = {
      maximum: 999,
      minimum: 0,
      physical_type: "decimal",
      precision: 18,
      rounding_mode: "half_up",
      scale: 2,
      semantic_type: "amount",
      unit: {
        code: "CNY",
        quantity_kind: "currency",
        scale_factor: 1,
        system: "ISO_4217",
      },
    };

    expect(derivedBaseMetricFormPatch(base)).toEqual({
      analysisDimensions: [],
      eventTime: undefined,
      fixedTimeRange: undefined,
      grainWeekStart: undefined,
      groupByDimensions: [],
      maximum: 999,
      minimum: 0,
      noDataPolicy: "zero",
      physicalType: "decimal",
      precision: 18,
      quantityKind: "currency",
      relationCountComparison: undefined,
      relationCountThreshold: undefined,
      relationQuantifier: undefined,
      roundingMode: "half_up",
      scale: 2,
      semanticType: "amount",
      timeDimensions: [],
      timeGranularity: undefined,
      timeWindowLength: undefined,
      timeWindowMode: "unbounded",
      timeWindowUnit: undefined,
      timezone: undefined,
      unitCode: "CNY",
      unitDenominatorCode: undefined,
      unitDenominatorKind: undefined,
      unitDenominatorSystem: undefined,
      unitNumeratorCode: undefined,
      unitNumeratorKind: undefined,
      unitNumeratorSystem: undefined,
      unitScaleFactor: 1,
      unitSystem: "ISO_4217",
      weekStart: undefined,
    });
  });
});
