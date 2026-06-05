export type KnowledgeNetworkListQuery = {
  direction?: "asc" | "desc";
  keyword: string;
  page: number;
  pageSize: number;
  sortBy?: "name" | "updateTime";
  tag?: string;
};

export type KnowledgeNetworkStatistics = {
  actionTypesTotal: number;
  conceptGroupsTotal: number;
  metricsTotal: number;
  objectTypesTotal: number;
  relationTypesTotal: number;
};

export type KnowledgeNetworkRecord = {
  color: string;
  createTime: string;
  creatorName: string;
  description: string;
  icon?: string;
  id: string;
  identifier: string;
  name: string;
  statistics: KnowledgeNetworkStatistics;
  tags: string[];
  updateTime: string;
  updaterName: string;
};

export type KnowledgeNetworkListResult = {
  items: KnowledgeNetworkRecord[];
  total: number;
};

export type KnowledgeNetworkMutationPayload = {
  color: string;
  description: string;
  identifier: string;
  name: string;
  tags: string[];
};

export type KnowledgeNetworkRecentObject = {
  color: string;
  comment: string;
  icon?: string;
  id: string;
  name: string;
  tags: string[];
  updateTime: string;
  updaterName: string;
};

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

export type KnowledgeNetworkObjectTypeMutationPayload = {
  color: string;
  conceptGroupIds: string[];
  description: string;
  icon?: string;
  name: string;
  tags: string[];
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

export type KnowledgeNetworkRelationTypeMutationPayload = {
  color: string;
  description: string;
  mappingMode: "direct" | "data-view";
  name: string;
  sourceObjectTypeId: string;
  tags: string[];
  targetObjectTypeId: string;
};

export type KnowledgeNetworkActionTypeKind =
  | "create"
  | "update"
  | "delete"
  | "notify";

export type KnowledgeNetworkActionTypeRecord = {
  actionKind: KnowledgeNetworkActionTypeKind;
  color: string;
  description: string;
  id: string;
  name: string;
  objectTypeId: string;
  objectTypeName: string;
  tags: string[];
  updateTime: string;
  updaterName: string;
};

export type KnowledgeNetworkActionTypeMutationPayload = {
  actionKind: KnowledgeNetworkActionTypeKind;
  color: string;
  description: string;
  name: string;
  objectTypeId: string;
  tags: string[];
};

export type KnowledgeNetworkPreviewNode = {
  color: string;
  id: string;
  name: string;
};

export type KnowledgeNetworkPreviewEdge = {
  id: string;
  name: string;
  sourceId: string;
  targetId: string;
};

export type KnowledgeNetworkPreviewGraph = {
  edges: KnowledgeNetworkPreviewEdge[];
  nodes: KnowledgeNetworkPreviewNode[];
};

export type ConceptGroupRecord = {
  actionTypesTotal: number;
  color?: string;
  description: string;
  id: string;
  name: string;
  objectTypesTotal: number;
  relationTypesTotal: number;
  tags?: string[];
  updateTime: string;
};

export type ConceptGroupRelatedItem = {
  color?: string;
  description: string;
  icon?: string;
  id: string;
  name: string;
  tags: string[];
};

export type ConceptGroupDetail = ConceptGroupRecord & {
  actionTypes: ConceptGroupRelatedItem[];
  objectTypes: ConceptGroupRelatedItem[];
  relationTypes: ConceptGroupRelatedItem[];
};

export type ConceptGroupMutationPayload = {
  color: string;
  description: string;
  name: string;
  tags: string[];
};
