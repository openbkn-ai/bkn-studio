/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type CapabilityKind = "http" | "mcp" | "skill" | "function" | "all";

export type CapabilityGroup = {
  id: string;
  name: string;
  serviceUrl?: string;
  status?: string;
  toolCount?: number;
};

export type CapabilityEndpoint = {
  method?: string;
  path?: string;
};

export type CapabilityOrchestration = {
  enabled: boolean;
  operatorId?: string;
  operatorName?: string;
  audit?: CapabilityAudit;
};

export type CapabilityAudit = {
  createUser?: string;
  createUserName?: string;
  createTime?: number;
  updateUser?: string;
  updateUserName?: string;
  updateTime?: number;
  releaseUser?: string;
  releaseUserName?: string;
  releaseTime?: number;
};

export type FunctionParameterDef = {
  name: string;
  type?: string;
  description?: string;
};

export type CapabilityRecord = {
  id: string;
  kind: CapabilityKind;
  name: string;
  description?: string;
  status: "draft" | "published" | "offline" | string;
  group?: CapabilityGroup;
  endpoint?: CapabilityEndpoint;
  orchestration?: CapabilityOrchestration;
  audit?: CapabilityAudit;
  updateTime?: number;
  toolId?: string;
  boxId?: string;
  mcpId?: string;
  skillId?: string;
  version?: string;
  openapiSpec?: string;
  url?: string;
  code?: string;
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
};

export type CapabilityListResult = {
  items: CapabilityRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type VersionEntry = {
  version: string;
  status?: string;
  releaseUser?: string;
  releaseUserName?: string;
  releaseTime?: number;
  updateTime?: number;
};

export type CreateHttpCapabilityInput = {
  openapiSpec: string;
  serviceUrl: string;
  name?: string;
  description?: string;
  orchestrationEnabled?: boolean;
};

export type ImportOpenApiInput = {
  openapiSpec: string;
  serviceUrl: string;
  description?: string;
  orchestrationEnabled?: boolean;
};

export type DebugCapabilityInput = {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  path?: Record<string, unknown>;
  header?: Record<string, unknown>;
  toolName?: string;
};

export type DebugCapabilityResult = {
  statusCode?: number;
  body?: unknown;
  durationMs?: number;
  error?: string;
  content?: string;
  isError?: boolean;
};

export type OrchestrationDetail = {
  enabled: boolean;
  operatorId?: string;
  toolId?: string;
  boxId?: string;
  audit?: CapabilityAudit;
};

export type OrchestrationRuntimeConfig = {
  timeoutMs?: number;
  retryPolicy: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    retryStatusCodes?: number[];
    retryErrorCodes?: string[];
  };
};

export type UpdateHttpCapabilityInput = {
  name?: string;
  description?: string;
  openapiSpec?: string;
};

export type UpdateCapabilityInput = UpdateHttpCapabilityInput & {
  url?: string;
  mode?: "sse" | "stream";
  headers?: Record<string, string>;
  category?: string;
  code?: string;
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
};

export type CategoryEntry = {
  categoryType: string;
  name: string;
};

export type McpToolEntry = {
  name?: string;
  description?: string;
  [key: string]: unknown;
};

export type RegisterMcpCapabilityInput = {
  name: string;
  description?: string;
  mode?: "sse" | "stream";
  url: string;
  headers?: Record<string, string>;
  category?: string;
};

export type RegisterSkillCapabilityInput = {
  file?: File;
  content?: string;
  fileType?: "zip" | "content";
  category?: string;
};

export type CreateFunctionCapabilityInput = {
  name: string;
  description?: string;
  code: string;
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
};

export type ExecutePythonInput = {
  code: string;
  event?: Record<string, unknown>;
  timeout?: number;
};

export type ExecutePythonResult = {
  output?: unknown;
  stdout?: string;
  stderr?: string;
  error?: string;
  durationMs?: number;
};

export type SkillFileSummary = {
  relPath: string;
  fileType?: string;
  mimeType?: string;
  size?: number;
};

export type SkillContentResult = {
  content?: string;
  fileType?: string;
  files: SkillFileSummary[];
  downloadUrl?: string;
};

export type ParseMcpSseInput = {
  url: string;
  mode?: "sse" | "stream";
  headers?: Record<string, string>;
};

export type McpParsedTool = {
  name: string;
  description?: string;
};
