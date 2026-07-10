/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";

export type ToolRunLogEntry = {
  id: string;
  timestamp: number;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  body?: unknown;
  requestBody?: Record<string, unknown>;
};

export type ToolIoParameter = {
  name: string;
  in?: string;
  required?: boolean;
  description?: string;
  type?: string;
};

export type ToolIoSpec = {
  parameters: ToolIoParameter[];
  requestBodyDescription?: string;
  requestBodyRequired?: boolean;
  requestBodyExample?: unknown;
  requestBodySchema?: unknown;
  responses?: Record<string, { description?: string; example?: unknown; schema?: unknown }>;
};

export type ToolGlobalParameter = {
  name: string;
  description: string;
  required?: boolean;
  in: "query" | "path" | "header" | "cookie" | "body";
  type: "string" | "integer" | "boolean" | "array" | "object";
  value?: unknown;
};

export type ToolStatus = "enabled" | "disabled";

export type ToolMetadataType = "openapi" | "function";

export type ToolRecord = {
  toolId: string;
  name: string;
  description?: string;
  status: ToolStatus;
  metadataType?: ToolMetadataType;
  useRule?: string;
  serverUrl?: string;
  path?: string;
  method?: string;
  metadataVersion?: string;
  createTime?: number;
  updateTime?: number;
  createUser?: string;
  updateUser?: string;
};

export type ToolListQuery = {
  all?: boolean;
  page: number;
  pageSize: number;
  keyword?: string;
  status?: ToolStatus;
};

export type ToolListResult = {
  boxId: string;
  items: ToolRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type ToolCreateInput = {
  metadataType: ToolMetadataType;
  openapiSpec?: string;
  functionInput?: FunctionInputPayload;
  globalParameters?: ToolGlobalParameter;
  useRule?: string;
};

export type ToolEditInput = {
  name: string;
  description?: string;
  useRule?: string;
  metadataType?: ToolMetadataType;
  openapiSpec?: string;
  functionInput?: FunctionInputPayload;
  globalParameters?: ToolGlobalParameter;
};

export type ToolDetail = ToolRecord & {
  apiSpec?: unknown;
  openapiSpec?: string;
  functionInput?: FunctionInputPayload;
  ioSpec?: ToolIoSpec;
  globalParameters?: ToolGlobalParameter;
};

export type ToolCreateResult = {
  successIds: string[];
  successCount: number;
  failureCount: number;
  failures: Array<{ toolName?: string; error?: string }>;
};

export type ToolDebugInput = {
  header?: Record<string, unknown>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

export type ToolDebugResult = {
  statusCode?: number;
  body?: unknown;
  error?: string;
  durationMs?: number;
};

export type ConvertOperatorToToolInput = {
  boxId: string;
  operatorId: string;
  operatorVersion: string;
};

export type ConvertOperatorToToolResult = {
  boxId: string;
  toolId: string;
};
