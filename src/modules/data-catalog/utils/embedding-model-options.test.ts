/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findUnregisteredEmbeddingModel,
  isRegisteredEmbeddingModel,
  loadEmbeddingModelOptions,
  pickRegisteredEmbeddingModelId,
} from "@/modules/data-catalog/utils/embedding-model-options";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";

vi.mock("@/modules/model-resources/services/small-model.service", () => ({
  listSmallModels: vi.fn(),
}));

describe("embedding-model-options", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ready state with model_name ids from model management", async () => {
    vi.mocked(listSmallModels).mockResolvedValue({
      items: [
        {
          modelId: "uuid-1",
          modelName: "bge-m3-prod",
          modelType: "embedding",
          embeddingDim: 1024,
        },
      ],
      total: 1,
    });

    const result = await loadEmbeddingModelOptions();
    expect(result.state).toBe("ready");
    expect(result.options).toEqual([
      { id: "bge-m3-prod", name: "bge-m3-prod", dimensions: 1024 },
    ]);
  });

  it("returns empty state when no embedding models are registered", async () => {
    vi.mocked(listSmallModels).mockResolvedValue({ items: [], total: 0 });

    const result = await loadEmbeddingModelOptions();
    expect(result.state).toBe("empty");
    expect(result.options).toEqual([]);
  });

  it("returns error state instead of fallback options when API fails", async () => {
    vi.mocked(listSmallModels).mockRejectedValue(new Error("network down"));

    const result = await loadEmbeddingModelOptions();
    expect(result.state).toBe("error");
    expect(result.options).toEqual([]);
    expect(result.errorMessage).toContain("network down");
  });

  it("prefers a registered saved model id", () => {
    const options = [
      { id: "model-a", name: "model-a", dimensions: 768 },
      { id: "model-b", name: "model-b", dimensions: 1024 },
    ];
    expect(pickRegisteredEmbeddingModelId(options, "model-b")).toBe("model-b");
    expect(pickRegisteredEmbeddingModelId(options, "missing")).toBe("model-a");
  });

  it("detects orphan saved models", () => {
    const options = [{ id: "model-a", name: "model-a", dimensions: 768 }];
    expect(
      findUnregisteredEmbeddingModel(options, ["bge-m3", "model-a", ""]),
    ).toBe("bge-m3");
    expect(isRegisteredEmbeddingModel("model-a", options)).toBe(true);
    expect(isRegisteredEmbeddingModel("bge-m3", options)).toBe(false);
  });
});
