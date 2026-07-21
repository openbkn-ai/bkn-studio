/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
} from "@/modules/knowledge-network/types/knowledge-network";

import { canBeDisplayKey, canBePrimaryKey } from "./constants";

export type ConnectionPoint = {
  propertyName: string;
  viewFieldName: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

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
