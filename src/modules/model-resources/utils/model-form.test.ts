/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildLlmSavePayload, type LlmFormValues } from "@/modules/model-resources/utils/model-form";

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
});
