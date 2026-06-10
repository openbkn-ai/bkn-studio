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

export type KnowledgeNetworkPreviewNode = {
  color: string;
  icon?: string;
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

export type KnowledgeNetworkImportMode = "ignore" | "overwrite";
