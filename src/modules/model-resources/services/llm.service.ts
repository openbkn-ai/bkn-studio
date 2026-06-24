import { http } from "@/framework/request/http";
import {
  mockLlmModels,
  mockLlmMonitorData,
} from "@/modules/model-resources/services/mock/fixtures";
import type {
  LlmListQuery,
  LlmListResult,
  LlmModel,
  LlmModelConfig,
  LlmMonitorData,
  LlmSavePayload,
} from "@/modules/model-resources/types/llm";

const API_PREFIX = "/mf-model-manager/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendLlmModel = {
  model_id: string;
  model_name: string;
  model_type: string;
  model_series: string;
  max_model_len?: number;
  model_parameters?: number;
  default?: boolean;
  quota?: boolean;
  create_by?: string;
  create_time?: string;
  update_by?: string;
  update_time?: string;
  billing_type?: number;
  input_tokens?: number;
  output_tokens?: number;
  inputs_used?: number;
  outputs_used?: number;
  inputs_left?: number;
  outputs_left?: number;
  model_config?: string | BackendModelConfig;
};

type BackendModelConfig = {
  api_model?: string;
  api_url?: string;
  api_key?: string;
  secret_key?: string;
};

type BackendLlmListResponse = {
  count?: number;
  data?: BackendLlmModel[];
};

type BackendStatusResponse = {
  status?: string;
};

