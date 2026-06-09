import type {
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeRecord,
  ConceptGroupDetail,
  ConceptGroupRecord,
  ConceptGroupRelatedItem,
  ConceptGroupRelatedResourceRef,
  KnowledgeNetworkObjectTypeMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
  KnowledgeNetworkRelationTypeRecord,
  KnowledgeNetworkTaskChildRecord,
  KnowledgeNetworkTaskRecord,
  ObjectTypeDataProperty,
  ObjectTypeDetail,
  ObjectTypeIndexConfig,
  ObjectTypeLogicParameter,
  ObjectTypeLogicParameterValueFrom,
  ObjectTypeLogicProperty,
  ObjectTypeSmallModel,
  RelationTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendActionType,
  BackendConceptGroup,
  BackendDataProperty,
  BackendIndexConfig,
  BackendKnowledgeNetwork,
  BackendLogicParameter,
  BackendLogicProperty,
  BackendObjectType,
  BackendObjectTypeMutation,
  BackendRelationType,
  BackendSmallModel,
  BackendTask,
  BackendTaskChild,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";
import { mapRelationTypeMappingsFromBackend } from "./relation-type.mapper";

export function mapKnowledgeNetwork(item: BackendKnowledgeNetwork): KnowledgeNetworkRecord {
  return {
    id: item.id,
    identifier: item.display_id ?? item.code ?? item.id,
    name: item.name,
    description: item.comment ?? item.description ?? "",
    color: item.color?.trim() || "#1677ff",
    icon: item.icon,
    tags: item.tags ?? [],
    createTime: formatTimestamp(item.create_time),
    updateTime: formatTimestamp(item.update_time),
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
    statistics: {
      objectTypesTotal: item.statistics?.object_types_total ?? 0,
      relationTypesTotal: item.statistics?.relation_types_total ?? 0,
      actionTypesTotal: item.statistics?.action_types_total ?? 0,
      conceptGroupsTotal: item.statistics?.concept_groups_total ?? 0,
      metricsTotal: item.statistics?.metrics_total ?? 0,
    },
  };
}

export function mapRecentObject(item: BackendObjectType): KnowledgeNetworkRecentObject {
  return {
    id: item.id,
    name: item.name,
    comment: item.comment ?? "",
    color: item.color ?? "#1677ff",
    icon: item.icon,
    tags: item.tags ?? [],
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

export function mapObjectType(item: BackendObjectType): KnowledgeNetworkObjectTypeRecord {
  const hasIndexFromProperties = (item.data_properties ?? []).some((property) => {
    const indexConfig = property.index_config;

    return Boolean(
      indexConfig?.keyword_config?.enabled ||
        indexConfig?.fulltext_config?.enabled ||
        indexConfig?.vector_config?.enabled,
    );
  });

  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color?.trim() || "#1677ff",
    icon: item.icon,
    tags: item.tags ?? [],
    conceptGroupIds: (item.concept_groups ?? []).map((group) => group.id),
    conceptGroupNames: (item.concept_groups ?? []).map(
      (group) => group.name ?? group.id,
    ),
    hasIndex: item.has_index ?? (hasIndexFromProperties || item.status?.index_available || false),
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

export function mapIndexConfig(config?: BackendIndexConfig): ObjectTypeIndexConfig {
  return {
    keywordConfig: {
      enabled: config?.keyword_config?.enabled ?? false,
      ignoreAboveLen: config?.keyword_config?.ignore_above_len ?? 1024,
    },
    fulltextConfig: {
      analyzer: config?.fulltext_config?.analyzer ?? "",
      enabled: config?.fulltext_config?.enabled ?? false,
    },
    vectorConfig: {
      enabled: config?.vector_config?.enabled ?? false,
      modelId: config?.vector_config?.model_id ?? "",
    },
  };
}

export function mapDataProperty(
  item: BackendDataProperty,
  meta: {
    displayKey: string;
    incrementalKey: string;
    primaryKeys: string[];
  },
): ObjectTypeDataProperty {
  return {
    comment: item.comment,
    displayKey: item.name === meta.displayKey,
    displayName: item.display_name ?? item.name,
    incrementalKey: item.name === meta.incrementalKey,
    indexConfig: item.index_config ? mapIndexConfig(item.index_config) : undefined,
    mappedField: item.mapped_field
      ? {
          displayName: item.mapped_field.display_name ?? item.mapped_field.name,
          name: item.mapped_field.name,
          type: item.mapped_field.type ?? "string",
        }
      : undefined,
    name: item.name,
    primaryKey: meta.primaryKeys.includes(item.name),
    type: item.type ?? "string",
  };
}

export function mapLogicProperty(item: BackendLogicProperty): ObjectTypeLogicProperty {
  return {
    comment: item.comment,
    dataSource: item.data_source
      ? {
          id: item.data_source.id,
          name: item.data_source.name,
          type: item.data_source.type as "metric" | "operator",
        }
      : null,
    displayName: item.display_name ?? item.name,
    name: item.name,
    parameters:
      item.parameters?.map((parameter) => ({
        description: parameter.description,
        id: parameter.id ?? parameter.name,
        ifSystemGenerate: parameter.if_system_generate,
        name: parameter.name,
        operation: parameter.operation,
        source: parameter.source,
        type: parameter.type,
        value: parameter.value,
        valueFrom: (parameter.value_from ?? "property") as ObjectTypeLogicParameterValueFrom,
      })) ?? null,
    type: item.type,
  };
}

export function mapObjectTypeDetail(item: BackendObjectType): ObjectTypeDetail {
  const primaryKeys = item.primary_keys ?? [];
  const displayKey = item.display_key ?? "";
  const incrementalKey = item.incremental_key ?? "";

  return {
    ...mapObjectType(item),
    dataProperties: (item.data_properties ?? []).map((property) =>
      mapDataProperty(property, { displayKey, incrementalKey, primaryKeys }),
    ),
    dataSource: item.data_source
      ? {
          id: item.data_source.id,
          name: item.data_source.name ?? "",
        }
      : undefined,
    displayKey,
    incrementalKey,
    logicProperties: (item.logic_properties ?? []).map(mapLogicProperty),
    primaryKeys,
  };
}

export function toBackendIndexConfig(config: ObjectTypeIndexConfig): BackendIndexConfig {
  return {
    keyword_config: {
      enabled: config.keywordConfig.enabled,
      ignore_above_len: config.keywordConfig.ignoreAboveLen,
    },
    fulltext_config: {
      analyzer: config.fulltextConfig.analyzer,
      enabled: config.fulltextConfig.enabled,
    },
    vector_config: {
      enabled: config.vectorConfig.enabled,
      model_id: config.vectorConfig.modelId,
    },
  };
}

export function toBackendDataProperty(property: ObjectTypeDataProperty): BackendDataProperty {
  return {
    comment: property.comment,
    display_name: property.displayName,
    index_config: property.indexConfig
      ? toBackendIndexConfig(property.indexConfig)
      : undefined,
    mapped_field: property.mappedField
      ? {
          display_name: property.mappedField.displayName,
          name: property.mappedField.name,
          type: property.mappedField.type,
        }
      : undefined,
    name: property.name,
    original_name: property.name,
    type: property.type,
  };
}

export function toBackendLogicParameter(parameter: ObjectTypeLogicParameter): BackendLogicParameter {
  return {
    description: parameter.description,
    id: parameter.id,
    if_system_generate: parameter.ifSystemGenerate,
    name: parameter.name,
    operation: parameter.operation,
    source: parameter.source,
    type: parameter.type,
    value: parameter.value,
    value_from: parameter.valueFrom,
  };
}

export function toBackendLogicProperty(property: ObjectTypeLogicProperty): BackendLogicProperty {
  return {
    comment: property.comment,
    data_source: property.dataSource
      ? {
          id: property.dataSource.id,
          name: property.dataSource.name,
          type: property.dataSource.type,
        }
      : null,
    display_name: property.displayName,
    name: property.name,
    parameters: property.parameters?.map(toBackendLogicParameter) ?? null,
    type: property.type,
  };
}

export function buildBackendObjectTypePayload(
  input: KnowledgeNetworkObjectTypeMutationPayload,
  conceptGroups: Array<{ id: string; name: string }>,
  objectTypeId?: string,
): BackendObjectTypeMutation {
  const dataProperties = input.dataProperties ?? [];

  return {
    branch: "main",
    color: input.color,
    comment: input.description,
    concept_groups: conceptGroups.map((group) => ({
      id: group.id,
      name: group.name,
    })),
    data_properties: dataProperties.map(toBackendDataProperty),
    data_source: input.dataSource
      ? {
          type: "data_view",
          id: input.dataSource.id,
          name: input.dataSource.name,
        }
      : undefined,
    display_key: dataProperties.find((item) => item.displayKey)?.name ?? "",
    icon: input.icon,
    id: objectTypeId ?? input.id,
    incremental_key: dataProperties.find((item) => item.incrementalKey)?.name ?? "",
    logic_properties: (input.logicProperties ?? []).map(toBackendLogicProperty),
    name: input.name,
    primary_keys: dataProperties.filter((item) => item.primaryKey).map((item) => item.name),
    tags: input.tags,
  };
}

export function mapSmallModel(item: BackendSmallModel): ObjectTypeSmallModel {
  return {
    batchSize: item.batch_size ?? 0,
    embeddingDim: item.embedding_dim ?? 0,
    label: item.model_name ?? item.model_id,
    maxTokens: item.max_tokens ?? 0,
    value: item.model_id,
  };
}

export function mapConceptGroup(item: BackendConceptGroup): ConceptGroupRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color,
    tags: item.tags ?? [],
    objectTypesTotal: item.statistics?.object_types_total ?? 0,
    relationTypesTotal: item.statistics?.relation_types_total ?? 0,
    actionTypesTotal: item.statistics?.action_types_total ?? 0,
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater_name,
  };
}

export function mapConceptGroupRelatedItem(item: BackendObjectType): ConceptGroupRelatedItem {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color,
    icon: item.icon,
    tags: item.tags ?? [],
  };
}

function mapConceptGroupResourceRef(
  value?: {
    color?: string;
    icon?: string;
    id?: string;
    name?: string;
  },
): ConceptGroupRelatedResourceRef | undefined {
  if (!value?.id || !value.name) {
    return undefined;
  }

  return {
    color: value.color,
    icon: value.icon,
    id: value.id,
    name: value.name,
  };
}

function mapConceptGroupRelationItem(
  item: BackendObjectType & {
    source_object_type?: {
      color?: string;
      icon?: string;
      id?: string;
      name?: string;
    };
    target_object_type?: {
      color?: string;
      icon?: string;
      id?: string;
      name?: string;
    };
  },
): ConceptGroupRelatedItem {
  return {
    ...mapConceptGroupRelatedItem(item),
    sourceObjectType: mapConceptGroupResourceRef(item.source_object_type),
    targetObjectType: mapConceptGroupResourceRef(item.target_object_type),
  };
}

function mapConceptGroupActionItem(
  item: BackendObjectType & {
    action_type?: string;
    object_type?: {
      color?: string;
      icon?: string;
      id?: string;
      name?: string;
    };
  },
): ConceptGroupRelatedItem {
  const actionKind = item.action_type as KnowledgeNetworkActionTypeKind | undefined;

  return {
    ...mapConceptGroupRelatedItem(item),
    actionKind,
    boundObjectType: mapConceptGroupResourceRef(item.object_type),
  };
}

export function mapConceptGroupDetail(item: BackendConceptGroup): ConceptGroupDetail {
  return {
    ...mapConceptGroup(item),
    objectTypes: (item.object_types ?? []).map(mapConceptGroupRelatedItem),
    relationTypes: (item.relation_types ?? []).map(mapConceptGroupRelationItem),
    actionTypes: (item.action_types ?? []).map(mapConceptGroupActionItem),
  };
}

export function mapRelationType(item: BackendRelationType): KnowledgeNetworkRelationTypeRecord {
  const mappingMode =
    item.mapping_mode === "data_view" || item.type === "data_view" ? "data-view" : "direct";

  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color?.trim() || "#7c3aed",
    mappingMode,
    sourceObjectTypeId:
      item.source_object_type_id ?? item.source_object_type?.id ?? "",
    sourceObjectTypeName:
      item.source_object_type?.name ??
      item.source_object_type_id ??
      "-",
    targetObjectTypeId:
      item.target_object_type_id ?? item.target_object_type?.id ?? "",
    targetObjectTypeName:
      item.target_object_type?.name ??
      item.target_object_type_id ??
      "-",
    tags: item.tags ?? [],
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

export function mapRelationTypeDetail(item: BackendRelationType): RelationTypeDetail {
  const record = mapRelationType(item);
  const mappings = mapRelationTypeMappingsFromBackend(item.mapping_rules, record.mappingMode);

  return {
    ...record,
    backingDataSourceId: mappings.backingDataSourceId,
    backingDataSourceName: mappings.backingDataSourceName,
    dataViewMappings: mappings.dataViewMappings,
    propertyMappings: mappings.propertyMappings,
  };
}

export function mapActionKind(
  value?: BackendActionType["action_type"],
): KnowledgeNetworkActionTypeKind {
  switch (value) {
    case "UPDATE":
      return "update";
    case "DELETE":
      return "delete";
    case "NOTIFY":
      return "notify";
    case "ADD":
    default:
      return "create";
  }
}

export function mapActionType(item: BackendActionType): KnowledgeNetworkActionTypeRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color?.trim() || "#16a34a",
    actionKind: mapActionKind(item.action_type),
    objectTypeId: item.object_type_id ?? item.object_type?.id ?? "",
    objectTypeName: item.object_type?.name ?? item.object_type_id ?? "-",
    tags: item.tags ?? [],
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}


export { mapMetric, toBackendMetricEntry } from "./metric.mapper";

export function mapTaskChild(item: BackendTaskChild): KnowledgeNetworkTaskChildRecord {
  const durationMs = item.time_cost ?? 0;
  return {
    id: item.id,
    conceptName: item.concept_name ?? item.concept_id ?? "--",
    conceptType: item.concept_type ?? "object_type",
    state: item.state ?? "pending",
    stateDetail: item.state_detail,
    duration:
      durationMs > 0 ? `${Math.max(Math.round(durationMs / 60000), 1)}m` : "--",
  };
}

export function mapTask(item: BackendTask): KnowledgeNetworkTaskRecord {
  const start = item.start_time ? formatTimestamp(item.start_time) : "--";
  const finish = item.finish_time ? formatTimestamp(item.finish_time) : "--";
  const durationMs =
    item.start_time && item.finish_time
      ? Math.max(item.finish_time - item.start_time, 0)
      : 0;
  const duration =
    durationMs > 0
      ? `${Math.max(Math.round(durationMs / 60000), 1)}m`
      : "--";

  return {
    id: item.id,
    name: item.name ?? item.id,
    jobType: item.job_type ?? "full",
    state: item.state ?? "pending",
    stateDetail: item.state_detail,
    startTime: start,
    finishTime: finish,
    duration,
  };
}

export {
  mapRelationTypeMappingsFromBackend,
  mapRelationTypePropertyMappingsFromBackend,
  toBackendRelationTypeCreateEntry,
  toBackendRelationTypeUpdatePayload,
} from "./relation-type.mapper";
export {
  mapActionTypeDetail,
  toBackendActionTypeCreateEntry,
  toBackendActionTypeUpdatePayload,
} from "./action-type.mapper";
export {
  buildActionExecutionLogQueryParams,
  mapActionTypeExecutionLogDetail,
  mapActionTypeExecutionLogList,
} from "./action-execution.mapper";
