/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
  ObjectTypeResourceField,
} from "@/modules/knowledge-network/types/knowledge-network";

import { canBeDisplayKey, canBePrimaryKey } from "./constants";

export type MappingFilter = "all" | "mapped" | "unmapped";

export type MappingDisplaySection = "mapped" | "unmapped";

export type MappingDisplayRow<T> = {
  item: T;
  section: MappingDisplaySection;
};

export type MappingAlignedLayout = {
  propertyRows: MappingDisplayRow<ObjectTypeDataProperty>[];
  viewFieldRows: MappingDisplayRow<ObjectTypeResourceField>[];
};

export type ConnectionPoint = {
  propertyName: string;
  viewFieldName: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

export function buildConnectionId(viewFieldName: string, propertyName: string) {
  return `${viewFieldName}::${propertyName}`;
}

function matchesMappingKeyword(
  displayName: string,
  name: string,
  keyword: string,
) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    displayName.toLowerCase().includes(normalized) ||
    name.toLowerCase().includes(normalized)
  );
}

export function buildMappingAlignedLayout(
  viewFields: ObjectTypeResourceField[],
  properties: ObjectTypeDataProperty[],
): MappingAlignedLayout {
  const fieldByName = new Map(viewFields.map((field) => [field.name, field]));
  const mappedPairs: Array<{
    field: ObjectTypeResourceField;
    property: ObjectTypeDataProperty;
  }> = [];

  properties.forEach((property) => {
    if (!property.mappedField) {
      return;
    }

    const field = fieldByName.get(property.mappedField.name);
    if (!field) {
      return;
    }

    mappedPairs.push({ field, property });
  });

  const mappedFieldNames = new Set(mappedPairs.map((pair) => pair.field.name));
  const mappedPropertyNames = new Set(mappedPairs.map((pair) => pair.property.name));
  const unmappedFields = viewFields.filter((field) => !mappedFieldNames.has(field.name));
  const unmappedProperties = properties.filter(
    (property) => !mappedPropertyNames.has(property.name),
  );

  return {
    viewFieldRows: [
      ...mappedPairs.map(({ field }) => ({ item: field, section: "mapped" as const })),
      ...unmappedFields.map((item) => ({ item, section: "unmapped" as const })),
    ],
    propertyRows: [
      ...mappedPairs.map(({ property }) => ({ item: property, section: "mapped" as const })),
      ...unmappedProperties.map((item) => ({ item, section: "unmapped" as const })),
    ],
  };
}

export function applyMappingFilter<T>(
  rows: MappingDisplayRow<T>[],
  filter: MappingFilter,
): MappingDisplayRow<T>[] {
  if (filter === "all") {
    return rows;
  }

  return rows.filter((row) => row.section === filter);
}

export function filterViewFieldRows(
  rows: MappingDisplayRow<ObjectTypeResourceField>[],
  keyword: string,
  mappedPropertyByFieldName: Map<string, ObjectTypeDataProperty>,
  propertyKeyword: string,
): MappingDisplayRow<ObjectTypeResourceField>[] {
  const normalizedFieldKeyword = keyword.trim().toLowerCase();
  const normalizedPropertyKeyword = propertyKeyword.trim().toLowerCase();

  if (!normalizedFieldKeyword && !normalizedPropertyKeyword) {
    return rows;
  }

  return rows.filter(({ item: field }) => {
    const fieldMatches = matchesMappingKeyword(
      field.displayName,
      field.name,
      normalizedFieldKeyword,
    );
    const mappedProperty = mappedPropertyByFieldName.get(field.name);
    const partnerMatches = mappedProperty
      ? matchesMappingKeyword(
          mappedProperty.displayName,
          mappedProperty.name,
          normalizedPropertyKeyword,
        )
      : false;

    if (normalizedFieldKeyword && normalizedPropertyKeyword) {
      return fieldMatches || partnerMatches;
    }
    if (normalizedFieldKeyword) {
      return fieldMatches;
    }
    return partnerMatches;
  });
}

