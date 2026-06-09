export type KnowledgeNetworkActionTypeKind =
  | "create"
  | "update"
  | "delete"
  | "notify";

export type ActionTypeConditionOperation =
  | "and"
  | "or"
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "not_in"
  | "range"
  | "out_range"
  | "exist"
  | "not_exist";

export type ActionTypeCondition = {
  field?: string;
  objectTypeId?: string;
  operation?: ActionTypeConditionOperation;
  subConditions?: ActionTypeCondition[];
  value?: string | string[];
  valueFrom?: "const";
};

export type ActionTypeAffect = {
  comment?: string;
  objectTypeId?: string;
};

export type ActionTypeSourceKind = "manual" | "mcp" | "tool";

export type ActionTypeActionSource = {
  boxId?: string;
  boxName?: string;
  mcpId?: string;
  mcpName?: string;
  toolId?: string;
  toolName?: string;
  type: ActionTypeSourceKind;
};

export type ActionTypeExecutionParameter = {
  name: string;
  sourcePropertyName: string;
  valueFrom?: "property";
};

export type ActionTypeExecutionConfig = {
  actionSource?: ActionTypeActionSource;
  parameters: ActionTypeExecutionParameter[];
  sourceName: string;
  sourceType: ActionTypeSourceKind;
};

export type KnowledgeNetworkActionTypeRecord = {
  actionKind: KnowledgeNetworkActionTypeKind;
  color: string;
  description: string;
  id: string;
  name: string;
  objectTypeId: string;
  objectTypeName: string;
  tags: string[];
  updateTime: string;
  updaterName: string;
};

export type ActionTypeDetail = KnowledgeNetworkActionTypeRecord & {
  affect?: ActionTypeAffect;
  condition?: ActionTypeCondition;
  executionConfig: ActionTypeExecutionConfig;
};

export type KnowledgeNetworkActionTypeMutationPayload = {
  actionKind: KnowledgeNetworkActionTypeKind;
  affect?: ActionTypeAffect;
  color: string;
  condition?: ActionTypeCondition;
  description: string;
  executionConfig?: ActionTypeExecutionConfig;
  id?: string;
  name: string;
  objectTypeId: string;
  tags: string[];
};

export type ActionTypeExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ActionTypeExecutionLog = {
  actionTypeId: string;
  actionTypeName: string;
  durationMs: number;
  failedCount: number;
  id: string;
  startTime: string;
  status: ActionTypeExecutionStatus;
  successCount: number;
  totalCount: number;
  triggerType: string;
};

export type ActionTypeExecutionLogQuery = {
  actionTypeId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  status?: ActionTypeExecutionStatus | "";
  triggerType?: string;
};

export type ActionTypeExecutionLogResultItem = {
  displayName?: string;
  durationMs?: number;
  errorMessage?: string;
  status: "failed" | "success";
};

export type ActionTypeExecutionLogDetail = ActionTypeExecutionLog & {
  endTime?: string;
  executorName?: string;
  results?: ActionTypeExecutionLogResultItem[];
};

export type ActionTypeExecutionLogListResult = {
  entries: ActionTypeExecutionLog[];
  totalCount: number;
};
