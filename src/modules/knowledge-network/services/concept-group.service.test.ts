/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("concept-group.service - listKnowledgeNetworkConceptGroupPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pushes paging and filters to the backend", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ id: "cg-1", name: "Orders", tags: ["core"] }],
        total_count: 31,
      },
    });
    const { listKnowledgeNetworkConceptGroupPage } =
      await import("@/modules/knowledge-network/services/concept-group.service");

    const result = await listKnowledgeNetworkConceptGroupPage("kn-1", {
      direction: "asc",
      limit: 10,
      namePattern: " orders ",
      offset: 20,
      sort: "name",
      tag: "core",
    });

    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn-1/concept-groups", {
      params: {
        direction: "asc",
        limit: 10,
        name_pattern: "orders",
        offset: 20,
        sort: "name",
        tag: "core",
      },
    });
    expect(result.totalCount).toBe(31);
    expect(result.entries[0]).toMatchObject({ id: "cg-1", name: "Orders" });
  });
});
