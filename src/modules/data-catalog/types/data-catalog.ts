export type ResourceCategory = "dataset" | "logicview" | "table";

export type ResourceSchemaField = {
  name: string;
  type: string;
};

export type CatalogResource = {
  catalogId: string;
  category: ResourceCategory;
  description: string;
  id: string;
  name: string;
  rowCount: number;
  schema: ResourceSchemaField[];
  sourceIdentifier: string;
  updateTime: string;
  updatedAt: number;
};

export type ResourceListQuery = {
  catalogId?: string;
  category?: ResourceCategory;
  keyword?: string;
};

export type ResourceCreateInput = {
  catalogId: string;
  category: ResourceCategory;
  description: string;
  name: string;
  schema: ResourceSchemaField[];
  sourceIdentifier: string;
};

export type ResourcePreviewQuery = {
  limit: number;
  offset: number;
};

export type ResourcePreviewResult = {
  rows: Record<string, unknown>[];
  total: number;
};

export type BuildMode = "batch" | "streaming";

export type BuildTaskStatus =
  | "failed"
  | "listening"
  | "paused"
  | "pending"
  | "running"
  | "succeeded";

export type BuildTask = {
  buildKeyFields: string[];
  createTime: string;
  createdAt: number;
  embeddingFields: string[];
  embeddingModel: string;
  fulltextAnalyzer: string;
  fulltextFields: string[];
  error: string | null;
  finishTime: string | null;
  id: string;
  lastEventAt: number | null;
  mode: BuildMode;
  modelDimensions: number;
  resourceId: string;
  status: BuildTaskStatus;
  syncedCount: number;
  totalCount: number;
  vectorizedCount: number;
};

export type BuildTaskListQuery = {
  resourceId?: string;
  statuses?: BuildTaskStatus[];
};

export type BuildTaskCreateInput = {
  buildKeyFields: string[];
  embeddingFields: string[];
  embeddingModel: string;
  fulltextAnalyzer?: string;
  fulltextFields: string[];
  mode: BuildMode;
  modelDimensions: number;
  resourceId: string;
};

export type FulltextAnalyzer = "hanlp_index" | "ik_max_word" | "standard";

export type BuildTaskUpdateInput = {
  buildKeyFields: string[];
  embeddingFields: string[];
  embeddingModel: string;
  fulltextAnalyzer?: string;
  fulltextFields: string[];
  modelDimensions: number;
};

export type CatalogScanStatus = "failed" | "running" | "succeeded";

export type CatalogScanRecord = {
  durationSec: number | null;
  foundResources: number | null;
  id: string;
  newResources: number | null;
  startTime: string;
  startedAt: number;
  status: CatalogScanStatus;
  trigger: "manual" | "scheduled";
};

export type IndexStateKey =
  | "building"
  | "built"
  | "failed"
  | "failed-stale"
  | "listening"
  | "none"
  | "paused"
  | "rebuilding";

export type IndexState = {
  effective: BuildTask | null;
  key: IndexStateKey;
  latest: BuildTask | null;
};

export type ResourceGate = {
  catalogName?: string;
  ok: boolean;
};

export type EmbeddingModelOption = {
  dimensions: number;
  id: string;
  name: string;
};
