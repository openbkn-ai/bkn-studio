import { http } from "@/framework/request/http";
import { getResourceOperations } from "@/modules/model-resources/services/authorization.service";
import { mockSmallModels } from "@/modules/model-resources/services/mock/fixtures";
import type {
  SmallModel,
  SmallModelListQuery,
  SmallModelListResult,
  SmallModelSavePayload,
} from "@/modules/model-resources/types/small-model";

const API_PREFIX = "/mf-model-manager/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendSmallModel = {
  model_id: string;
  model_name: string;
  model_type: string;
  adapter?: boolean;
  adapter_code?: string;
  embedding_dim?: number;
  batch_size?: number;
  max_tokens?: number;
  max_documents?: number;
  create_by?: string;
  create_time?: string;
  update_by?: string;
  update_time?: string;
  model_config?: string | BackendModelConfig;
  __operation?: string[];
};

type BackendModelConfig = {
  api_model?: string;
  api_url?: string;
  api_key?: string;
};

type BackendSmallModelListResponse = {
  count?: number;
  data?: BackendSmallModel[];
};

type BackendStatusResponse = {
  status?: string;
};

function parseModelConfig(config?: string | BackendModelConfig) {
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
  };
}

function mapSmallModel(item: BackendSmallModel): SmallModel {
  return {
    modelId: item.model_id,
    modelName: item.model_name,
    modelType: item.model_type,
    adapter: item.adapter,
    adapterCode: item.adapter_code,
    embeddingDim: item.embedding_dim,
    batchSize: item.batch_size,
    maxTokens: item.max_tokens,
    maxDocuments: item.max_documents,
    createBy: item.create_by,
    createTime: item.create_time,
    updateBy: item.update_by,
    updateTime: item.update_time,
    modelConfig: parseModelConfig(item.model_config),
    operations: item.__operation,
  };
}

function mapSavePayload(payload: SmallModelSavePayload) {
  const body: Record<string, unknown> = {
    model_name: payload.modelName,
    model_type: payload.modelType,
  };

  if (payload.adapter) {
    body.adapter = true;
    body.adapter_code = payload.adapterCode ?? "";
  } else if (payload.modelConfig) {
    body.model_config = {
      api_model: payload.modelConfig.apiModel,
      api_url: payload.modelConfig.apiUrl,
      ...(payload.modelConfig.apiKey ? { api_key: payload.modelConfig.apiKey } : {}),
    };
  }

  if (payload.embeddingDim !== undefined) {
    body.embedding_dim = payload.embeddingDim;
  }

  if (payload.batchSize !== undefined) {
    body.batch_size = payload.batchSize;
  }

  if (payload.maxTokens !== undefined) {
    body.max_tokens = payload.maxTokens;
  }

  if (payload.maxDocuments !== undefined) {
    body.max_documents = payload.maxDocuments;
  }

  if (payload.modelId) {
    body.model_id = payload.modelId;
  }

  if (payload.change) {
    body.change = true;
  }

  return body;
}

function filterMockSmallModels(query: SmallModelListQuery): SmallModelListResult {
  const keyword = query.name?.trim().toLowerCase();
  let items = [...mockSmallModels];

  if (query.modelType && query.modelType !== "all") {
    items = items.filter((item) => item.modelType === query.modelType);
  }

  if (keyword) {
    items = items.filter((item) => item.modelName.toLowerCase().includes(keyword));
  }

  const rule = query.rule ?? "create_time";
  const order = query.order ?? "desc";

  items.sort((left, right) => {
    if (rule === "model_name") {
      const compare = left.modelName.localeCompare(right.modelName);
      return order === "asc" ? compare : -compare;
    }

    const leftTime = (rule === "update_time" ? left.updateTime : left.createTime) ?? "";
    const rightTime = (rule === "update_time" ? right.updateTime : right.createTime) ?? "";
    const compare = leftTime.localeCompare(rightTime);
    return order === "asc" ? compare : -compare;
  });

  const start = (query.page - 1) * query.size;

  return {
    items: items.slice(start, start + query.size),
    total: items.length,
  };
}

