/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkRelationTypeMutationPayload,
  RelationTypeResourceRowMapping,
  RelationTypeMappingConfig,
  RelationTypePropertyMapping,
  StoredRelationProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import {
  type BackendDefinitionDeclarationFields,
  type BackendRelationDeclarationFields,
  definitionDeclarationPatch,
  relationDeclarationPatch,
} from "./declarations";

export type BackendRelationPropertyMapping = {
  source_property?: {
    display_name?: string;
    name?: string;
    type?: string;
  };
  target_property?: {
    display_name?: string;
    name?: string;
    type?: string;
  };
};

export type BackendRelationTypeMappingRules =
  | BackendRelationPropertyMapping[]
  | {
      backing_data_source?: {
        display_name?: string;
        id?: string;
        name?: string;
        type?: string;
      };
      /** BKN spec 3.0 relation properties, included when a save edits them. */
      properties?: BackendRelationProperty[] | null;
      source_mapping_rules?: BackendRelationPropertyMapping[];
      target_mapping_rules?: BackendRelationPropertyMapping[];
    };

/** A relation property and any additional declaration fields returned by the backend. */
export type BackendRelationProperty = {
  [key: string]: unknown;
  constraints?: StoredRelationProperty["constraints"];
  display_name?: string;
  mapped_field?: { [key: string]: unknown; name?: string; type?: string } | null;
  name?: string;
  required?: boolean;
  type?: string;
};

export type BackendRelationTypeCreateEntry = BackendRelationDeclarationFields &
  BackendDefinitionDeclarationFields & {
    branch: "main";
    color?: string;
    comment?: string;
    id?: string;
    mapping_mode?: "direct" | "indirect";
    mapping_rules?: BackendRelationTypeMappingRules;
    name: string;
    source_object_type_id: string;
    tags?: string[];
    target_object_type_id: string;
    type?: "direct" | "indirect";
  };

export type BackendRelationTypeUpdatePayload = BackendRelationTypeCreateEntry;

export type RelationTypeMappingReadResult = {
  backingDataSourceId: string;
  backingDataSourceName?: string;
  resourceMappings: RelationTypeResourceRowMapping[];
  propertyMappings: RelationTypePropertyMapping[];
};

function createEmptyResourceMapping(): RelationTypeResourceRowMapping {
  return {
    resourceSourcePropertyName: "",
    resourceTargetPropertyName: "",
    sourceObjectPropertyName: "",
    targetObjectPropertyName: "",
  };
}

function toBackendDirectMappingRules(
  propertyMappings: RelationTypePropertyMapping[],
): BackendRelationPropertyMapping[] {
  return propertyMappings
    .filter((item) => item.sourcePropertyName && item.targetPropertyName)
    .map((item) => ({
      source_property: { name: item.sourcePropertyName },
      target_property: { name: item.targetPropertyName },
    }));
}

function toBackendResourceMappingRules(
  mappingRules: RelationTypeMappingConfig,
): Extract<BackendRelationTypeMappingRules, { backing_data_source?: unknown }> {
  const sourceMappingRules = mappingRules.resourceMappings
    .filter((item) => item.sourceObjectPropertyName && item.resourceSourcePropertyName)
    .map((item) => ({
      source_property: { name: item.sourceObjectPropertyName },
      target_property: { name: item.resourceSourcePropertyName },
    }));
  const targetMappingRules = mappingRules.resourceMappings
    .filter((item) => item.targetObjectPropertyName && item.resourceTargetPropertyName)
    .map((item) => ({
      source_property: { name: item.resourceTargetPropertyName },
      target_property: { name: item.targetObjectPropertyName },
    }));

  return {
    backing_data_source: {
      id: mappingRules.backingDataSourceId,
      name: mappingRules.backingDataSourceName,
      type: "resource",
    },
    source_mapping_rules: sourceMappingRules,
    target_mapping_rules: targetMappingRules,
    ...(mappingRules.relationProperties !== undefined
      ? { properties: mappingRules.relationProperties.map(toBackendRelationProperty) }
      : {}),
  };
}

function toBackendRelationProperty(property: StoredRelationProperty): BackendRelationProperty {
  const declaration = property.declaration ?? {};
  const storedField = declaration.mapped_field;
  const mappedField =
    storedField && typeof storedField === "object" && !Array.isArray(storedField)
      ? storedField
      : {};

  return {
    ...declaration,
    name: property.name,
    ...(property.displayName !== undefined ? { display_name: property.displayName } : {}),
    ...(property.type !== undefined ? { type: property.type } : {}),
    ...(property.required !== undefined ? { required: property.required } : {}),
    ...(property.mappedField !== undefined
      ? {
          mapped_field: {
            ...mappedField,
            name: property.mappedField,
            ...(!("type" in mappedField) && property.type !== undefined
              ? { type: property.type }
              : {}),
          },
        }
      : {}),
    ...(property.constraints !== undefined ? { constraints: property.constraints } : {}),
  };
}

