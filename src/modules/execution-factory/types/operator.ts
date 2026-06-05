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
  directPublish?: boolean;
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
  body?: Record<string, unknown>;
};

export type OperatorDebugResult = {
  statusCode?: number;
  body?: unknown;
  error?: string;
  durationMs?: number;
};