export async function listSmallModels(
  query: SmallModelListQuery,
): Promise<SmallModelListResult> {
  if (useMock) {
    return filterMockSmallModels(query);
  }

  const response = await http.get<BackendSmallModelListResponse>(
    `${API_PREFIX}/small-model/list`,
    {
      params: {
        page: query.page,
        size: query.size,
        order: query.order ?? "desc",
        rule: query.rule ?? "create_time",
        model_name: query.name ?? "",
        ...(query.modelType && query.modelType !== "all"
          ? { model_type: query.modelType }
          : {}),
      },
    },
  );

  const payload = response.data;

  return {
    items: (payload.data ?? []).map(mapSmallModel),
    total: payload.count ?? 0,
  };
}

export async function createSmallModel(payload: SmallModelSavePayload) {
  if (useMock) {
    mockSmallModels.unshift({
      modelId: `sm-${mockSmallModels.length + 1}`,
      modelName: payload.modelName,
      modelType: payload.modelType,
      adapter: payload.adapter,
      adapterCode: payload.adapterCode,
      embeddingDim: payload.embeddingDim,
      batchSize: payload.batchSize,
      maxTokens: payload.maxTokens,
      maxDocuments: payload.maxDocuments,
      modelConfig: payload.modelConfig,
      createBy: "admin",
      createTime: new Date().toISOString().slice(0, 19).replace("T", " "),
      updateBy: "admin",
      updateTime: new Date().toISOString().slice(0, 19).replace("T", " "),
      operations: ["modify", "delete", "authorize"],
    });
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(
    `${API_PREFIX}/small-model/add`,
    mapSavePayload(payload),
  );

  return response.data;
}

export async function updateSmallModel(payload: SmallModelSavePayload) {
  if (useMock) {
    const index = mockSmallModels.findIndex((item) => item.modelId === payload.modelId);
    if (index >= 0) {
      mockSmallModels[index] = {
        ...mockSmallModels[index],
        modelName: payload.modelName,
        modelType: payload.modelType,
        adapter: payload.adapter,
        adapterCode: payload.adapterCode,
        embeddingDim: payload.embeddingDim,
        batchSize: payload.batchSize,
        maxTokens: payload.maxTokens,
        maxDocuments: payload.maxDocuments,
        modelConfig: payload.modelConfig,
        updateTime: new Date().toISOString().slice(0, 19).replace("T", " "),
      };
    }
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(
    `${API_PREFIX}/small-model/edit`,
    mapSavePayload(payload),
  );

  return response.data;
}

export async function deleteSmallModels(modelIds: string[]) {
  if (useMock) {
    modelIds.forEach((modelId) => {
      const index = mockSmallModels.findIndex((item) => item.modelId === modelId);
      if (index >= 0) {
        mockSmallModels.splice(index, 1);
      }
    });
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(`${API_PREFIX}/small-model/delete`, {
    model_ids: modelIds,
  });

  return response.data;
}

export async function testSmallModel(payload: SmallModelSavePayload) {
  if (useMock) {
    return { status: "ok" };
  }

  const response = await http.post<BackendStatusResponse>(
    `${API_PREFIX}/small-model/test`,
    mapSavePayload(payload),
    { timeout: 600_000 },
  );

  return response.data;
}

export async function getSmallModelRolePermissions(): Promise<string[]> {
  if (useMock) {
    return ["create"];
  }

  try {
    const items = await getResourceOperations([{ id: "*", type: "small_model" }]);
    return items[0]?.operation ?? [];
  } catch {
    return [];
  }
}

export async function getSmallModelItemPermissions(
  modelIds: string[],
): Promise<Record<string, string[]>> {
  if (useMock) {
    return Object.fromEntries(
      modelIds.map((modelId) => [
        modelId,
        mockSmallModels.find((item) => item.modelId === modelId)?.operations ?? [],
      ]),
    );
  }

  if (modelIds.length === 0) {
    return {};
  }

  try {
    const items = await getResourceOperations(
      modelIds.map((modelId) => ({ id: modelId, type: "small_model" })),
    );

    return Object.fromEntries(items.map((item) => [item.id, item.operation ?? []]));
  } catch {
    return {};
  }
}
