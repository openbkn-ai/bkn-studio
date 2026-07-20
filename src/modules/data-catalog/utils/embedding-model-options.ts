/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import type { EmbeddingModelOption } from "@/modules/data-catalog/types/data-catalog";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";

export type EmbeddingModelsLoadState = "idle" | "loading" | "ready" | "empty" | "error";

export type EmbeddingModelsLoadResult = {
  errorMessage: string | null;
  options: EmbeddingModelOption[];
  state: EmbeddingModelsLoadState;
};

/**
 * Load embedding models from model management. Never fabricates fallback options —
 * callers must treat empty/error as blocking states for vector index configuration.
 */
export async function loadEmbeddingModelOptions(): Promise<EmbeddingModelsLoadResult> {
  try {
    const result = await listSmallModels({
      modelType: "embedding",
      page: 1,
      size: 100,
    });
    const options = result.items
      .filter((item) => item.modelType === "embedding")
      .map((item) => ({
        dimensions: item.embeddingDim ?? 1024,
        // Vega validates against mf-model-manager model_name (not a client-side alias).
        id: item.modelName.trim(),
        name: item.modelName.trim(),
      }))
      .filter((item) => item.id.length > 0);

    if (options.length === 0) {
      return { state: "empty", options: [], errorMessage: null };
    }

    return { state: "ready", options, errorMessage: null };
  } catch (error) {
    return {
      state: "error",
      options: [],
      errorMessage: extractRequestErrorMessage(error),
    };
  }
}

/** Pick a default model id that exists in the registry. */
export function pickRegisteredEmbeddingModelId(
  options: EmbeddingModelOption[],
  preferred?: string,
): string | undefined {
  const trimmed = preferred?.trim();
  if (trimmed && options.some((item) => item.id === trimmed)) {
    return trimmed;
  }

  return options[0]?.id;
}

export function isRegisteredEmbeddingModel(
  modelId: string | undefined | null,
  options: EmbeddingModelOption[],
): boolean {
  const trimmed = modelId?.trim();
  if (!trimmed) {
    return false;
  }
  return options.some((item) => item.id === trimmed);
}

/** Saved resource config references a model that is not in the current registry. */
export function findUnregisteredEmbeddingModel(
  options: EmbeddingModelOption[],
  candidates: Array<string | undefined | null>,
): string | null {
  const registered = new Set(options.map((item) => item.id));
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !registered.has(trimmed)) {
      return trimmed;
    }
  }
  return null;
}
