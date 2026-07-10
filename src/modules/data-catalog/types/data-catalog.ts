/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ResourceCategory = "dataset" | "logicview" | "table";

export type ResourceSchemaField = {
  /** 业务字段名（后端 display_name） */
  displayName?: string;
  /** 字段说明（后端 description） */
  description?: string;
  name: string;
  type: string;
};

export type CatalogResource = {
  catalogId: string;
  category: ResourceCategory;
  columnCount: number;
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

export type BuildTask = {
  buildKeyFields: string[];
  createTime: string;
  createdAt: number;
  embeddingFields: string[];
  embeddingModel: string;
  /** completed 但向量化没建满（vectorized < synced），索引不可用/部分可用。 */
  embeddingDegraded: boolean;
  fulltextAnalyzer: string;
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
  status: BuildTaskStatus;
  syncedCount: number;
  totalCount: number;
  vectorizedCount: number;
};

export type BuildTaskListQuery = {
  catalogId?: string;
  resourceId?: string;
  silent?: boolean;
  statuses?: BuildTaskStatus[];
};

/** 服务端排序维度:default=后端默认(构建中置顶),不传 order_by。 */
export type BuildTaskOrderBy =
  | "default"
  | "status"
  | "created_at"
  | "updated_at"
  | "mode";

export type BuildTaskPageQuery = {
  /** 只看构建中:传 active=true,且不再传 status。 */
  active?: boolean;
  catalogId?: string;
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