export function mapRelationTypePropertyMappingsFromBackend(
  mappingRules?: BackendRelationTypeMappingRules,
): RelationTypePropertyMapping[] {
  if (!mappingRules || !Array.isArray(mappingRules)) {
    return [];
  }

  return mappingRules
    .filter((item) => item.source_property?.name && item.target_property?.name)
    .map((item) => ({
      sourcePropertyName: item.source_property!.name!,
      targetPropertyName: item.target_property!.name!,
    }));
}

export function mapRelationTypeMappingsFromBackend(
  mappingRules?: BackendRelationTypeMappingRules,
  mappingMode: "direct" | "resource" = "direct",
): RelationTypeMappingReadResult {
  if (mappingMode === "resource") {
    if (!mappingRules || Array.isArray(mappingRules)) {
      return {
        backingDataSourceId: "",
        backingDataSourceName: "",
        resourceMappings: [createEmptyResourceMapping()],
        propertyMappings: [],
      };
    }

    const sourceRules = mappingRules.source_mapping_rules ?? [];
    const targetRules = mappingRules.target_mapping_rules ?? [];
    const rowCount = Math.max(sourceRules.length, targetRules.length, 1);
    const resourceMappings = Array.from({ length: rowCount }, (_, index) => ({
      sourceObjectPropertyName: sourceRules[index]?.source_property?.name ?? "",
      resourceSourcePropertyName: sourceRules[index]?.target_property?.name ?? "",
      resourceTargetPropertyName: targetRules[index]?.source_property?.name ?? "",
      targetObjectPropertyName: targetRules[index]?.target_property?.name ?? "",
    }));

    return {
      backingDataSourceId: mappingRules.backing_data_source?.id ?? "",
      backingDataSourceName:
        mappingRules.backing_data_source?.name ?? mappingRules.backing_data_source?.display_name,
      resourceMappings,
      propertyMappings: [],
    };
  }

  const propertyMappings = mapRelationTypePropertyMappingsFromBackend(mappingRules);

  return {
    backingDataSourceId: "",
    backingDataSourceName: "",
    resourceMappings: [createEmptyResourceMapping()],
    propertyMappings: propertyMappings.length > 0 ? propertyMappings : [],
  };
}

/** Read editable fields while retaining the full declaration for subsequent saves. */
export function mapStoredRelationProperties(
  mappingRules?: BackendRelationTypeMappingRules,
): StoredRelationProperty[] {
  if (!mappingRules || Array.isArray(mappingRules)) {
    return [];
  }
  return (mappingRules.properties ?? []).flatMap((item) =>
    item.name
      ? [
          {
            name: item.name,
            declaration: structuredClone(item),
            ...(item.display_name !== undefined ? { displayName: item.display_name } : {}),
            ...(item.mapped_field?.name !== undefined
              ? { mappedField: item.mapped_field.name }
              : {}),
            ...(item.type !== undefined ? { type: item.type } : {}),
            ...(item.required !== undefined ? { required: item.required } : {}),
            ...(item.constraints !== undefined
              ? { constraints: structuredClone(item.constraints) }
              : {}),
          },
        ]
      : [],
  );
}

function appendMappingRules(
  payload: BackendRelationTypeCreateEntry,
  input: KnowledgeNetworkRelationTypeMutationPayload,
): BackendRelationTypeCreateEntry {
  if (!input.mappingRules) {
    return payload;
  }

  if (input.mappingMode === "resource") {
    if (!input.mappingRules.backingDataSourceId) {
      return payload;
    }

    return {
      ...payload,
      mapping_rules: toBackendResourceMappingRules(input.mappingRules),
    };
  }

  const mappingRules = toBackendDirectMappingRules(input.mappingRules.propertyMappings);
  if (mappingRules.length === 0) {
    return payload;
  }

  return {
    ...payload,
    mapping_rules: mappingRules,
  };
}

export function toBackendRelationTypeCreateEntry(
  input: KnowledgeNetworkRelationTypeMutationPayload,
): BackendRelationTypeCreateEntry {
  const mappingMode = input.mappingMode === "resource" ? "indirect" : "direct";

  const payload: BackendRelationTypeCreateEntry = {
    branch: "main",
    color: input.color,
    comment: input.description,
    id: input.id?.trim() || undefined,
    mapping_mode: mappingMode,
    name: input.name,
    source_object_type_id: input.sourceObjectTypeId,
    tags: input.tags,
    target_object_type_id: input.targetObjectTypeId,
    type: mappingMode,
  };

  const declarations = input.declarationEdit
    ? relationDeclarationPatch(input.declarationEdit.current, input.declarationEdit.baseline)
    : {};
  const definitionDeclarations = input.definitionDeclarationEdit
    ? definitionDeclarationPatch(
        input.definitionDeclarationEdit.current,
        input.definitionDeclarationEdit.baseline,
      )
    : {};

  return { ...appendMappingRules(payload, input), ...declarations, ...definitionDeclarations };
}

export function toBackendRelationTypeUpdatePayload(
  input: KnowledgeNetworkRelationTypeMutationPayload,
): BackendRelationTypeUpdatePayload {
  return toBackendRelationTypeCreateEntry(input);
}
