import type {
  RelationTypeResourceRowMapping,
  RelationTypeMappingConfig,
  RelationTypePropertyMapping,
} from "@/modules/knowledge-network/types/knowledge-network";

export type RelationTypeMappingFormValues = {
  mappingMode: "direct" | "resource";
  mappingRules: RelationTypeMappingConfig;
};

export function createEmptyPropertyMapping(): RelationTypePropertyMapping {
  return {
    sourcePropertyName: "",
    targetPropertyName: "",
  };
}

export function createEmptyResourceMapping(): RelationTypeResourceRowMapping {
  return {
    resourceSourcePropertyName: "",
    resourceTargetPropertyName: "",
    sourceObjectPropertyName: "",
    targetObjectPropertyName: "",
  };
}

export function createDefaultDirectMappingRules(): RelationTypeMappingConfig {
  return {
    backingDataSourceId: "",
    backingDataSourceName: "",
    resourceMappings: [createEmptyResourceMapping()],
    propertyMappings: [createEmptyPropertyMapping()],
    sourceObjectTypeId: "",
    targetObjectTypeId: "",
  };
}

export function createDefaultResourceMappingRules(): RelationTypeMappingConfig {
  return createDefaultDirectMappingRules();
}

export function createDefaultRelationTypeMappingValues(
  mappingMode: "direct" | "resource" = "direct",
): RelationTypeMappingFormValues {
  return {
    mappingMode,
    mappingRules:
      mappingMode === "resource"
        ? createDefaultResourceMappingRules()
        : createDefaultDirectMappingRules(),
  };
}

export function resetMappingRulesForMode(
  mode: "direct" | "resource",
): RelationTypeMappingConfig {
  return mode === "resource"
    ? createDefaultResourceMappingRules()
    : createDefaultDirectMappingRules();
}

export function countValidResourceMappings(
  mappings: RelationTypeResourceRowMapping[],
): number {
  return mappings.filter(
    (item) =>
      item.sourceObjectPropertyName &&
      item.resourceSourcePropertyName &&
      item.resourceTargetPropertyName &&
      item.targetObjectPropertyName,
  ).length;
}

export function normalizeRelationTypeMappingValues(
  value: RelationTypeMappingFormValues,
): RelationTypeMappingFormValues {
  if (value.mappingMode === "resource") {
    const resourceMappings = value.mappingRules.resourceMappings
      .filter(
        (item) =>
          item.sourceObjectPropertyName &&
          item.resourceSourcePropertyName &&
          item.resourceTargetPropertyName &&
          item.targetObjectPropertyName,
      )
      .map((item) => ({ ...item }));

    return {
      mappingMode: value.mappingMode,
      mappingRules: {
        backingDataSourceId: value.mappingRules.backingDataSourceId,
        backingDataSourceName: value.mappingRules.backingDataSourceName,
        resourceMappings:
          resourceMappings.length > 0 ? resourceMappings : [createEmptyResourceMapping()],
        propertyMappings: [createEmptyPropertyMapping()],
        sourceObjectTypeId: value.mappingRules.sourceObjectTypeId,
        targetObjectTypeId: value.mappingRules.targetObjectTypeId,
      },
    };
  }

  const propertyMappings = value.mappingRules.propertyMappings
    .filter((item) => item.sourcePropertyName && item.targetPropertyName)
    .map((item) => ({
      sourcePropertyName: item.sourcePropertyName,
      targetPropertyName: item.targetPropertyName,
    }));

  return {
    mappingMode: value.mappingMode,
    mappingRules: {
      backingDataSourceId: "",
      backingDataSourceName: "",
      resourceMappings: [createEmptyResourceMapping()],
      propertyMappings:
        propertyMappings.length > 0 ? propertyMappings : [createEmptyPropertyMapping()],
      sourceObjectTypeId: value.mappingRules.sourceObjectTypeId,
      targetObjectTypeId: value.mappingRules.targetObjectTypeId,
    },
  };
}

export function validateRelationTypeMappingValues(
  t: (key: string) => string,
  value: RelationTypeMappingFormValues,
): string | null {
  const { mappingRules } = value;

  if (!mappingRules.sourceObjectTypeId) {
    return t("knowledgeNetwork.relationTypeSourceObjectRequired");
  }

  if (!mappingRules.targetObjectTypeId) {
    return t("knowledgeNetwork.relationTypeTargetObjectRequired");
  }

  if (value.mappingMode === "direct") {
    const validMappings = mappingRules.propertyMappings.filter(
      (item) => item.sourcePropertyName && item.targetPropertyName,
    );

    if (validMappings.length === 0) {
      return t("knowledgeNetwork.relationTypePropertyMappingRequired");
    }

    return null;
  }

  if (!mappingRules.backingDataSourceId) {
    return t("knowledgeNetwork.relationTypeResourceRequired");
  }

  if (countValidResourceMappings(mappingRules.resourceMappings) === 0) {
    return t("knowledgeNetwork.relationTypeResourceMappingRequired");
  }

  return null;
}

export function buildRelationTypeMappingRulesFromDetail(
  detail: {
    backingDataSourceId?: string;
    backingDataSourceName?: string;
    resourceMappings: RelationTypeResourceRowMapping[];
    mappingMode: "direct" | "resource";
    propertyMappings: RelationTypePropertyMapping[];
    sourceObjectTypeId: string;
    targetObjectTypeId: string;
  },
): RelationTypeMappingConfig {
  return {
    backingDataSourceId: detail.backingDataSourceId ?? "",
    backingDataSourceName: detail.backingDataSourceName,
    resourceMappings:
      detail.resourceMappings.length > 0
        ? detail.resourceMappings.map((item) => ({ ...item }))
        : [createEmptyResourceMapping()],
    propertyMappings:
      detail.propertyMappings.length > 0
        ? detail.propertyMappings.map((item) => ({ ...item }))
        : [createEmptyPropertyMapping()],
    sourceObjectTypeId: detail.sourceObjectTypeId,
    targetObjectTypeId: detail.targetObjectTypeId,
  };
}
