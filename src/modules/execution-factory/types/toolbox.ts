export type ToolboxStatus = "unpublish" | "published" | "offline";

export type ToolboxMetadataType = "openapi" | "function";

export type ToolboxToolRecord = {
  toolId: string;
  name: string;
  description?: string;
  status?: "enabled" | "disabled";
  metadataType?: string;
};

export type ToolboxRecord = {
  boxId: string;
  name: string;
  description?: string;
  serviceUrl?: string;
  status: ToolboxStatus;
  categoryType?: string;
  categoryName?: string;
  metadataType?: ToolboxMetadataType;
  toolCount?: number;
  tools?: ToolboxToolRecord[];
  createTime?: number;
  updateTime?: number;
  createUser?: string;
  updateUser?: string;
  releaseUser?: string;
  releaseTime?: number;
  isInternal?: boolean;
};

export type ToolboxListQuery = {
  all?: boolean;
  page: number;
  pageSize: number;
  keyword?: string;
  status?: ToolboxStatus;
  category?: string;
};

export type ToolboxListResult = {
  items: ToolboxRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type ToolboxMutationInput = {
  name: string;
  description?: string;
  serviceUrl?: string;
  category?: string;
  metadataType: ToolboxMetadataType;
  openapiSpec?: string;
};

export type ToolboxEditInput = ToolboxMutationInput & {
  boxId: string;
};
