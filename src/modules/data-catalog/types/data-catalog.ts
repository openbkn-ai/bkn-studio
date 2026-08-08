/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ResourceCategory = "dataset" | "logicview" | "table";

/** 字段级索引能力：keyword / fulltext / vector（对齐 Vega feature_type）。 */
export type ResourceFeatureType = "keyword" | "fulltext" | "vector";

export type ResourceFieldFeature = {
  config?: Record<string, unknown>;
  description?: string;
  displayName?: string;
  featureType: ResourceFeatureType;
  isDefault?: boolean;
  isNative?: boolean;
  name?: string;
  refProperty?: string;
};

export type ResourceSchemaField = {
  attributes?: Record<string, unknown> | null;
  /** 业务字段名（后端 display_name） */
  displayName?: string;
  /** 字段说明（后端 description） */
  description?: string;
  extensions?: Record<string, string>;
  /** 字段级索引 features（全文 / 向量等） */
  features?: ResourceFieldFeature[];
  name: string;
  originalDescription?: string;
  originalName?: string;
  originalType?: string;
  raw?: Record<string, unknown>;
  type: string;
};

/** Resource 级默认值与跨字段构建策略（不含字段是否参与索引）。 */
export type ResourceIndexConfig = {
  buildKeyFields?: string[];
  defaultEmbeddingModel?: string;
  defaultFulltextAnalyzer?: string;
};

export type CatalogResource = {
  catalogId: string;
  category: ResourceCategory;
  columnCount: number;
  description: string;
  id: string;
  /** 当前索引配置；列表接口可能缺省，配置页以详情为准 */
  indexConfig?: ResourceIndexConfig;
  name: string;
  rowCount: number;
  /** 物理数据源中的 schema；与字段定义 schema 区分命名。 */
  schemaName?: string;
  schema: ResourceSchemaField[];
  sourceIdentifier: string;
  updateTime: string;
  updatedAt: number;
};

export type ResourceListQuery = {
  catalogId?: string;
  category?: ResourceCategory;
  keyword?: string;
  limit?: number;
  offset?: number;
  schema?: string;
};

export type ResourceCreateInput = {
  catalogId: string;
  category: ResourceCategory;
  description: string;
  indexConfig?: ResourceIndexConfig;
  name: string;
  schema: ResourceSchemaField[];
  sourceIdentifier: string;
};

export type ResourceUpdateInput = ResourceCreateInput;

export type ResourcePreviewQuery = {
  limit: number;
  offset: number;
};

export type ResourcePreviewResult = {
  rows: Record<string, unknown>[];
  total: number;
};

export type BuildMode = "batch" | "streaming";
export type BuildTaskExecuteType = "full" | "incremental";

export type BuildTaskStatus =
  | "failed"
  | "listening"
  | "paused"
  | "pending"
  | "running"
  | "succeeded";

/** 后端 index_health 的单项健康态:ok / 部分失败 / 失败 / 构建中。 */
export type IndexHealthState = "ok" | "partial" | "failed" | "building";

export type IndexHealth = {
  embedding: IndexHealthState;
  fulltext: IndexHealthState;
  usable: boolean;
};

export type BuildTaskCreator = {
  id: string;
  name?: string;
  type: string;
};

export type EmbeddingFieldConfig = {
  dimensions: number;
  modelId: string;
};

export type BuildTask = {
  buildKeyFields: string[];
  /** 后端任务记录所属 Catalog；mock 旧数据可缺省并由数据资源回填。 */
  catalogId?: string;
  /** 任务列表关联返回的 catalog 展示字段，避免列表页再全量加载 catalog。 */
  catalogName?: string;
  /** 创建人信息；后端列表与详情接口均会补齐名称。 */
  creator?: BuildTaskCreator;
  createTime: string;
  createdAt: number;
  embeddingFields: string[];
  /** batch 任务创建时选择的执行类型；streaming 不适用。 */
  executeType?: BuildTaskExecuteType;
  /** 任务快照中每个向量字段实际使用的模型与维度。 */
  embeddingConfigs?: Record<string, EmbeddingFieldConfig>;
  embeddingModel: string;
  /** completed 但向量化没建满（vectorized < synced），索引不可用/部分可用。 */
  embeddingDegraded: boolean;
  fulltextAnalyzer: string;
  /** 任务快照中每个全文字段最终使用的 analyzer。 */
  fulltextAnalyzers?: Record<string, string>;
  fulltextFields: string[];
  error: string | null;
  /** 后端 failure_detail：向量化失败的详细原因，tooltip 展开用。 */
  failureDetail: string;
  finishTime: string | null;
  id: string;
  /** 后端真实索引健康态(index_health);mock 旧数据可能缺,组件按 embeddingDegraded 兜底。 */
  indexHealth?: IndexHealth;
  /** 索引是否可用（embeddingDegraded 时为 false）。 */
  indexUsable: boolean;
  lastEventAt: number | null;
  mode: BuildMode;
  modelDimensions: number;
  resourceId: string;
  /** 任务列表关联返回的资源名称，避免列表页再全量加载 resources。 */
  resourceName?: string;
  status: BuildTaskStatus;
  syncedCount: number;
  /** 已同步断点；用于未完成任务的续跑。 */
  syncedMark?: string;
  totalCount: number;
  /** 后端最后更新时间，毫秒时间戳及其展示值。 */
  updatedAt?: number;
  updateTime?: string | null;
  vectorizedCount: number;
};

export type BuildTaskListQuery = {
  catalogId?: string;
  resourceId?: string;
  silent?: boolean;
  statuses?: BuildTaskStatus[];
};

/** 服务端排序维度；缺省按创建时间倒序。 */
export type BuildTaskOrderBy = "created_at" | "updated_at";

export type BuildTaskPageQuery = {
  /** 只看构建中:传 active=true,且不再传 status。 */
  active?: boolean;
  catalogId?: string;
  mode?: BuildMode;
  order?: "asc" | "desc";
  orderBy?: BuildTaskOrderBy;
  page: number;
  pageSize: number;
  resourceId?: string;
  statuses?: BuildTaskStatus[];
};

export type BuildTaskPageResult = {
  items: BuildTask[];
  total: number;
};

/** 创建任务：索引配置已归属 resource，此处只触发构建。 */
export type BuildTaskCreateInput = {
  /** batch only；默认 full。streaming 勿传 unsupported 值。 */
  executeType?: BuildTaskExecuteType;
  mode: BuildMode;
  resourceId: string;
};

export type FulltextAnalyzer = "hanlp_index" | "ik_max_word" | "standard";

/**
 * @deprecated 索引配置改走 resource update；勿再 PUT task 配置。
 * 保留类型仅用于过渡期 UI 组装 resource 写入载荷。
 */
export type BuildTaskUpdateInput = {
  buildKeyFields: string[];
  embeddingFields: string[];
  embeddingModel: string;
  fulltextAnalyzer?: string;
  fulltextFields: string[];
  modelDimensions: number;
};

/** start / 重跑：reset=true 仅对 full 任务忽略游标全量重跑。 */
export type BuildTaskStartInput = {
  reset?: boolean;
};

export type CatalogDiscoverStatus = "failed" | "running" | "succeeded";

export type CatalogDiscoverRecord = {
  durationSec: number | null;
  foundResources: number | null;
  id: string;
  newResources: number | null;
  startTime: string;
  startedAt: number;
  status: CatalogDiscoverStatus;
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
