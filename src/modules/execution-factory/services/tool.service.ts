/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  ConvertOperatorToToolInput,
  ConvertOperatorToToolResult,
  ToolCreateInput,
  ToolCreateResult,
  ToolDebugInput,
  ToolDebugResult,
  ToolDetail,
  ToolEditInput,
  ToolListQuery,
  ToolListResult,
  ToolRecord,
  ToolStatus,
} from "@/modules/execution-factory/types/tool";
import {
  mapFunctionContent,
  normalizeGeneratedCapabilityName,
  parseOpenApiDataPayload,
  serializeOpenApiSpec,
} from "@/modules/execution-factory/utils/metadata-content";
import { normalizeTimestamp } from "@/modules/execution-factory/utils/format-timestamp";
import { extractOpenApiOperationsIo } from "@/modules/execution-factory/utils/openapi-operation-io";
import { parseToolIoSpec } from "@/modules/execution-factory/utils/tool-io";
import type { ToolGlobalParameter } from "@/modules/execution-factory/types/tool";

type BackendToolInfo = {
  create_time?: number;
  create_user?: string;
  description?: string;
  global_parameters?: {
    description?: string;
    in?: string;
    name?: string;
    required?: boolean;
    type?: string;
    value?: unknown;
  };
  metadata?: {
    api_spec?: unknown;
    function_content?: {
      code?: string;
      dependencies?: Array<{ name?: string; version?: string }>;
      script_type?: string;
    };
  };
  metadata_type?: string;
  name?: string;
  status?: string;
  tool_id: string;
  update_time?: number;
  update_user?: string;
  use_rule?: string;
};

type BackendToolListResponse = {
  box_id?: string;
  data?: {
    box_id?: string;
    page?: number;
    page_size?: number;
    tools?: BackendToolInfo[];
    total?: number;
  };
  page?: number;
  page_size?: number;
  tools?: BackendToolInfo[];
  total?: number;
};

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";
const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
]);

type MockOpenApiOperation = {
  description?: string;
  method: string;
  name: string;
  openapiSpec: string;
  path: string;
  serverUrl?: string;
};

const mockToolsByBox: Record<string, ToolDetail[]> = {
  tb_context_loader: [
    {
      toolId: "tool_search",
      name: "Search",
      description: "Search documents in context.",
      status: "enabled",
      metadataType: "openapi",
      updateTime: Date.now() - 86_400_000,
    },
    {
      toolId: "tool_rank",
      name: "Rank",
      description: "Rank search results.",
      status: "enabled",
      metadataType: "openapi",
      updateTime: Date.now() - 43_200_000,
    },
  ],
  tb_custom_ops: [
    {
      toolId: "tool_invoke",
      name: "Invoke",
      description: "Invoke custom HTTP operation.",
      status: "disabled",
      metadataType: "openapi",
      updateTime: Date.now() - 7_200_000,
    },
  ],
};

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

function mapTool(item: BackendToolInfo): ToolRecord {
  return {
    toolId: item.tool_id,
    name: item.name ?? item.tool_id,
    description: item.description,
    status: (item.status ?? "disabled") as ToolStatus,
    metadataType: item.metadata_type as ToolRecord["metadataType"],
    useRule: item.use_rule,
    serverUrl: typeof item.metadata === "object" && item.metadata && "server_url" in item.metadata
      ? String((item.metadata as { server_url?: string }).server_url ?? "")
      : undefined,
    path: typeof item.metadata === "object" && item.metadata && "path" in item.metadata
      ? String((item.metadata as { path?: string }).path ?? "")
      : undefined,
    method: typeof item.metadata === "object" && item.metadata && "method" in item.metadata
      ? String((item.metadata as { method?: string }).method ?? "")
      : undefined,
    createTime: normalizeTimestamp(item.create_time),
    updateTime: normalizeTimestamp(item.update_time),
    createUser: item.create_user,
    updateUser: item.update_user,
  };
}

function mapToolGlobalParameter(
  raw?: BackendToolInfo["global_parameters"],
): ToolGlobalParameter | undefined {
  if (!raw?.name || !raw.description || !raw.in || !raw.type) {
    return undefined;
  }

  return {
    name: raw.name,
    description: raw.description,
    required: raw.required,
    in: raw.in as ToolGlobalParameter["in"],
    type: raw.type as ToolGlobalParameter["type"],
    value: raw.value,
  };
}

