import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  McpListQuery,
  McpListResult,
  McpParseSseInput,
  McpParseSseResult,
  McpProxyTool,
  McpRecord,
  McpRegisterInput,
  McpStatus,
  McpToolDebugInput,
  McpToolDebugResult,
} from "@/modules/execution-factory/types/mcp";

type BackendMcpInfo = {
  category?: string;
  create_user?: string;
  creation_type?: string;
  description?: string;
  is_internal?: boolean;
  mcp_id: string | number;
  mode?: string;
  name: string;
  status?: string;
  update_time?: number;
  url?: string;
};

type BackendMcpListResponse = {
  data?: BackendMcpInfo[];
  page?: number;
  page_size?: number;
  total?: number;
};

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

let mockMcps: McpRecord[] = [
  {
    mcpId: "mcp_sse_demo",
    name: "SSE Demo MCP",
    description: "Sample SSE MCP server for local development.",
    status: "published",
    mode: "sse",
    creationType: "custom",
    category: "other_category",
    url: "http://localhost:8080/mcp",
    createUser: "system",
    updateTime: Date.now() - 259_200_000,
    isInternal: true,
  },
  {
    mcpId: "mcp_custom_ops",
    name: "Custom Operations MCP",
    description: "User-defined MCP with imported toolbox tools.",
    status: "unpublish",
    mode: "stream",
    creationType: "tool_imported",
    category: "other_category",
    createUser: "test",
    updateTime: Date.now() - 14_400_000,
    isInternal: false,
  },
];

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

function mapMcp(item: BackendMcpInfo): McpRecord {
  return {
    mcpId: String(item.mcp_id),
    name: item.name,
    description: item.description,
    status: (item.status ?? "unpublish") as McpStatus,
    mode: item.mode as McpRecord["mode"],
    creationType: item.creation_type as McpRecord["creationType"],
    category: item.category,
    url: item.url,
    createUser: item.create_user,
    updateTime: item.update_time,
    isInternal: item.is_internal,
  };
}

function filterMockMcps(query: McpListQuery) {
  const keyword = query.keyword?.trim().toLowerCase();

  return mockMcps.filter((item) => {
    if (query.status && item.status !== query.status) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(keyword) ||
      item.mcpId.toLowerCase().includes(keyword)
    );
  });
}

async function fetchMcpList(
  path: string,
  query: McpListQuery,
): Promise<McpListResult> {
  const response = await http.get<BackendMcpListResponse>(path, {
    headers: getBusinessDomainHeaders(),
    params: {
      page: query.page,
      page_size: query.pageSize,
      name: query.keyword || undefined,
      status: query.status,
      sort_by: "update_time",
      sort_order: "desc",
    },
  });

  const data = response.data;

  return {
    items: (data.data ?? []).map(mapMcp),
    total: data.total ?? 0,
    page: data.page ?? query.page,
    pageSize: data.page_size ?? query.pageSize,
  };
}

