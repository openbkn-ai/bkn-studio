/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

describe("row-filter-authorization.service HTTP contract", () => {
  afterEach(() => {
    vi.doUnmock("@/framework/request/http");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the dedicated explain endpoint", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        snapshot: {
          object_type_ref: "kn-1/order",
          policy: null,
          revision: null,
          subject: { id: "user-1", type: "user" },
        },
      },
    });
    vi.stubEnv("VITE_USE_MOCK", "false");
    vi.doMock("@/framework/request/http", () => ({ http: { post } }));

    const { explainRowFilter } =
      await import("@/modules/knowledge-network/services/row-filter-authorization.service");
    await explainRowFilter({ id: "user-1", type: "user" }, "kn-1/order");

    expect(post).toHaveBeenCalledWith("/safe/v1/admin/row-filter-policies/explain", {
      object_type_ref: "kn-1/order",
      subject: { id: "user-1", type: "user" },
    });
  });
});
