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
          {
            concept_groups: [{ id: "group-core", name: "Core" }],
            id: "customer",
            index_status: { state: "available" },
            name: "Customer",
          },
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
      {
        conceptGroups: [{ id: "group-core", name: "Core" }],
        id: "customer",
        indexStatus: { state: "available" },
      },
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

  it("scopes mock overview totals and edges to the selected concept group", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    const { getKnowledgeNetworkOverviewGraph } =
      await import("@/modules/knowledge-network/services/overview-graph.service");

    const result = await getKnowledgeNetworkOverviewGraph("kn-domain-risk", {
      conceptGroupId: "cg-risk-core",
      edgeLimit: 500,
      nodeLimit: 200,
    });

    expect(result.objectTypeTotal).toBe(2);
    expect(result.relationTypeTotal).toBe(2);
    expect(result.graph.nodes.map((node) => node.id)).toEqual(["ot-risk-order", "ot-risk-device"]);
    expect(result.graph.edges.map((edge) => edge.id)).toEqual([
      "rt-risk-bind",
      "rt-risk-bind-by-ip",
    ]);
    expect(result.truncated).toBe(false);
  });

  it("keeps the lifecycle of a deprecated type or relation, and none for an active one", async () => {
    const lifecycle = { reason: "merged", replaced_by: "patient", status: "deprecated" };
    getMock.mockResolvedValue({
      data: {
        edges: [
          { id: "treats", mapping_mode: "direct", name: "Treats", source_id: "a", target_id: "b" },
          {
            id: "treats_old",
            lifecycle,
            mapping_mode: "direct",
            name: "Treats (old)",
            source_id: "a",
            target_id: "b",
          },
        ],
        nodes: [
          { id: "a", name: "A" },
          { id: "b", lifecycle, name: "B" },
        ],
        object_type_total: 2,
        relation_type_total: 2,
        returned_edges: 2,
        returned_nodes: 2,
        snapshot: "snapshot-1",
        truncated: false,
      },
    });
    const { getKnowledgeNetworkOverviewGraph } =
      await import("@/modules/knowledge-network/services/overview-graph.service");

    const { graph } = await getKnowledgeNetworkOverviewGraph("network-1");

    const deprecated = {
      lifecycle: { reason: "merged", replacedBy: "patient", status: "deprecated" },
    };
    expect(graph.nodes.map((node) => node.declarations)).toEqual([undefined, deprecated]);
    expect(graph.edges.map((edge) => edge.declarations)).toEqual([undefined, deprecated]);
  });

  it("keeps a relation's cardinality and constraints, and none for a relation declaring neither", async () => {
    getMock.mockResolvedValue({
      data: {
        edges: [
          {
            cardinality: "many_to_one",
            constraints: { required: ["source"] },
            id: "ordered_by",
            mapping_mode: "direct",
            name: "Ordered by",
            source_id: "a",
            target_id: "b",
          },
          { id: "plain", mapping_mode: "direct", name: "Plain", source_id: "a", target_id: "b" },
        ],
        nodes: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        object_type_total: 2,
        relation_type_total: 2,
        returned_edges: 2,
        returned_nodes: 2,
        snapshot: "snapshot-1",
        truncated: false,
      },
    });
    const { getKnowledgeNetworkOverviewGraph } =
      await import("@/modules/knowledge-network/services/overview-graph.service");

    const { graph } = await getKnowledgeNetworkOverviewGraph("network-1");

    expect(graph.edges.map((edge) => edge.relationDeclarations)).toEqual([
      { cardinality: "many_to_one", requiredEnds: ["source"] },
      undefined,
    ]);
  });
});