function serializeToolGlobalParameter(globalParameters?: ToolGlobalParameter) {
  if (!globalParameters?.name || !globalParameters.description) {
    return undefined;
  }

  let value = globalParameters.value;

  if (typeof value === "string" && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      value = globalParameters.value;
    }
  }

  return {
    description: globalParameters.description,
    in: globalParameters.in,
    name: globalParameters.name,
    required: globalParameters.required ?? false,
    type: globalParameters.type,
    value,
  };
}

function mapToolDetail(item: BackendToolInfo): ToolDetail {
  const metadata = item.metadata;

  return {
    ...mapTool(item),
    apiSpec: metadata?.api_spec,
    openapiSpec: serializeOpenApiSpec(item.metadata),
    functionInput: mapFunctionContent(item.metadata),
    ioSpec: parseToolIoSpec(item.metadata as Parameters<typeof parseToolIoSpec>[0]),
    globalParameters: mapToolGlobalParameter(item.global_parameters),
  };
}

function buildToolMutationBody(input: ToolCreateInput | ToolEditInput) {
  const body: Record<string, unknown> = {
    data: parseOpenApiDataPayload(input.openapiSpec, "edit"),
    function_input: input.functionInput
      ? {
          ...input.functionInput,
          name:
            input.functionInput.name ??
            ("name" in input && input.name ? input.name : undefined),
          description:
            input.functionInput.description ??
            ("description" in input ? input.description : undefined),
          script_type: input.functionInput.script_type ?? "python",
        }
      : undefined,
    global_parameters: serializeToolGlobalParameter(input.globalParameters),
    metadata_type: input.metadataType,
    use_rule: input.useRule,
  };

  if ("name" in input) {
    body.name = input.name;
    body.description = input.description;
  }

  return body;
}

function getMockTools(boxId: string) {
  return mockToolsByBox[boxId] ?? [];
}

function parseMockOpenApiIo(openapiSpec?: string) {
  return extractOpenApiOperationsIo(openapiSpec)[0]?.io;
}

function extractMockOpenApiOperations(openapiSpec?: string): MockOpenApiOperation[] {
  if (!openapiSpec?.trim()) {
    return [];
  }

  try {
    const document = JSON.parse(openapiSpec) as Record<string, unknown>;
    const paths = document.paths;
    if (!paths || typeof paths !== "object" || Array.isArray(paths)) {
      return [];
    }

    const serverUrl = Array.isArray(document.servers)
      ? ((document.servers[0] as { url?: unknown } | undefined)?.url as string | undefined)
      : undefined;
    const operations: MockOpenApiOperation[] = [];

    for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
      if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) {
        continue;
      }

      for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
        if (!HTTP_METHODS.has(method.toLowerCase())) {
          continue;
        }

        if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
          continue;
        }

        const operationRecord = operation as Record<string, unknown>;
        const summary =
          typeof operationRecord.summary === "string" ? operationRecord.summary : undefined;
        const description =
          typeof operationRecord.description === "string"
            ? operationRecord.description
            : summary;
        const name =
          normalizeGeneratedCapabilityName(summary) ??
          normalizeGeneratedCapabilityName(`${method}_${path}`) ??
          "api_tool";
        const singleOperationDocument = {
          ...document,
          paths: {
            [path]: {
              [method]: operationRecord,
            },
          },
        };

        operations.push({
          description,
          method: method.toUpperCase(),
          name,
          openapiSpec: JSON.stringify(singleOperationDocument),
          path,
          serverUrl,
        });
      }
    }

    return operations;
  } catch {
    return [];
  }
}

function buildMockToolDetail(toolId: string, input: ToolCreateInput): ToolDetail {
  const operation = extractMockOpenApiOperations(input.openapiSpec)[0];

  return {
    toolId,
    name: input.name ?? operation?.name ?? `Tool ${toolId}`,
    description: input.description ?? operation?.description,
    status: "disabled",
    metadataType: input.metadataType,
    useRule: input.useRule,
    method: operation?.method,
    path: operation?.path,
    serverUrl: operation?.serverUrl,
    updateTime: Date.now(),
    openapiSpec: input.openapiSpec,
    functionInput: input.functionInput,
    globalParameters: input.globalParameters,
    ioSpec: input.metadataType === "openapi" ? parseMockOpenApiIo(input.openapiSpec) : undefined,
  };
}