function buildMockMcpList(query: McpListQuery): McpListResult {
  const filtered = filterMockMcps(query);
  const start = (query.page - 1) * query.pageSize;

  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listMcps(query: McpListQuery): Promise<McpListResult> {
  if (useMock) {
    return buildMockMcpList(query);
  }

  return fetchMcpList(`${API_PREFIX}/mcp/list`, query);
}

export async function listMcpMarket(query: McpListQuery): Promise<McpListResult> {
  if (useMock) {
    return buildMockMcpList({ ...query, status: "published" });
  }

  return fetchMcpList(`${API_PREFIX}/mcp/market/list`, query);
}

export async function getMcp(mcpId: string): Promise<McpRecord> {
  if (useMock) {
    const record = mockMcps.find((item) => item.mcpId === mcpId);

    if (!record) {
      throw new Error("MCP not found");
    }

    return record;
  }

  const response = await http.get<{
    base_info?: BackendMcpInfo;
  }>(`${API_PREFIX}/mcp/${mcpId}`, {
    headers: getBusinessDomainHeaders(),
  });

  if (!response.data.base_info) {
    throw new Error("MCP not found");
  }

  return mapMcp(response.data.base_info);
}

export async function getMcpMarket(mcpId: string): Promise<McpRecord> {
  if (useMock) {
    return getMcp(mcpId);
  }

  const response = await http.get<{
    base_info?: BackendMcpInfo;
  }>(`${API_PREFIX}/mcp/market/${mcpId}`, {
    headers: getBusinessDomainHeaders(),
  });

  if (!response.data.base_info) {
    throw new Error("Market MCP not found");
  }

  return mapMcp(response.data.base_info);
}

export async function parseMcpSse(input: McpParseSseInput): Promise<McpParseSseResult> {
  if (useMock) {
    return {
      tools: [
        { name: "search", description: "Search tool from parsed SSE endpoint." },
        { name: "fetch", description: "Fetch tool from parsed SSE endpoint." },
      ],
    };
  }

  const response = await http.post<{
    tools?: Array<{ description?: string; name?: string }>;
  }>(
    `${API_PREFIX}/mcp/parse/sse`,
    {
      headers: input.headers,
      url: input.url,
    },
    { headers: getBusinessDomainHeaders() },
  );

  return {
    tools: (response.data.tools ?? []).map((tool) => ({
      name: tool.name ?? "unknown",
      description: tool.description,
    })),
  };
}

export async function registerMcp(input: McpRegisterInput): Promise<string> {
  if (useMock) {
    const mcpId = `mcp_${Date.now()}`;
    mockMcps = [
      {
        mcpId,
        name: input.name,
        description: input.description,
        status: "unpublish",
        mode: input.mode,
        creationType: input.creationType,
        category: input.category,
        url: input.url,
        createUser: "local-admin",
        updateTime: Date.now(),
        isInternal: false,
      },
      ...mockMcps,
    ];
    return mcpId;
  }

  const response = await http.post<{ mcp_id?: string | number }>(
    `${API_PREFIX}/mcp`,
    {
      category: input.category ?? "other_category",
      creation_type: input.creationType,
      description: input.description,
      mode: input.mode,
      name: input.name,
      url: input.url,
    },
    { headers: getBusinessDomainHeaders() },
  );

  if (!response.data.mcp_id) {
    throw new Error("MCP registration failed");
  }

  return String(response.data.mcp_id);
}

export async function updateMcpStatus(
  mcpId: string,
  status: McpStatus,
): Promise<void> {
  if (useMock) {
    mockMcps = mockMcps.map((item) =>
      item.mcpId === mcpId ? { ...item, status, updateTime: Date.now() } : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/mcp/${mcpId}/status`,
    { status },
    { headers: getBusinessDomainHeaders() },
  );
}

export async function deleteMcp(mcpId: string): Promise<void> {
  if (useMock) {
    mockMcps = mockMcps.filter((item) => item.mcpId !== mcpId);
    return;
  }

  await http.delete(`${API_PREFIX}/mcp/${mcpId}`, {
    headers: getBusinessDomainHeaders(),
  });
}

export async function listMcpTools(mcpId: string): Promise<McpProxyTool[]> {
  if (useMock) {
    return [
      { name: "search", description: "Search documents in the connected MCP server." },
      { name: "fetch", description: "Fetch a document by identifier." },
    ];
  }

  const response = await http.get<{
    tools?: Array<{ description?: string; name?: string }>;
  }>(`${API_PREFIX}/mcp/proxy/${mcpId}/tools`, {
    headers: getBusinessDomainHeaders(),
  });

  return (response.data.tools ?? []).map((tool) => ({
    name: tool.name ?? "unknown",
    description: tool.description,
  }));
}

export async function debugMcpTool(
  mcpId: string,
  toolName: string,
  input: McpToolDebugInput,
): Promise<McpToolDebugResult> {
  if (useMock) {
    return {
      content: { tool: toolName, arguments: input.arguments ?? {}, result: "ok" },
      isError: false,
    };
  }

  const response = await http.post<McpToolDebugResult>(
    `${API_PREFIX}/mcp/${mcpId}/tool/${encodeURIComponent(toolName)}/debug`,
    input.arguments ?? {},
    { headers: getBusinessDomainHeaders() },
  );

  return {
    content: response.data.content,
    isError: response.data.isError,
  };
}
