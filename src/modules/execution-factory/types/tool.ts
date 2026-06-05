export type ToolStatus = "enabled" | "disabled";

export type ToolMetadataType = "openapi" | "function";

export type ToolRecord = {
  toolId: string;
  name: string;
  description?: string;
  status: ToolStatus;
  metadataType?: ToolMetadataType;
  useRule?: string;
  createTime?: number;
  updateTime?: number;
  createUser?: string;
  updateUser?: string;
};

export type ToolListQuery = {
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
  useRule?: string;
};

export type ToolEditInput = {
  name: string;
  description?: string;
  useRule?: string;
  metadataType?: ToolMetadataType;
  openapiSpec?: string;
};

export type ToolDebugInput = {
  body?: Record<string, unknown>;
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
