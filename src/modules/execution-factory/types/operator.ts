/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";

export type OperatorRetryPolicy = {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryStatusCodes?: number[];
  retryErrorCodes?: string[];
};

export type OperatorExecuteControl = {
  timeout?: number;
  retryPolicy?: OperatorRetryPolicy;
};

export type OperatorRunLogEntry = {
  id: string;
  timestamp: number;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  body?: unknown;
  requestBody?: Record<string, unknown>;
};

export type OperatorStatus = "unpublish" | "published" | "offline" | "editing";

export type PublicOperatorStatus = "unpublish" | "published" | "offline";

export type OperatorMetadataType = "openapi" | "function";

export type OperatorCategory =
  | "other_category"
  | "data_process"
  | "data_transform"
  | "data_store"
  | "data_analysis"
  | "data_query"
  | "data_extract"
  | "data_split"
  | "model_train";

export type OperatorRecord = {
  operatorId: string;
  name: string;
  version: string;
  status: OperatorStatus;
  description?: string;
  metadataType?: OperatorMetadataType;
  category?: OperatorCategory;
  categoryName?: string;
  createTime?: number;
  updateTime?: number;
  createUser?: string;
  updateUser?: string;
  releaseUser?: string;
  releaseTime?: number;
  isInternal?: boolean;
};

export type OperatorListQuery = {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: OperatorStatus;
  category?: OperatorCategory;
};

export type OperatorListResult = {
  items: OperatorRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type OperatorMutationInput = {
  name: string;
  description?: string;
  category?: OperatorCategory;
  metadataType?: OperatorMetadataType;
  openapiSpec?: string;
  functionInput?: FunctionInputPayload;
  executeControl?: OperatorExecuteControl;
  directPublish?: boolean;
};

export type OperatorDetail = OperatorRecord & {
  openapiSpec?: string;
  functionInput?: FunctionInputPayload;
  executeControl?: OperatorExecuteControl;
};

export type OperatorHistoryRecord = {
  operatorId: string;
  version: string;
  status?: OperatorStatus;
  releaseUser?: string;
  releaseTime?: number;
  updateTime?: number;
};

export type OperatorRegisterInput = OperatorMutationInput & {
  metadataType: OperatorMetadataType;
};

export type OperatorEditInput = OperatorMutationInput & {
  operatorId: string;
};

export type OperatorDebugInput = {
  operatorId: string;
  version: string;
  header?: Record<string, unknown>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  path?: Record<string, string>;
};

export type OperatorDebugResult = {
  statusCode?: number;
  body?: unknown;
  error?: string;
  durationMs?: number;
};
