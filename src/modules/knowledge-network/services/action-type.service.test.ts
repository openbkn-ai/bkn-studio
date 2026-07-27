/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: vi.fn(), post: postMock },
}));

describe("action-type.service - executeKnowledgeNetworkActionTypeNow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({ data: { execution_id: "execution-1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("submits dynamic_params without the obsolete unique_identities field", async () => {
    const { executeKnowledgeNetworkActionTypeNow } = await import(
      "@/modules/knowledge-network/services/action-type.service"
    );

    await executeKnowledgeNetworkActionTypeNow("kn-1", "action-1", {
      city: "Shanghai",
      limit: 10,
    });

    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-types/action-1/execute",
      {
        dynamic_params: {
          city: "Shanghai",
          limit: 10,
        },
      },
    );
  });

  it("keeps one-click execution for action types without dynamic parameters", async () => {
    const { executeKnowledgeNetworkActionTypeNow } = await import(
      "@/modules/knowledge-network/services/action-type.service"
    );

    await executeKnowledgeNetworkActionTypeNow("kn-1", "action-1");

    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-types/action-1/execute",
      {},
    );
  });
});
