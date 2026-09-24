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

  it("maps the backend index status instead of the retired indexed boolean", async () => {
    getMock.mockResolvedValue({
      data: {
        edges: [],
        nodes: [
          { id: "customer", index_status: { state: "available" }, name: "Customer" },
          { id: "order", index_status: { state: "unknown" }, name: "Order" },
        ],
        object_type_total: 2,
        relation_type_total: 0,
        returned_edges: 0,
        returned_nodes: 2,
        snapshot: "snapshot-1",
        truncated: false,
      },
    });
    const { getKnowledgeNetworkOverviewGraph } =
      await import("@/modules/knowledge-network/services/overview-graph.service");

    const result = await getKnowledgeNetworkOverviewGraph("network-1");

    expect(result.graph.nodes).toMatchObject([
      { id: "customer", indexStatus: { state: "available" } },
      { id: "order", indexStatus: { state: "unknown" } },
    ]);
  });

  it("keeps mock overview node statuses aligned with their index markers", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    const { getKnowledgeNetworkOverviewGraph } =
      await import("@/modules/knowledge-network/services/overview-graph.service");

    const result = await getKnowledgeNetworkOverviewGraph("kn-domain-risk");

    expect(result.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ot-risk-order", indexStatus: { state: "available" } }),
        expect.objectContaining({ id: "ot-risk-device", indexStatus: { state: "unavailable" } }),
      ]),
    );
  });
});
