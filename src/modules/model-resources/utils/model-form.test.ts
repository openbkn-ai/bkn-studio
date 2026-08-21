/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildLlmSavePayload,
  buildSmallModelSavePayload,
  type LlmFormValues,
  type SmallModelFormValues,
} from "@/modules/model-resources/utils/model-form";

const baseValues: LlmFormValues = {
  modelName: " Qwen ",
  modelSeries: "qwen",
  modelType: "llm",
  apiModel: " qwen-plus ",
  apiUrl: " https://example.com ",
  auth: "empty",
  maxModelLen: 32,
  quota: false,
};

describe("buildLlmSavePayload", () => {
  it("keeps valid positive integer model parameters", () => {
    expect(buildLlmSavePayload({ ...baseValues, modelParameters: 7 }).modelParameters).toBe(7);
  });

  it("drops invalid model parameters before sending to the backend", () => {
    expect(buildLlmSavePayload({ ...baseValues, modelParameters: null }).modelParameters).toBeUndefined();
    expect(buildLlmSavePayload({ ...baseValues, modelParameters: 0 }).modelParameters).toBeUndefined();
    expect(buildLlmSavePayload({ ...baseValues, modelParameters: 1.5 }).modelParameters).toBeUndefined();
  });

  it("keeps the requested default selection for model creation", () => {
    expect(buildLlmSavePayload({ ...baseValues, default: true }).default).toBe(true);
  });
});

describe("buildSmallModelSavePayload", () => {
  const values: SmallModelFormValues = {
    modelName: " Qwen embedding ",
    modelType: "embedding",
    adapter: false,
    apiModel: " qwen3-embedding ",
    apiUrl: " https://example.com ",
    auth: "empty",
    batchSize: 32,
    maxTokens: 512,
    embeddingDim: 1024,
    default: true,
  };

  it("keeps the requested default selection for small-model creation", () => {
    expect(buildSmallModelSavePayload(values).default).toBe(true);
  });
});
