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
  /** Embedding model locked at creation time (immutable). */
  embeddingModelId?: string;
  /** Embedding dimension of the locked model. */
  embeddingDim?: number;
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
  /**
   * Embedding model name or model_id chosen at creation (create only).
   * Empty = use the system default. Ignored on update (locked after create).
   */
  embeddingModel?: string;
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
