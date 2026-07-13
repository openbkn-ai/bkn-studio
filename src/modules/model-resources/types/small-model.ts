/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type SmallModelType = "embedding" | "reranker" | (string & {});

export type SmallModelConfig = {
  apiModel: string;
  apiUrl: string;
  apiKey?: string;
};

export type SmallModel = {
  modelId: string;
  modelName: string;
  modelType: SmallModelType;
  adapter?: boolean;
  adapterCode?: string;
  embeddingDim?: number;
  batchSize?: number;
  maxTokens?: number;
  maxDocuments?: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
  modelConfig?: SmallModelConfig;
  operations?: string[];
  /** Whether this model is the system default for its model_type (embedding/reranker). */
  default?: boolean;
};

export type SmallModelListQuery = {
  page: number;
  size: number;
  order?: string;
  rule?: string;
  name?: string;
  modelType?: string;
};

export type SmallModelListResult = {
  items: SmallModel[];
  total: number;
};

export type SmallModelSavePayload = {
  modelId?: string;
  modelName: string;
  modelType: SmallModelType;
  adapter?: boolean;
  adapterCode?: string;
  embeddingDim?: number;
  batchSize?: number;
  maxTokens?: number;
  maxDocuments?: number;
  modelConfig?: SmallModelConfig;
  change?: boolean;
};
