/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ActionTypeCondition,
  ActionTypeConditionOperation,
  KnowledgeNetworkMetricMutationPayload,
  KnowledgeNetworkMetricRecord,
  MetricCalculationFormula,
  MetricHavingOperator,
  MetricTimeDimension,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendMetric,
  BackendMetricCondition,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";

function mapMetricConditionFromBackend(
  condition?: BackendMetricCondition,
): ActionTypeCondition | undefined {
  if (!condition) {
    return undefined;
  }

  if (!condition.field && !(condition.sub_conditions?.length ?? 0)) {
    return undefined;
  }

  return {
    field: condition.field,
    objectTypeId: condition.object_type_id,
    operation: condition.operation as ActionTypeConditionOperation | undefined,
    subConditions: condition.sub_conditions
      ?.map((item) => mapMetricConditionFromBackend(item))
      .filter((item): item is ActionTypeCondition => Boolean(item)),
    value: condition.value,
    valueFrom: condition.value_from ?? "const",
  };
}

function toBackendMetricCondition(
  condition?: ActionTypeCondition,
): BackendMetricCondition | undefined {
  if (!condition?.field || !condition.operation) {
    return undefined;
  }

  return {
    field: condition.field,
    object_type_id: condition.objectTypeId,
    operation: condition.operation,
    sub_conditions: condition.subConditions
      ?.map((item) => toBackendMetricCondition(item))
      .filter((item): item is BackendMetricCondition => Boolean(item)),
    value: condition.value,
    value_from: condition.valueFrom ?? "const",
  };
}

function mapCalculationFormula(
  value: BackendMetric["calculation_formula"],
): MetricCalculationFormula {
  const aggregation = value?.aggregation;
  const orderBy = value?.order_by?.[0];

  return {
    aggregation: {
      aggr: aggregation?.aggr ?? "count",
      property: aggregation?.property ?? "",
    },
    analysisDimensions: (value?.analysis_dimensions ?? [])
      .map((item) => (typeof item === "string" ? item : item.property ?? ""))
      .filter(Boolean),
    condition: mapMetricConditionFromBackend(value?.condition),
    groupBy: (value?.group_by ?? [])
      .map((item) => (typeof item === "string" ? item : item.property ?? ""))
      .filter(Boolean),
    having: value?.having
      ? {
          operator: (value.having.operation ?? ">") as MetricHavingOperator,
          value:
            typeof value.having.value === "number"
              ? value.having.value
              : Number(value.having.value ?? 0),
        }
      : undefined,
    orderBy: orderBy
      ? {
          direction: orderBy.direction === "asc" ? "asc" : "desc",
          property: orderBy.property ?? "",
        }
      : undefined,
  };
}

function mapTimeDimension(
  value: BackendMetric["time_dimension"],
): MetricTimeDimension | undefined {
  if (!value?.property) {
    return undefined;
  }

  return {
    defaultRangePolicy: (value.default_range_policy ?? "last_24h") as MetricTimeDimension["defaultRangePolicy"],
    property: value.property,
  };
}

export function mapMetric(item: BackendMetric): KnowledgeNetworkMetricRecord {
  return {
    calculationFormula: mapCalculationFormula(item.calculation_formula),
    description: item.comment ?? "",
    id: item.id,
    metricType: item.metric_type ?? "atomic",
    name: item.name,
    scopeRef: item.scope_ref ?? "",
    scopeType: item.scope_type ?? "object_type",
    tags: item.tags ?? [],
    timeDimension: mapTimeDimension(item.time_dimension),
    unit: item.unit,
    unitType: item.unit_type,
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "--",
  };
}

export function toBackendMetricEntry(input: KnowledgeNetworkMetricMutationPayload) {
  const groupBy = (input.calculationFormula.groupBy ?? []).filter(Boolean);
  const analysisDimensions = (input.calculationFormula.analysisDimensions ?? []).filter(Boolean);
  const orderBy = input.calculationFormula.orderBy?.property
    ? [
        {
          direction: input.calculationFormula.orderBy.direction,
          property: input.calculationFormula.orderBy.property,
        },
      ]
    : undefined;

  return {
    calculation_formula: {
      aggregation: input.calculationFormula.aggregation,
      analysis_dimensions: analysisDimensions.map((property) => ({ property })),
      condition: toBackendMetricCondition(input.calculationFormula.condition),
      group_by: groupBy.map((property) => ({ property })),
      having: input.calculationFormula.having?.value
        ? {
            field: "__value",
            operation: input.calculationFormula.having.operator,
            value: input.calculationFormula.having.value,
          }
        : undefined,
      order_by: orderBy,
    },
    comment: input.description,
    metric_type: input.metricType,
    name: input.name,
    scope_ref: input.scopeRef,
    scope_type: input.scopeType,
    tags: input.tags,
    time_dimension: input.timeDimension?.property
      ? {
          default_range_policy: input.timeDimension.defaultRangePolicy,
          property: input.timeDimension.property,
        }
      : undefined,
    unit: input.unit,
    unit_type: input.unitType,
  };
}
