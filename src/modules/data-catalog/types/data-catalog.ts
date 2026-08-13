/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ResourceCategory = "dataset" | "logicview" | "table";

/** Field-level indexing capabilities: keyword, fulltext, and vector (aligned with Vega feature_type). */
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
  /** Business field name (backend display_name). */
  displayName?: string;
  /** Field description (backend description). */
  description?: string;
  extensions?: Record<string, string>;
  /** Field-level index features, such as full text and vectors. */
  features?: ResourceFieldFeature[];
  name: string;
  originalDescription?: string;
  originalName?: string;
  originalType?: string;
  raw?: Record<string, unknown>;
  type: string;
};

/** Resource-level defaults and cross-field build strategy, excluding per-field index participation. */
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
  /** Current index configuration. List endpoints may omit it; use the detail response on configuration pages. */
  indexConfig?: ResourceIndexConfig;
  name: string;
  rowCount: number;
  /** Schema in the physical data source; named distinctly from the field-definition schema. */
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
  | "cancelled"
  | "failed"
  | "listening"
  | "paused"
  | "pending"
  | "running"
  | "stopping"
  | "succeeded";

/** Per-index health state from backend index_health: ok, partial failure, failure, or building. */
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
  /** Catalog containing the backend task record. Legacy mock data may omit it and derive it from the resource. */
  catalogId?: string;
  /** Catalog display field returned with task lists to avoid loading all catalogs again. */
  catalogName?: string;
  /** Creator information; backend list and detail endpoints both populate the name. */
  creator?: BuildTaskCreator;
  createTime: number;
  embeddingFields: string[];
  /** Execution type selected when creating a batch task; not applicable to streaming. */
  executeType?: BuildTaskExecuteType;
  /** Model and dimensions actually used for each vector field in the task snapshot. */
  embeddingConfigs?: Record<string, EmbeddingFieldConfig>;
  embeddingModel: string;
  /** Completed with incomplete vectorization (vectorized < synced), so the index is unavailable or partially usable. */
  embeddingDegraded: boolean;
  fulltextAnalyzer: string;
  /** Analyzer ultimately used for each full-text field in the task snapshot. */
  fulltextAnalyzers?: Record<string, string>;
  fulltextFields: string[];
  error: string | null;
  /** Backend failure_detail containing the detailed reason for vectorization failure, shown in a tooltip. */
  failureDetail: string;
  /** Completion time derived from update_time for terminal tasks. */
  finishTime: number | null;
  id: string;
  /** Actual backend index health (index_health). Legacy mock data may omit it, so components fall back to embeddingDegraded. */
  indexHealth?: IndexHealth;
  /** Whether the index is usable; false when embeddingDegraded. */
  indexUsable: boolean;
  lastEventAt: number | null;
  mode: BuildMode;
  modelDimensions: number;
  resourceId: string;
  /** Resource name returned with task lists to avoid loading all resources again. */
  resourceName?: string;
  status: BuildTaskStatus;
  syncedCount: number;
  /** Synchronization checkpoint used to resume unfinished tasks. */
  syncedMark?: string;
  totalCount: number;
  /** Backend last-update time as a millisecond timestamp. */
  updateTime?: number;
  vectorizedCount: number;
};

export type BuildTaskListQuery = {
  catalogId?: string;
  resourceId?: string;
  silent?: boolean;
  statuses?: BuildTaskStatus[];
};

/** Server-side sort dimension for the build-task list API. */
export type BuildTaskSort = "create_time" | "update_time";

export type BuildTaskPageQuery = {
  catalogId?: string;
  mode?: BuildMode;
  direction?: "asc" | "desc";
  page: number;
  pageSize: number;
  resourceId?: string;
  sort?: BuildTaskSort;
  statuses?: BuildTaskStatus[];
};

export type BuildTaskPageResult = {
  items: BuildTask[];
  total: number;
};

/** Creates a task. Index configuration belongs to the resource, so this only starts the build. */
export type BuildTaskCreateInput = {
  /** Batch only; defaults to full. Do not send unsupported values for streaming. */
  executeType?: BuildTaskExecuteType;
  mode: BuildMode;
  resourceId: string;
};

export type FulltextAnalyzer = "hanlp_index" | "ik_max_word" | "standard";

/**
 * @deprecated Index configuration now uses resource updates; do not PUT task configuration.
 * This type remains only for transition-period UI construction of resource write payloads.
 */
export type BuildTaskUpdateInput = {
  buildKeyFields: string[];
  embeddingFields: string[];
  embeddingModel: string;
  fulltextAnalyzer?: string;
  fulltextFields: string[];
  modelDimensions: number;
};

/** Start or rerun: reset=true reruns only full tasks from scratch, ignoring the checkpoint. */
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
