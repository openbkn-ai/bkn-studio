/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { listObjectMetricAnswerModels } from "./object-metric-models.service";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { get } }));

describe("listObjectMetricAnswerModels", () => {
  beforeEach(() => get.mockReset());

  it("uses the caller-visible public list and excludes non-chat models", async () => {
    get.mockResolvedValue({
      data: {
        data: [
          { model_id: "chat-1", model_name: "Chat Model", model_type: "llm" },
          { model_id: "embed-1", model_name: "Embedding", model_type: "embedding" },
        ],
      },
    });

    await expect(listObjectMetricAnswerModels()).resolves.toEqual([
      { id: "chat-1", name: "Chat Model" },
    ]);
    expect(get).toHaveBeenCalledWith("/mf-model-manager/v1/llm/list", {
      params: { page: 1, size: 100, model_type: "llm" },
      skipErrorToast: true,
    });
  });
});
