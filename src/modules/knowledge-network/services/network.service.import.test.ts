/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { post: postMock },
}));

describe("importKnowledgeNetwork", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves bindings by default", async () => {
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await importKnowledgeNetwork({ id: "orders" });

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks",
      { id: "orders", validate_dependency: false },
      {
        params: {
          binding_policy: "preserve",
          import_mode: undefined,
          validate_dependency: false,
        },
      },
    );
  });

  it("requests detached bindings for cross-environment import", async () => {
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await importKnowledgeNetwork({ id: "orders" }, "overwrite", "detach");

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks",
      { id: "orders", validate_dependency: false },
      {
        params: {
          binding_policy: "detach",
          import_mode: "overwrite",
          validate_dependency: false,
        },
      },
    );
  });

  it.each([
    "BknBackend.KnowledgeNetwork.KNIDExisted",
    "BknBackend.KnowledgeNetwork.KNNameExisted",
    "OntologyManager.KnowledgeNetwork.KNIDExisted",
    "OntologyManager.KnowledgeNetwork.KNNameExisted",
  ])("turns %s into an import conflict", async (errorCode) => {
    postMock.mockRejectedValue({
      response: {
        data: {
          description: "The knowledge network already exists.",
          error_code: errorCode,
        },
      },
    });
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await expect(importKnowledgeNetwork({ id: "orders" })).rejects.toMatchObject({
      isConflict: true,
    });
  });
});
