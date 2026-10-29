/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectMetricDefinitionV1,
  ObjectMetricUnitSpecV1,
} from "@/modules/knowledge-network/types/object-metric";

type UnitQuantityKind = ObjectMetricUnitSpecV1["quantity_kind"];

export type DerivedBaseMetricFormPatch = {
  analysisDimensions: string[];
  eventTime: undefined;
  fixedTimeRange: undefined;
  grainWeekStart: undefined;
  groupByDimensions: string[];
  maximum: number | undefined;
  minimum: number | undefined;
  noDataPolicy: ObjectMetricDefinitionV1["result_semantics"]["no_data_policy"];
  physicalType: ObjectMetricDefinitionV1["result_semantics"]["value"]["physical_type"];
  precision: number | undefined;
  quantityKind: UnitQuantityKind | undefined;
  relationCountComparison: undefined;
  relationCountThreshold: undefined;
  relationQuantifier: undefined;
  roundingMode: ObjectMetricDefinitionV1["result_semantics"]["value"]["rounding_mode"];
  scale: number | undefined;
  semanticType: ObjectMetricDefinitionV1["result_semantics"]["value"]["semantic_type"];
  timeDimensions: string[];
  timeGranularity: undefined;
  timeWindowLength: undefined;
  timeWindowMode: "unbounded";
  timeWindowUnit: undefined;
  timezone: undefined;
  unitCode: string | undefined;
  unitDenominatorCode: string | undefined;
  unitDenominatorKind: Exclude<UnitQuantityKind, "rate"> | undefined;
  unitDenominatorSystem: ObjectMetricUnitSpecV1["system"] | undefined;
  unitNumeratorCode: string | undefined;
  unitNumeratorKind: Exclude<UnitQuantityKind, "rate"> | undefined;
  unitNumeratorSystem: ObjectMetricUnitSpecV1["system"] | undefined;
  unitScaleFactor: number | undefined;
  unitSystem: ObjectMetricUnitSpecV1["system"] | undefined;
  weekStart: undefined;
};

/**
 * Builds the inherited form state for a newly selected base metric. All fields
 * tied to the previous base are cleared in the same operation so manual and AI
 * base changes cannot leave stale dimensions, windows, or relation qualifiers.
 */
export function derivedBaseMetricFormPatch(
  definition: Pick<ObjectMetricDefinitionV1, "result_semantics">,
): DerivedBaseMetricFormPatch {
  const value = definition.result_semantics.value;
  return {
    analysisDimensions: [],
    eventTime: undefined,
    fixedTimeRange: undefined,
    grainWeekStart: undefined,
    groupByDimensions: [],
    maximum: value.maximum,
    minimum: value.minimum,
    noDataPolicy: definition.result_semantics.no_data_policy,
    physicalType: value.physical_type,
    precision: value.precision,
    quantityKind: value.unit?.quantity_kind,
    relationCountComparison: undefined,
    relationCountThreshold: undefined,
    relationQuantifier: undefined,
    roundingMode: value.rounding_mode,
    scale: value.scale,
    semanticType: value.semantic_type,
    timeDimensions: [],
    timeGranularity: undefined,
    timeWindowLength: undefined,
    timeWindowMode: "unbounded",
    timeWindowUnit: undefined,
    timezone: undefined,
    unitCode: value.unit?.code,
    unitDenominatorCode: value.unit?.denominator?.code,
    unitDenominatorKind: value.unit?.denominator?.quantity_kind as
      Exclude<UnitQuantityKind, "rate"> | undefined,
    unitDenominatorSystem: value.unit?.denominator?.system,
    unitNumeratorCode: value.unit?.numerator?.code,
    unitNumeratorKind: value.unit?.numerator?.quantity_kind as
      Exclude<UnitQuantityKind, "rate"> | undefined,
    unitNumeratorSystem: value.unit?.numerator?.system,
    unitScaleFactor: value.unit?.scale_factor,
    unitSystem: value.unit?.system,
    weekStart: undefined,
  };
}
