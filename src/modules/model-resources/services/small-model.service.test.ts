/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));
vi.mock("@/framework/request/http", () => ({ http: { get: getMock, post: postMock } }));

beforeEach(() => {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  vi.clearAllMocks();
  postMock.mockResolvedValue({ data: { status: "ok" } });
});
afterEach(() => vi.unstubAllEnvs());

const payload = {
  modelName: "reranker",
  modelType: "reranker",
  batchSize: 8,
  maxTokens: 128,
  modelConfig: { apiModel: "test", apiUrl: "https://provider.invalid" },
};

describe("reranker max_documents contract", () => {
  it("sends the limit on create, edit and connection test", async () => {
    const service = await import("./small-model.service");
    for (const save of [
      service.createSmallModel,
      service.updateSmallModel,
      service.testSmallModel,
    ]) {
      await save({ ...payload, maxDocuments: 8 });
      expect(postMock.mock.lastCall?.[1]).toMatchObject({
        max_documents: 8,
        batch_size: 8,
        max_tokens: 128,
      });
    }
  });

  it("clears a reranker limit and excludes it from embedding requests", async () => {
    const { updateSmallModel } = await import("./small-model.service");
    await updateSmallModel(payload);
    expect(postMock.mock.lastCall?.[1]).toHaveProperty("max_documents", null);
    await updateSmallModel({
      ...payload,
      modelType: "embedding",
      embeddingDim: 768,
      maxDocuments: 8,
    });
    expect(postMock.mock.lastCall?.[1]).not.toHaveProperty("max_documents");
    expect(postMock.mock.lastCall?.[1]).toHaveProperty("embedding_dim", 768);
  });

  it("reads saved, cleared and legacy limits", async () => {
    const { listSmallModels } = await import("./small-model.service");
    getMock.mockResolvedValue({
      data: {
        count: 3,
        data: [8, null, undefined].map((limit, index) => ({
          model_id: String(index),
          model_name: "reranker",
          model_type: "reranker",
          max_documents: limit,
        })),
      },
    });
    const result = await listSmallModels({ page: 1, size: 10 });
    expect(result.items.map((item) => item.maxDocuments)).toEqual([8, undefined, undefined]);
  });
});
