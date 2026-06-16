import type {
  KnowledgeNetworkRelationTypeMutationPayload,
  RelationTypeResourceRowMapping,
  RelationTypeMappingConfig,
  RelationTypePropertyMapping,
} from "@/modules/knowledge-network/types/knowledge-network";

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
      source_mapping_rules?: BackendRelationPropertyMapping[];
      target_mapping_rules?: BackendRelationPropertyMapping[];
    };

export type BackendRelationTypeCreateEntry = {
  branch: "main";
  color?: string;
  comment?: string;
  id?: string;
  mapping_mode?: "direct" | "data_view";
  mapping_rules?: BackendRelationTypeMappingRules;
  name: string;
  source_object_type_id: string;
  tags?: string[];
  target_object_type_id: string;
  type?: "direct" | "data_view";
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
        mappingRules.backing_data_source?.name ??
        mappingRules.backing_data_source?.display_name,
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
  const mappingMode = input.mappingMode === "resource" ? "data_view" : "direct";

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

  return appendMappingRules(payload, input);
}

export function toBackendRelationTypeUpdatePayload(
  input: KnowledgeNetworkRelationTypeMutationPayload,
): BackendRelationTypeUpdatePayload {
  return toBackendRelationTypeCreateEntry(input);
}