function parseModelConfig(config?: string | BackendModelConfig): LlmModelConfig | undefined {
  if (!config) {
    return undefined;
  }

  const parsed =
    typeof config === "string"
      ? (JSON.parse(config.replace(/'/g, '"')) as BackendModelConfig)
      : config;

  return {
    apiModel: parsed.api_model ?? "",
    apiUrl: parsed.api_url ?? "",
    apiKey: parsed.api_key,
    secretKey: parsed.secret_key,
  };
}

function mapLlmModel(item: BackendLlmModel): LlmModel {
  return {
    modelId: item.model_id,
    modelName: item.model_name,
    modelType: item.model_type,
    modelSeries: item.model_series,
    maxModelLen: item.max_model_len,
    modelParameters: item.model_parameters,
    default: item.default,
    quota: item.quota,
    createBy: item.create_by,
    createTime: item.create_time,
    updateBy: item.update_by,
    updateTime: item.update_time,
    billingType: item.billing_type,
    inputTokens: item.input_tokens,
    outputTokens: item.output_tokens,
    inputsUsed: item.inputs_used,
    outputsUsed: item.outputs_used,
    inputsLeft: item.inputs_left,
    outputsLeft: item.outputs_left,
    modelConfig: parseModelConfig(item.model_config),
  };
}

function mapSavePayload(payload: LlmSavePayload) {
  const body: Record<string, unknown> = {
    model_name: payload.modelName,
    model_series: payload.modelSeries,
    model_type: payload.modelType,
    max_model_len: payload.maxModelLen,
    quota: payload.quota ?? false,
    icon: payload.modelSeries,
    model_config: {
      api_model: payload.modelConfig.apiModel,
      api_url: payload.modelConfig.apiUrl,
      ...(payload.modelConfig.apiKey ? { api_key: payload.modelConfig.apiKey } : {}),
      ...(payload.modelConfig.secretKey ? { secret_key: payload.modelConfig.secretKey } : {}),
    },
  };

  if (payload.modelParameters !== undefined) {
    body.model_parameters = payload.modelParameters;
  }

  if (payload.modelId) {
    body.model_id = payload.modelId;
  }

  if (payload.change) {
    body.change = true;
  }

  return body;
}

function filterMockLlmModels(query: LlmListQuery): LlmListResult {
  const keyword = query.name?.trim().toLowerCase();
  let items = [...mockLlmModels];

  if (query.modelType && query.modelType !== "all") {
    items = items.filter((item) => item.modelType === query.modelType);
  }

  if (keyword) {
    items = items.filter((item) => item.modelName.toLowerCase().includes(keyword));
  }

  const rule = query.rule ?? "update_time";
  const order = query.order ?? "desc";

  items.sort((left, right) => {
    if (rule === "model_name") {
      const compare = left.modelName.localeCompare(right.modelName);
      return order === "asc" ? compare : -compare;
    }

    if (rule === "create_time" || rule === "update_time") {
      const leftTime = (rule === "create_time" ? left.createTime : left.updateTime) ?? "";
      const rightTime = (rule === "create_time" ? right.createTime : right.updateTime) ?? "";
      const compare = leftTime.localeCompare(rightTime);
      return order === "asc" ? compare : -compare;
    }

    return 0;
  });

  const start = (query.page - 1) * query.size;

  return {
    items: items.slice(start, start + query.size),
    total: items.length,
  };
}

export async function listLlmModels(query: LlmListQuery): Promise<LlmListResult> {
  if (useMock) {
    return filterMockLlmModels(query);
  }

  const response = await http.get<BackendLlmListResponse>(`${API_PREFIX}/llm/list`, {
    params: {
      page: query.page,
      size: query.size,
      order: query.order ?? "desc",
      rule: query.rule ?? "update_time",
      name: query.name ?? "",
      ...(query.modelType && query.modelType !== "all"
        ? { model_type: query.modelType }
        : {}),
    },
  });

  const payload = response.data;

  return {
    items: (payload.data ?? []).map(mapLlmModel),
    total: payload.count ?? 0,
  };
}

export async function createLlmModel(payload: LlmSavePayload) {
  if (useMock) {
    mockLlmModels.unshift({
      modelId: `llm-${mockLlmModels.length + 1}`,
      modelName: payload.modelName,
      modelType: payload.modelType,
      modelSeries: payload.modelSeries,
      maxModelLen: payload.maxModelLen,
      modelParameters: payload.modelParameters,
      quota: payload.quota,
      createBy: "admin",
      createTime: new Date().toISOString().slice(0, 19).replace("T", " "),
      updateBy: "admin",
      updateTime: new Date().toISOString().slice(0, 19).replace("T", " "),
      modelConfig: payload.modelConfig,
    });
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(
    `${API_PREFIX}/llm/add`,
    mapSavePayload(payload),
  );

  return response.data;
}

export async function updateLlmModel(payload: LlmSavePayload) {
  if (useMock) {
    const index = mockLlmModels.findIndex((item) => item.modelId === payload.modelId);
    if (index >= 0) {
      mockLlmModels[index] = {
        ...mockLlmModels[index],
        modelName: payload.modelName,
        modelType: payload.modelType,
        modelSeries: payload.modelSeries,
        maxModelLen: payload.maxModelLen,
        modelParameters: payload.modelParameters,
        quota: payload.quota,
        modelConfig: payload.modelConfig,
        updateTime: new Date().toISOString().slice(0, 19).replace("T", " "),
      };
    }
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(
    `${API_PREFIX}/llm/edit`,
    mapSavePayload(payload),
  );

  return response.data;
}

export async function deleteLlmModels(modelIds: string[]) {
  if (useMock) {
    modelIds.forEach((modelId) => {
      const index = mockLlmModels.findIndex((item) => item.modelId === modelId);
      if (index >= 0) {
        mockLlmModels.splice(index, 1);
      }
    });
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(`${API_PREFIX}/llm/delete`, {
    model_ids: modelIds,
  });

  return response.data;
}

export async function testLlmModel(payload: LlmSavePayload, silent = false) {
  if (useMock) {
    if (!silent) {
      return { status: "ok" };
    }
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(
    `${API_PREFIX}/llm/test`,
    mapSavePayload(payload),
    { timeout: 600_000 },
  );

  return response.data;
}

export async function getLlmModelMonitor(modelId: string): Promise<LlmMonitorData> {
  if (useMock) {
    return mockLlmMonitorData;
  }

  const response = await http.get<{
    average_first_token_time?: { time: string; value: number }[];
    output_token_speed?: { time: string; value: number }[];
    total_token_speed?: { time: string; value: number }[];
  }>(`${API_PREFIX}/llm/monitor/list`, {
    params: { model_id: modelId },
  });

  const payload = response.data;

  return {
    averageFirstTokenTime: payload.average_first_token_time ?? [],
    outputTokenSpeed: payload.output_token_speed ?? [],
    totalTokenSpeed: payload.total_token_speed ?? [],
  };
}
