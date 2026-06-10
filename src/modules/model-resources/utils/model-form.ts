import type { LlmModel, LlmSavePayload } from "@/modules/model-resources/types/llm";
import type { SmallModel, SmallModelSavePayload } from "@/modules/model-resources/types/small-model";

export type LlmFormValues = {
  modelName: string;
  modelSeries: string;
  modelType: string;
  apiModel: string;
  apiUrl: string;
  auth: "empty" | "auth" | "dual_key";
  apiKey?: string;
  secretKey?: string;
  maxModelLen: number;
  modelParameters?: number;
  quota?: boolean;
};

export type SmallModelFormValues = {
  modelName: string;
  modelType: string;
  adapter?: boolean;
  adapterCode?: string;
  apiModel?: string;
  apiUrl?: string;
  auth?: "empty" | "auth";
  apiKey?: string;
  embeddingDim?: number;
  batchSize?: number;
  maxTokens?: number;
  maxDocuments?: number;
};

export function llmModelToFormValues(record: LlmModel): LlmFormValues {
  const config = record.modelConfig;

  return {
    modelName: record.modelName,
    modelSeries: record.modelSeries,
    modelType: record.modelType,
    apiModel: config?.apiModel ?? "",
    apiUrl: config?.apiUrl ?? "",
    auth: config?.secretKey ? "dual_key" : config?.apiKey ? "auth" : "empty",
    apiKey: config?.apiKey,
    secretKey: config?.secretKey,
    maxModelLen: record.maxModelLen ?? 0,
    modelParameters: record.modelParameters,
    quota: record.quota,
  };
}

export function buildLlmSavePayload(
  values: LlmFormValues,
  source?: LlmModel,
): LlmSavePayload {
  const modelConfig = {
    apiModel: values.apiModel.trim(),
    apiUrl: values.apiUrl.trim(),
    ...(values.auth === "auth" && values.apiKey ? { apiKey: values.apiKey.trim() } : {}),
    ...(values.auth === "dual_key" && values.apiKey ? { apiKey: values.apiKey.trim() } : {}),
    ...(values.auth === "dual_key" && values.secretKey
      ? { secretKey: values.secretKey.trim() }
      : {}),
  };

  const apiKeyChanged =
    values.auth === "auth" || values.auth === "dual_key"
      ? values.apiKey !== source?.modelConfig?.apiKey
      : false;

  return {
    modelId: source?.modelId,
    modelName: values.modelName.trim(),
    modelSeries: values.modelSeries,
    modelType: values.modelType,
    maxModelLen: values.maxModelLen,
    modelParameters: values.modelParameters,
    quota: values.quota,
    modelConfig,
    change: !source || apiKeyChanged,
  };
}

export function smallModelToFormValues(record: SmallModel): SmallModelFormValues {
  const config = record.modelConfig;

  return {
    modelName: record.modelName,
    modelType: record.modelType,
    adapter: record.adapter,
    adapterCode: record.adapterCode,
    apiModel: config?.apiModel,
    apiUrl: config?.apiUrl,
    auth: config?.apiKey ? "auth" : "empty",
    apiKey: config?.apiKey,
    embeddingDim: record.embeddingDim,
    batchSize: record.batchSize,
    maxTokens: record.maxTokens,
    maxDocuments: record.maxDocuments,
  };
}

export function buildSmallModelSavePayload(
  values: SmallModelFormValues,
  source?: SmallModel,
): SmallModelSavePayload {
  const apiKeyChanged = values.auth === "auth" ? values.apiKey !== source?.modelConfig?.apiKey : false;

  if (values.adapter) {
    return {
      modelId: source?.modelId,
      modelName: values.modelName.trim(),
      modelType: values.modelType,
      adapter: true,
      adapterCode: values.adapterCode ?? "",
      embeddingDim: values.embeddingDim,
      batchSize: values.batchSize,
      maxTokens: values.maxTokens,
      maxDocuments: values.maxDocuments,
      change: !source || apiKeyChanged,
    };
  }

  return {
    modelId: source?.modelId,
    modelName: values.modelName.trim(),
    modelType: values.modelType,
    adapter: false,
    embeddingDim: values.embeddingDim,
    batchSize: values.batchSize,
    maxTokens: values.maxTokens,
    maxDocuments: values.maxDocuments,
    modelConfig: {
      apiModel: values.apiModel?.trim() ?? "",
      apiUrl: values.apiUrl?.trim() ?? "",
      ...(values.auth === "auth" && values.apiKey ? { apiKey: values.apiKey.trim() } : {}),
    },
    change: !source || apiKeyChanged,
  };
}
