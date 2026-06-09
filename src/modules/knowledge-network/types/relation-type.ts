export type RelationTypePropertyMapping = {
  sourcePropertyName: string;
  targetPropertyName: string;
};

export type RelationTypeDataViewRowMapping = {
  dataViewSourcePropertyName: string;
  dataViewTargetPropertyName: string;
  sourceObjectPropertyName: string;
  targetObjectPropertyName: string;
};

export type RelationTypeMappingConfig = {
  backingDataSourceId: string;
  backingDataSourceName?: string;
  dataViewMappings: RelationTypeDataViewRowMapping[];
  propertyMappings: RelationTypePropertyMapping[];
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
};

export type RelationTypeDataViewMappingStore = {
  backingDataSourceId: string;
  backingDataSourceName?: string;
  dataViewMappings: RelationTypeDataViewRowMapping[];
};

export type KnowledgeNetworkRelationTypeRecord = {
  color: string;
  description: string;
  id: string;
  mappingMode: "direct" | "data-view";
  name: string;
  sourceObjectTypeId: string;
  sourceObjectTypeName: string;
  tags: string[];
  targetObjectTypeId: string;
  targetObjectTypeName: string;
  updateTime: string;
  updaterName: string;
};

export type RelationTypeDetail = KnowledgeNetworkRelationTypeRecord & {
  backingDataSourceId?: string;
  backingDataSourceName?: string;
  dataViewMappings: RelationTypeDataViewRowMapping[];
  propertyMappings: RelationTypePropertyMapping[];
};

export type KnowledgeNetworkRelationTypeMutationPayload = {
  color: string;
  description: string;
  id?: string;
  mappingMode: "direct" | "data-view";
  mappingRules?: RelationTypeMappingConfig;
  name: string;
  sourceObjectTypeId: string;
  tags: string[];
  targetObjectTypeId: string;
};
