export type KnowledgeNetworkObjectTypeRecord = {
  color: string;
  conceptGroupIds: string[];
  conceptGroupNames: string[];
  description: string;
  hasIndex: boolean;
  icon?: string;
  id: string;
  name: string;
  tags: string[];
  updateTime: string;
  updaterName: string;
};

export type ObjectTypeIndexConfig = {
  fulltextConfig: {
    analyzer: string;
    enabled: boolean;
  };
  keywordConfig: {
    enabled: boolean;
    ignoreAboveLen: number;
  };
  vectorConfig: {
    enabled: boolean;
    modelId: string;
  };
};

export type ObjectTypeMappedField = {
  displayName: string;
  name: string;
  type: string;
};

export type ObjectTypeDataSource = {
  dataSourceId?: string;
  id: string;
  name: string;
};

export type ObjectTypeResourceGroup = {
  id: string;
  name: string;
  parentId?: string;
  selectable?: boolean;
  type: string;
};

export type ObjectTypeResourceListQuery = {
  dataSourceId?: string;
  name?: string;
  page?: number;
  pageSize?: number;
};

export type ObjectTypeResourceListResult = {
  items: ObjectTypeDataSource[];
  total: number;
};

export type ObjectTypeResourcePreview = {
  columns: Array<{
    dataIndex: string;
    title: string;
  }>;
  name: string;
  rows: Array<Record<string, string | number>>;
};

export type ObjectTypeResourceField = {
  comment?: string;
  displayName: string;
  name: string;
  type: string;
};

export type ObjectTypeDataProperty = {
  comment?: string;
  displayKey: boolean;
  displayName: string;
  incrementalKey: boolean;
  indexConfig?: ObjectTypeIndexConfig;
  mappedField?: ObjectTypeMappedField;
  name: string;
  primaryKey: boolean;
  type: string;
};

export type ObjectTypeLogicAttributeType = "metric" | "operator";

export type ObjectTypeLogicParameterValueFrom = "property" | "input" | "const";

export type ObjectTypeLogicParameter = {
  children?: ObjectTypeLogicParameter[];
  description?: string;
  id: string;
  ifSystemGenerate?: boolean;
  name: string;
  operation?: string;
  source?: string;
  type?: string;
  value?: string | boolean | number;
  valueFrom: ObjectTypeLogicParameterValueFrom;
};

export type ObjectTypeLogicDataSource = {
  id: string;
  name?: string;
  type: ObjectTypeLogicAttributeType;
};

export type ObjectTypeLogicProperty = {
  comment?: string;
  dataSource?: ObjectTypeLogicDataSource | null;
  displayName: string;
  name: string;
  parameters?: ObjectTypeLogicParameter[] | null;
  type?: string;
};

export type ObjectTypeLogicOperatorRecord = {
  apiSpec?: unknown;
  id: string;
  inputParameters?: Array<{
    children?: ObjectTypeLogicOperatorRecord["inputParameters"];
    description?: string;
    key: string;
    name: string;
    source?: string;
    type?: string;
  }>;
  name: string;
};

export type ObjectTypeLogicMetricModelRecord = {
  analysisDimensions: Array<{
    displayName: string;
    name: string;
    type: string;
  }>;
  groupName: string;
  id: string;
  name: string;
};

export type ObjectTypeLogicMetricModelField = {
  displayName: string;
  name: string;
  type: string;
};

export type KnowledgeNetworkObjectTypeMutationPayload = {
  color: string;
  conceptGroupIds: string[];
  dataProperties?: ObjectTypeDataProperty[];
  dataSource?: ObjectTypeDataSource;
  description: string;
  icon?: string;
  id?: string;
  logicProperties?: ObjectTypeLogicProperty[];
  name: string;
  tags: string[];
};

export type ObjectTypeDetail = KnowledgeNetworkObjectTypeRecord & {
  dataProperties: ObjectTypeDataProperty[];
  dataSource?: ObjectTypeDataSource;
  displayKey: string;
  incrementalKey: string;
  logicProperties: ObjectTypeLogicProperty[];
  primaryKeys: string[];
};

export type ObjectTypeSmallModel = {
  batchSize: number;
  embeddingDim: number;
  label: string;
  maxTokens: number;
  value: string;
};
