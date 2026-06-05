export type McpStatus = "unpublish" | "published" | "offline" | "editing";

export type McpMode = "sse" | "stream";

export type McpCreationType = "custom" | "tool_imported";

export type McpRecord = {
  mcpId: string;
  name: string;
  description?: string;
  status: McpStatus;
  mode?: McpMode;
  creationType?: McpCreationType;
  category?: string;
  url?: string;
  createUser?: string;
  updateTime?: number;
  isInternal?: boolean;
};

export type McpListQuery = {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: McpStatus;
};

export type McpListResult = {
  items: McpRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type McpRegisterInput = {
  name: string;
  description?: string;
  creationType: McpCreationType;
  mode?: McpMode;
  url?: string;
  category?: string;
};

export type McpParseSseInput = {
  url: string;
  headers?: Record<string, string>;
};

export type McpParseSseTool = {
  name: string;
  description?: string;
};

export type McpParseSseResult = {
  tools: McpParseSseTool[];
};

export type McpProxyTool = {
  name: string;
  description?: string;
};

export type McpToolDebugInput = {
  arguments?: Record<string, unknown>;
};

export type McpToolDebugResult = {
  content?: unknown;
  isError?: boolean;
};