export function filterPropertyRows(
  rows: MappingDisplayRow<ObjectTypeDataProperty>[],
  keyword: string,
  mappedFieldByPropertyName: Map<string, ObjectTypeResourceField>,
  fieldKeyword: string,
): MappingDisplayRow<ObjectTypeDataProperty>[] {
  const normalizedPropertyKeyword = keyword.trim().toLowerCase();
  const normalizedFieldKeyword = fieldKeyword.trim().toLowerCase();

  if (!normalizedPropertyKeyword && !normalizedFieldKeyword) {
    return rows;
  }

  return rows.filter(({ item: property }) => {
    const propertyMatches = matchesMappingKeyword(
      property.displayName,
      property.name,
      normalizedPropertyKeyword,
    );
    const mappedField = property.mappedField
      ? mappedFieldByPropertyName.get(property.name)
      : undefined;
    const partnerMatches = mappedField
      ? matchesMappingKeyword(
          mappedField.displayName,
          mappedField.name,
          normalizedFieldKeyword,
        )
      : false;

    if (normalizedPropertyKeyword && normalizedFieldKeyword) {
      return propertyMatches || partnerMatches;
    }
    if (normalizedPropertyKeyword) {
      return propertyMatches;
    }
    return partnerMatches;
  });
}

export function countMappedProperties(properties: ObjectTypeDataProperty[]) {
  return properties.filter((property) => Boolean(property.mappedField)).length;
}

export function isMappedPropertyConnectionVisible(
  property: ObjectTypeDataProperty,
  visibleViewFieldNames: ReadonlySet<string>,
  visiblePropertyNames: ReadonlySet<string>,
) {
  return (
    Boolean(property.mappedField) &&
    visiblePropertyNames.has(property.name) &&
    visibleViewFieldNames.has(property.mappedField?.name ?? "")
  );
}

export function areConnectionsEqual(left: ConnectionPoint[], right: ConnectionPoint[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return (
        item.propertyName === other.propertyName &&
        item.viewFieldName === other.viewFieldName &&
        item.x1 === other.x1 &&
        item.y1 === other.y1 &&
        item.x2 === other.x2 &&
        item.y2 === other.y2
      );
    })
  );
}

function areMappedFieldsEqual(
  left?: ObjectTypeDataProperty["mappedField"],
  right?: ObjectTypeDataProperty["mappedField"],
) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }
  return (
    left.displayName === right.displayName &&
    left.name === right.name &&
    left.type === right.type
  );
}

export function areDataPropertiesEqual(
  left: ObjectTypeDataProperty[],
  right: ObjectTypeDataProperty[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    return (
      item.comment === other.comment &&
      item.displayKey === other.displayKey &&
      item.displayName === other.displayName &&
      item.name === other.name &&
      item.primaryKey === other.primaryKey &&
      item.totalCount === other.totalCount &&
      item.type === other.type &&
      areMappedFieldsEqual(item.mappedField, other.mappedField)
    );
  });
}

export function areDataSourcesEqual(
  left?: ObjectTypeDataSource,
  right?: ObjectTypeDataSource,
) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }
  return (
    left.dataSourceId === right.dataSourceId &&
    left.id === right.id &&
    left.name === right.name
  );
}

export function areStringArraysEqualAsSets(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

export function applyPrimaryKeySelection(
  properties: ObjectTypeDataProperty[],
  names: string[],
): { changed: boolean; nextProperties: ObjectTypeDataProperty[] } {
  const nameSet = new Set(names);
  let changed = false;
  const nextProperties = properties.map((item) => {
    const primaryKey = nameSet.has(item.name) && canBePrimaryKey(item.type);
    if (item.primaryKey === primaryKey) {
      return item;
    }
    changed = true;
    return { ...item, primaryKey };
  });
  return {
    changed,
    nextProperties: changed ? nextProperties : properties,
  };
}

export function applyDisplayKeySelection(
  properties: ObjectTypeDataProperty[],
  name: string,
): { changed: boolean; nextProperties: ObjectTypeDataProperty[] } {
  let changed = false;
  const nextProperties = properties.map((item) => {
    const displayKey = item.name === name && canBeDisplayKey(item.type);
    if (item.displayKey === displayKey) {
      return item;
    }
    changed = true;
    return { ...item, displayKey };
  });
  return {
    changed,
    nextProperties: changed ? nextProperties : properties,
  };
}