function filterMockTools(boxId: string, query: ToolListQuery) {
  const keyword = query.keyword?.trim().toLowerCase();

  return getMockTools(boxId).filter((item) => {
    if (query.status && item.status !== query.status) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(keyword) ||
      item.toolId.toLowerCase().includes(keyword)
    );
  });
}

export async function listTools(
  boxId: string,
  query: ToolListQuery,
): Promise<ToolListResult> {
  if (useMock) {
    const filtered = filterMockTools(boxId, query);
    const start = (query.page - 1) * query.pageSize;

    return {
      boxId,
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  const response = await http.get<BackendToolListResponse>(
    `${API_PREFIX}/tool-box/${boxId}/tools/list`,
    {
      headers: getBusinessDomainHeaders(),
      params: {
        all: query.all || undefined,
        box_id: boxId,
        page: query.page,
        page_size: query.pageSize,
        name: query.keyword || undefined,
        status: query.status,
        sort_by: "update_time",
        sort_order: "desc",
      },
      skipErrorToast: true,
    },
  );

  const payload = response.data.data ?? response.data;

  return {
    boxId: payload.box_id ?? boxId,
    items: (payload.tools ?? []).map(mapTool),
    total: payload.total ?? 0,
    page: payload.page ?? query.page,
    pageSize: payload.page_size ?? query.pageSize,
  };
}

export async function getTool(boxId: string, toolId: string): Promise<ToolRecord> {
  if (useMock) {
    const record = getMockTools(boxId).find((item) => item.toolId === toolId);

    if (!record) {
      throw new Error("Tool not found");
    }

    return record;
  }

  const response = await http.get<BackendToolInfo>(
    `${API_PREFIX}/tool-box/${boxId}/tool/${toolId}`,
    { headers: getBusinessDomainHeaders() },
  );

  return mapTool(response.data);
}

export async function getToolDetail(boxId: string, toolId: string): Promise<ToolDetail> {
  if (useMock) {
    const record = getMockTools(boxId).find((item) => item.toolId === toolId);

    if (!record) {
      throw new Error("Tool not found");
    }

    return {
      ...record,
      openapiSpec:
        record.openapiSpec ??
        (record.metadataType === "openapi" ? '{"openapi":"3.0.3"}' : undefined),
      functionInput:
        record.functionInput ??
        (record.metadataType === "function"
          ? { code: "def handler(event):\n    return event\n", script_type: "python" }
          : undefined),
    };
  }

  const response = await http.get<BackendToolInfo>(
    `${API_PREFIX}/tool-box/${boxId}/tool/${toolId}`,
    { headers: getBusinessDomainHeaders() },
  );

  return mapToolDetail(response.data);
}

export async function createTool(
  boxId: string,
  input: ToolCreateInput,
): Promise<ToolCreateResult> {
  if (useMock) {
    const toolId = `tool_${Date.now()}`;
    const record = buildMockToolDetail(toolId, input);
    mockToolsByBox[boxId] = [record, ...getMockTools(boxId)];
    return {
      successIds: [toolId],
      successCount: 1,
      failureCount: 0,
      failures: [],
    };
  }

  const response = await http.post<{
    failure_count?: number;
    failures?: Array<{ error?: { description?: string }; tool_name?: string }>;
    success_count?: number;
    success_ids?: string[];
  }>(`${API_PREFIX}/tool-box/${boxId}/tool`, buildToolMutationBody(input), {
    headers: getBusinessDomainHeaders(),
  });

  return {
    successIds: response.data.success_ids ?? [],
    successCount: response.data.success_count ?? response.data.success_ids?.length ?? 0,
    failureCount: response.data.failure_count ?? 0,
    failures: (response.data.failures ?? []).map((item) => ({
      toolName: item.tool_name,
      error: item.error?.description ?? "Unknown error",
    })),
  };
}

export async function importOpenApiTools(
  boxId: string,
  openapiSpec: string,
  useRule?: string,
): Promise<ToolCreateResult> {
  if (useMock) {
    const operations = extractMockOpenApiOperations(openapiSpec);

    if (operations.length <= 1) {
      return createTool(boxId, {
        metadataType: "openapi",
        openapiSpec,
        useRule,
      });
    }

    const now = Date.now();
    const records = operations.map((operation, index) =>
      buildMockToolDetail(`tool_${now}_${index}`, {
        metadataType: "openapi",
        name: operation.name,
        description: operation.description,
        openapiSpec: operation.openapiSpec,
        useRule,
      }),
    );

    mockToolsByBox[boxId] = [...records, ...getMockTools(boxId)];

    return {
      successIds: records.map((record) => record.toolId),
      successCount: records.length,
      failureCount: 0,
      failures: [],
    };
  }

  return createTool(boxId, {
    metadataType: "openapi",
    openapiSpec,
    useRule,
  });
}

export async function updateTool(
  boxId: string,
  toolId: string,
  input: ToolEditInput,
): Promise<void> {
  if (useMock) {
    const metadataType = input.metadataType;
    mockToolsByBox[boxId] = getMockTools(boxId).map((item) =>
      item.toolId === toolId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            useRule: input.useRule,
            metadataType: metadataType ?? item.metadataType,
            openapiSpec: input.openapiSpec ?? item.openapiSpec,
            functionInput: input.functionInput ?? item.functionInput,
            globalParameters: input.globalParameters ?? item.globalParameters,
            ioSpec:
              metadataType === "openapi" && input.openapiSpec
                ? parseMockOpenApiIo(input.openapiSpec)
                : item.ioSpec,
            updateTime: Date.now(),
          }
        : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/tool-box/${boxId}/tool/${toolId}`,
    buildToolMutationBody(input),
    { headers: getBusinessDomainHeaders() },
  );
}

export async function updateToolStatus(
  boxId: string,
  toolIds: string[],
  status: ToolStatus,
): Promise<void> {
  if (useMock) {
    mockToolsByBox[boxId] = getMockTools(boxId).map((item) =>
      toolIds.includes(item.toolId) ? { ...item, status, updateTime: Date.now() } : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/tool-box/${boxId}/tools/status`,
    toolIds.map((toolId) => ({ status, tool_id: toolId })),
    { headers: getBusinessDomainHeaders() },
  );
}

export async function deleteTools(boxId: string, toolIds: string[]): Promise<void> {
  if (useMock) {
    mockToolsByBox[boxId] = getMockTools(boxId).filter(
      (item) => !toolIds.includes(item.toolId),
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/tool-box/${boxId}/tools/batch-delete`,
    { tool_ids: toolIds },
    { headers: getBusinessDomainHeaders() },
  );
}

export async function debugTool(
  boxId: string,
  toolId: string,
  input: ToolDebugInput,
): Promise<ToolDebugResult> {
  if (useMock) {
    return {
      statusCode: 200,
      body: { echo: input.body ?? {}, boxId, toolId },
      durationMs: 96,
    };
  }

  const response = await http.post<{
    body?: unknown;
    duration_ms?: number;
    error?: string;
    status_code?: number;
  }>(
    `${API_PREFIX}/tool-box/${boxId}/tool/${toolId}/debug`,
    {
      body: input.body,
      header: input.header,
      query: input.query,
    },
    { headers: getBusinessDomainHeaders() },
  );

  return {
    statusCode: response.data.status_code,
    body: response.data.body,
    error: response.data.error,
    durationMs: response.data.duration_ms,
  };
}

export async function convertOperatorToTool(
  input: ConvertOperatorToToolInput,
): Promise<ConvertOperatorToToolResult> {
  if (useMock) {
    const toolId = `tool_from_${input.operatorId}`;
    mockToolsByBox[input.boxId] = [
      {
        toolId,
        name: `Converted ${input.operatorId}`,
        description: `Converted from operator ${input.operatorId}`,
        status: "disabled",
        metadataType: "openapi",
        updateTime: Date.now(),
      },
      ...getMockTools(input.boxId),
    ];

    return { boxId: input.boxId, toolId };
  }

  const response = await http.post<ConvertOperatorToToolResult>(
    `${API_PREFIX}/operator/convert/tool`,
    {
      box_id: input.boxId,
      operator_id: input.operatorId,
      operator_version: input.operatorVersion,
    },
    { headers: getBusinessDomainHeaders() },
  );

  return {
    boxId: response.data.boxId ?? input.boxId,
    toolId: response.data.toolId,
  };
}
