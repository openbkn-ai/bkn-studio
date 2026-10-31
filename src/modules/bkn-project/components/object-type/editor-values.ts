/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DraftObjectType, DraftObjectTypeSave } from "@/modules/bkn-project/types/draft";
import type {
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
} from "@/modules/knowledge-network/types/object-type";

/*
 * A draft object type as the knowledge network's object type editor takes it, and back. The
 * editor marks the identity and the title on each property; the draft names them on the type.
 */

export function editorDataSource(objectType: DraftObjectType): ObjectTypeDataSource {
  return { id: objectType.dataSource.id, name: objectType.dataSource.name, type: "resource" };
}

export function editorProperties(objectType: DraftObjectType): ObjectTypeDataProperty[] {
  const identity = new Set(objectType.primaryKeys);
  return objectType.properties.map((property) => ({
    comment: property.description,
    displayKey: property.name === objectType.displayKey,
    displayName: property.displayName,
    incrementalKey: property.name === objectType.incrementalKey,
    mappedField: property.mappedField
      ? { displayName: property.mappedField, name: property.mappedField, type: property.type }
      : undefined,
    name: property.name,
    primaryKey: identity.has(property.name),
    type: property.type,
  }));
}

/**
 * What saving sends for the editor's values. The editor does not choose the update field: the
 * draft's stays while its property does.
 */
export function draftSave(
  objectType: DraftObjectType,
  basic: { description: string; name: string },
  properties: ObjectTypeDataProperty[],
): DraftObjectTypeSave {
  const names = new Set(properties.map((property) => property.name));
  return {
    description: basic.description.trim(),
    displayKey: properties.find((property) => property.displayKey)?.name ?? "",
    incrementalKey: names.has(objectType.incrementalKey) ? objectType.incrementalKey : "",
    name: basic.name.trim(),
    primaryKeys: properties.filter((property) => property.primaryKey).map(({ name }) => name),
    properties: properties.map((property) => ({
      description: property.comment?.trim() ?? "",
      displayName: property.displayName,
      ...(property.mappedField ? { mappedField: property.mappedField.name } : {}),
      name: property.name,
      type: property.type,
    })),
  };
}
