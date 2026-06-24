export type LlmModelType = "llm" | "rlm" | "vu" | string;

export type LlmAuthType = "empty" | "auth" | "dual_key" | string;

export type LlmModelConfig = {
  apiModel: string;
  apiUrl: string;
  apiKey?: string;
  secretKey?: string;
};

export type LlmModel = {
  modelId: string;
  modelName: string;
  modelType: LlmModelType;
  modelSeries: string;
  maxModelLen?: number;
  modelParameters?: number;
  default?: boolean;
  quota?: boolean;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
  billingType?: number;
  inputTokens?: number;
  outputTokens?: number;
  inputsUsed?: number;
  outputsUsed?: number;
  inputsLeft?: number;
  outputsLeft?: number;
  modelConfig?: LlmModelConfig;
};

export type LlmListQuery = {
  page: number;
  size: number;
  order?: string;
  rule?: string;
  name?: string;
  modelType?: string;
};

export type LlmListResult = {
  items: LlmModel[];
  total: number;
};

export type LlmSavePayload = {
  modelId?: string;
  modelName: string;
  modelSeries: string;
  modelType: LlmModelType;
  maxModelLen: number;
  modelParameters?: number;
  quota?: boolean;
  modelConfig: LlmModelConfig;
  change?: boolean;
};

export type LlmMonitorPoint = {
  time: string;
  value: number;
};

export type LlmMonitorData = {
  averageFirstTokenTime: LlmMonitorPoint[];
  outputTokenSpeed: LlmMonitorPoint[];
  totalTokenSpeed: LlmMonitorPoint[];
};
