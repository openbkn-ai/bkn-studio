import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  ConvertOperatorToToolInput,
  ConvertOperatorToToolResult,
  ToolCreateInput,
  ToolDebugInput,
  ToolDebugResult,
  ToolEditInput,
  ToolListQuery,
  ToolListResult,
  ToolRecord,
  ToolStatus,
} from "@/modules/execution-factory/types/tool";

type BackendToolInfo = {
  create_time?: number;
  create_user?: string;
  description?: string;
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
  page?: number;
  page_size?: number;
  tools?: BackendToolInfo[];
  total?: number;
};

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

const mockToolsByBox: Record<string, ToolRecord[]> = {
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
    createTime: item.create_time,
    updateTime: item.update_time,
    createUser: item.create_user,
    updateUser: item.update_user,
  };
}

function getMockTools(boxId: string) {
  return mockToolsByBox[boxId] ?? [];
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
        page: query.page,
        page_size: query.pageSize,
        name: query.keyword || undefined,
        status: query.status,
        sort_by: "update_time",
        sort_order: "desc",
      },
    },
  );

  const data = response.data;

  return {
    boxId: data.box_id ?? boxId,
    items: (data.tools ?? []).map(mapTool),
    total: data.total ?? 0,
    page: data.page ?? query.page,
    pageSize: data.page_size ?? query.pageSize,
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

export async function createTool(
  boxId: string,
  input: ToolCreateInput,
): Promise<string[]> {
  if (useMock) {
    const toolId = `tool_${Date.now()}`;
    const record: ToolRecord = {
      toolId,
      name: `Tool ${toolId}`,
      status: "disabled",
      metadataType: input.metadataType,
      useRule: input.useRule,
      updateTime: Date.now(),
    };
    mockToolsByBox[boxId] = [record, ...getMockTools(boxId)];
    return [toolId];
  }

  const response = await http.post<{ success_ids?: string[] }>(
    `${API_PREFIX}/tool-box/${boxId}/tool`,
    {
      data: input.openapiSpec,
      metadata_type: input.metadataType,
      use_rule: input.useRule,
    },
    { headers: getBusinessDomainHeaders() },
  );

  return response.data.success_ids ?? [];
}

export async function updateTool(
  boxId: string,
  toolId: string,
  input: ToolEditInput,
): Promise<void> {
  if (useMock) {
    mockToolsByBox[boxId] = getMockTools(boxId).map((item) =>
      item.toolId === toolId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            useRule: input.useRule,
            updateTime: Date.now(),
          }
        : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/tool-box/${boxId}/tool/${toolId}`,
    {
      data: input.openapiSpec,
      description: input.description,
      metadata_type: input.metadataType,
      name: input.name,
      use_rule: input.useRule,
    },
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
    { body: input.body },
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
