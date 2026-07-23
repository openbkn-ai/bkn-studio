/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  findConditionProperty,
  getConditionOperationLabelKey,
} from "@/modules/knowledge-network/constants/action-type-condition";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type {
  ActionTypeCondition,
  ObjectTypeDataProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

export function toMetricPropertyOptions(
  properties: ObjectTypeDataProperty[],
): RelationTypePropertyOption[] {
  return properties.map((property) => ({
    comment: property.comment,
    displayName: property.displayName || property.name,
    label: property.displayName || property.name,
    name: property.name,
    type: property.type,
    value: property.name,
  }));
}

export function mapMetricAnalysisDimensionFields(
  dimensionNames: string[],
  scopeProperties: ObjectTypeDataProperty[],
) {
  const propertyOptions = toMetricPropertyOptions(scopeProperties);

  return dimensionNames.map((name) => ({
    displayName: resolvePropertyDisplayName(name, propertyOptions, name),
    name,
    type: scopeProperties.find((property) => property.name === name)?.type ?? "string",
  }));
}

export function resolvePropertyDisplayName(
  propertyName: string | undefined,
  propertyOptions: RelationTypePropertyOption[],
  emptyLabel = "--",
): string {
  if (!propertyName) {
    return emptyLabel;
  }

  const property = findConditionProperty(propertyOptions, propertyName);
  return property?.displayName || property?.label || propertyName;
}

export function formatSemanticPropertyList(
  values: string[] | undefined,
  propertyOptions: RelationTypePropertyOption[],
  emptyLabel = "--",
): string {
  const normalizedValues = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (normalizedValues.length === 0) {
    return emptyLabel;
  }

  return normalizedValues
    .map((value) => resolvePropertyDisplayName(value, propertyOptions, value))
    .join(", ");
}

export function formatSemanticConditionLabel(
  condition: ActionTypeCondition | undefined,
  propertyOptions: RelationTypePropertyOption[],
  t: (key: string) => string,
  emptyLabel: string,
): string {
  if (!condition?.field || !condition.operation) {
    return emptyLabel;
  }

  const fieldLabel = resolvePropertyDisplayName(condition.field, propertyOptions);
  const operationLabel = t(getConditionOperationLabelKey(condition.operation));
  const value =
    Array.isArray(condition.value) ? condition.value.join(", ") : condition.value;

  const current =
    condition.operation === "exist" || condition.operation === "not_exist"
      ? `${fieldLabel} ${operationLabel}`
      : value
        ? `${fieldLabel} ${operationLabel} ${value}`
        : `${fieldLabel} ${operationLabel}`;

  const subConditions = condition.subConditions
    ?.map((item) => formatSemanticConditionLabel(item, propertyOptions, t, ""))
    .filter(Boolean);

  return subConditions?.length ? [current, ...subConditions].join("; ") : current;
}

export function formatSemanticOrderByLabel(
  property: string | undefined,
  direction: string | undefined,
  propertyOptions: RelationTypePropertyOption[],
  t: (key: string) => string,
  emptyLabel = "--",
): string {
  if (!property) {
    return emptyLabel;
  }

  const propertyLabel = resolvePropertyDisplayName(property, propertyOptions);
  const directionLabel =
    direction === "asc"
      ? t("knowledgeNetwork.metricOrderAsc")
      : direction === "desc"
        ? t("knowledgeNetwork.metricOrderDesc")
        : direction;

  return directionLabel ? `${propertyLabel} (${directionLabel})` : propertyLabel;
}
