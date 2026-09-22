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

describe("overview-graph.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves indirect relation mapping semantics", async () => {
    getMock.mockResolvedValue({
      data: {
        edges: [
          {
            id: "relation-1",
            mapping_mode: "indirect",
            name: "places",
            source_id: "customer",
            target_id: "order",
          },
        ],
        nodes: [
          { id: "customer", name: "Customer" },
          { id: "order", name: "Order" },
        ],
        object_type_total: 2,
        relation_type_total: 1,
        returned_edges: 1,
        returned_nodes: 2,
        snapshot: "snapshot-1",
        truncated: false,
      },
    });
    const { getKnowledgeNetworkOverviewGraph } =
      await import("@/modules/knowledge-network/services/overview-graph.service");

    const result = await getKnowledgeNetworkOverviewGraph("network-1");

    expect(result.graph.edges[0]).toMatchObject({ mappingMode: "resource" });
  });
});
