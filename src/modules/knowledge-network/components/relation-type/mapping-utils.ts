import type {
  RelationTypeDataViewRowMapping,
  RelationTypeMappingConfig,
  RelationTypePropertyMapping,
} from "@/modules/knowledge-network/types/knowledge-network";

export type RelationTypeMappingFormValues = {
  mappingMode: "direct" | "data-view";
  mappingRules: RelationTypeMappingConfig;
};

export function createEmptyPropertyMapping(): RelationTypePropertyMapping {
  return {
    sourcePropertyName: "",
    targetPropertyName: "",
  };
}

export function createEmptyDataViewMapping(): RelationTypeDataViewRowMapping {
  return {
    dataViewSourcePropertyName: "",
    dataViewTargetPropertyName: "",
    sourceObjectPropertyName: "",
    targetObjectPropertyName: "",
  };
}

export function createDefaultDirectMappingRules(): RelationTypeMappingConfig {
  return {
    backingDataSourceId: "",
    backingDataSourceName: "",
    dataViewMappings: [createEmptyDataViewMapping()],
    propertyMappings: [createEmptyPropertyMapping()],
    sourceObjectTypeId: "",
    targetObjectTypeId: "",
  };
}

export function createDefaultDataViewMappingRules(): RelationTypeMappingConfig {
  return createDefaultDirectMappingRules();
}

export function createDefaultRelationTypeMappingValues(
  mappingMode: "direct" | "data-view" = "direct",
): RelationTypeMappingFormValues {
  return {
    mappingMode,
    mappingRules:
      mappingMode === "data-view"
        ? createDefaultDataViewMappingRules()
        : createDefaultDirectMappingRules(),
  };
}

export function resetMappingRulesForMode(
  mode: "direct" | "data-view",
): RelationTypeMappingConfig {
  return mode === "data-view"
    ? createDefaultDataViewMappingRules()
    : createDefaultDirectMappingRules();
}

export function countValidDataViewMappings(
  mappings: RelationTypeDataViewRowMapping[],
): number {
  return mappings.filter(
    (item) =>
      item.sourceObjectPropertyName &&
      item.dataViewSourcePropertyName &&
      item.dataViewTargetPropertyName &&
      item.targetObjectPropertyName,
  ).length;
}

export function normalizeRelationTypeMappingValues(
  value: RelationTypeMappingFormValues,
): RelationTypeMappingFormValues {
  if (value.mappingMode === "data-view") {
    const dataViewMappings = value.mappingRules.dataViewMappings
      .filter(
        (item) =>
          item.sourceObjectPropertyName &&
          item.dataViewSourcePropertyName &&
          item.dataViewTargetPropertyName &&
          item.targetObjectPropertyName,
      )
      .map((item) => ({ ...item }));

    return {
      mappingMode: value.mappingMode,
      mappingRules: {
        backingDataSourceId: value.mappingRules.backingDataSourceId,
        backingDataSourceName: value.mappingRules.backingDataSourceName,
        dataViewMappings:
          dataViewMappings.length > 0 ? dataViewMappings : [createEmptyDataViewMapping()],
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
      dataViewMappings: [createEmptyDataViewMapping()],
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
    return t("knowledgeNetwork.relationTypeDataViewRequired");
  }

  if (countValidDataViewMappings(mappingRules.dataViewMappings) === 0) {
    return t("knowledgeNetwork.relationTypeDataViewMappingRequired");
  }

  return null;
}

export function buildRelationTypeMappingRulesFromDetail(
  detail: {
    backingDataSourceId?: string;
    backingDataSourceName?: string;
    dataViewMappings: RelationTypeDataViewRowMapping[];
    mappingMode: "direct" | "data-view";
    propertyMappings: RelationTypePropertyMapping[];
    sourceObjectTypeId: string;
    targetObjectTypeId: string;
  },
): RelationTypeMappingConfig {
  return {
    backingDataSourceId: detail.backingDataSourceId ?? "",
    backingDataSourceName: detail.backingDataSourceName,
    dataViewMappings:
      detail.dataViewMappings.length > 0
        ? detail.dataViewMappings.map((item) => ({ ...item }))
        : [createEmptyDataViewMapping()],
    propertyMappings:
      detail.propertyMappings.length > 0
        ? detail.propertyMappings.map((item) => ({ ...item }))
        : [createEmptyPropertyMapping()],
    sourceObjectTypeId: detail.sourceObjectTypeId,
    targetObjectTypeId: detail.targetObjectTypeId,
  };
}
