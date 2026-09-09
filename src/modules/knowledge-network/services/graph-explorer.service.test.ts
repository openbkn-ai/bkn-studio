/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import type { McpSession, McpToolCallResult } from "./context-loader.service";
import {
  buildInstanceId,
  createGraphExplorerClient,
  fromExploreSubgraph,
  fromQueryObjectInstance,
  fromSearchInstance,
  identityCondition,
  mergeGraph,
  objectTypeMetaFrom,
  parseRelationPaths,
  pickDisplay,
  relabel,
  shortestChainTo,
  type GEdge,
  type GNode,
  type ObjectTypeMeta,
} from "./graph-explorer.service";

const supplier: ObjectTypeMeta = {
  id: "ot_supplier",
  name: "供应商",
  primaryKeys: ["supplier_id"],
  properties: [{ name: "supplier_id" }, { name: "name" }, { name: "city" }],
};

const order: ObjectTypeMeta = {
  id: "ot_order",
  name: "订单",
  primaryKeys: ["order_no", "line_no"],
  properties: [{ name: "order_no" }, { name: "line_no" }, { name: "amount" }],
};

describe("buildInstanceId", () => {
  it("mirrors GetObjectID for a single primary key", () => {
    expect(buildInstanceId("ot_supplier", ["supplier_id"], { supplier_id: 42 })).toBe("ot_supplier-42");
  });

  it("joins composite keys in primary_keys order and marks missing keys", () => {
    expect(buildInstanceId("ot_order", ["order_no", "line_no"], { line_no: 3, order_no: "A1" })).toBe("ot_order-A1_3");
    expect(buildInstanceId("ot_order", ["order_no", "line_no"], { order_no: "A1" })).toBe("ot_order-A1___NULL__");
  });

  it("returns null without a primary key", () => {
    expect(buildInstanceId("ot_x", [], { id: 1 })).toBeNull();
  });
});

describe("pickDisplay", () => {
  it("walks the chain _display → display_name → name → id → first property → node id", () => {
    expect(pickDisplay({ _display: "A", display_name: "B", name: "C" }, "nid")).toBe("A");
    expect(pickDisplay({ display_name: "B", name: "C" }, "nid")).toBe("B");
    expect(pickDisplay({ name: "C", id: "D" }, "nid")).toBe("C");
    expect(pickDisplay({ id: 7 }, "nid")).toBe("7");
    expect(pickDisplay({ _instance_id: "x", city: "Shanghai" }, "nid")).toBe("Shanghai");
    expect(pickDisplay({ _instance_id: "x" }, "nid")).toBe("nid");
  });

  it("prefers an explicit label property and falls back when it is empty", () => {
    expect(pickDisplay({ _display: "A", city: "Shanghai" }, "nid", "city")).toBe("Shanghai");
    expect(pickDisplay({ _display: "A", city: "" }, "nid", "city")).toBe("A");
  });
});

describe("identityCondition", () => {
  it("emits one leaf for a single key and an and-group for composite keys", () => {
    expect(identityCondition({ supplier_id: 42 })).toEqual({ field: "supplier_id", operation: "==", value: 42 });
    expect(identityCondition({ order_no: "A1", line_no: 3 })).toEqual({
      operation: "and",
      sub_conditions: [
        { field: "order_no", operation: "==", value: "A1" },
        { field: "line_no", operation: "==", value: 3 },
      ],
    });
    expect(identityCondition({})).toBeNull();
  });
});

describe("objectTypeMetaFrom", () => {
  it("reads id, name, primary keys and data properties", () => {
    expect(
      objectTypeMetaFrom({
        id: "ot_a",
        name: "A",
        primary_keys: ["k"],
        data_properties: [{ name: "k", type: "string" }, { name: "v", display_name: "值" }, { nope: 1 }],
      }),
    ).toEqual({
      id: "ot_a",
      name: "A",
      primaryKeys: ["k"],
      properties: [
        { name: "k", displayName: undefined, type: "string" },
        { name: "v", displayName: "值", type: undefined },
      ],
    });
    expect(objectTypeMetaFrom({ name: "no id" })).toBeNull();
  });
});

describe("fromSearchInstance", () => {
  it("uses the embedded _instance_id when present and rebuilds it otherwise", () => {
    const { nodes, skipped } = fromSearchInstance(
      {
        nodes: [
          {
            object_type_id: "ot_supplier",
            object_type_name: "供应商",
            instance_name: "华东供应",
            unique_identities: { supplier_id: 42 },
            properties: { supplier_id: 42, city: "Shanghai" },
          },
          {
            object_type_id: "ot_order",
            instance_name: "A1-3",
            unique_identities: { order_no: "A1", line_no: 3 },
            properties: { _instance_id: "ot_order-A1_3", amount: 10 },
          },
          {
            object_type_id: "ot_nokey",
            object_type_name: "无主键",
            unique_identities: {},
            properties: { x: 1 },
          },
        ],
      },
      { ot_supplier: supplier, ot_order: order },
    );
    expect(nodes.map((n) => n.id)).toEqual(["ot_supplier-42", "ot_order-A1_3"]);
    expect(nodes[0].display).toBe("华东供应");
    expect(nodes[0].identity).toEqual({ supplier_id: 42 });
    expect(nodes[1].otName).toBe("ot_order");
    expect(skipped).toEqual([{ otId: "ot_nokey", otName: "无主键" }]);
  });
});

describe("fromQueryObjectInstance", () => {
  it("prefers row system fields and rebuilds identity from primary keys", () => {
    const nodes = fromQueryObjectInstance(order, {
      datas: [
        { order_no: "A1", line_no: 3, amount: 10, _instance_id: "ot_order-A1_3", _instance_identity: { order_no: "A1", line_no: 3 }, _display: "A1/3", _score: 1 },
        { order_no: "B2", line_no: 1, amount: 5 },
      ],
    });
    expect(nodes.map((n) => n.id)).toEqual(["ot_order-A1_3", "ot_order-B2_1"]);
    expect(nodes[0].display).toBe("A1/3");
    expect(nodes[0].props).not.toHaveProperty("_score");
    expect(nodes[1].identity).toEqual({ order_no: "B2", line_no: 1 });
    expect(nodes[1].display).toBe("B2");
  });

  it("converges on the same id as a search hit for the same instance", () => {
    const fromQuery = fromQueryObjectInstance(supplier, { datas: [{ supplier_id: 42, city: "Shanghai" }] })[0];
    const fromSearch = fromSearchInstance(
      { nodes: [{ object_type_id: "ot_supplier", unique_identities: { supplier_id: 42 }, properties: {} }] },
      { ot_supplier: supplier },
    ).nodes[0];
    expect(fromQuery.id).toBe(fromSearch.id);
  });
});

const subgraphPayload = {
  objects: {
    "ot_supplier-42": {
      _instance_id: "ot_supplier-42",
      _instance_identity: { supplier_id: 42 },
      _display: "华东供应",
      object_type_id: "ot_supplier",
      object_type_name: "供应商",
      properties: { supplier_id: 42, city: "Shanghai" },
    },
    "ot_order-A1_3": {
      _instance_id: "ot_order-A1_3",
      _instance_identity: { order_no: "A1", line_no: 3 },
      _display: null,
      object_type_id: "ot_order",
      object_type_name: "订单",
      properties: { order_no: "A1", line_no: 3, amount: 10 },
    },
    "ot_product-P9": {
      _instance_id: "ot_product-P9",
      object_type_id: "ot_product",
      object_type_name: "产品",
      properties: { name: "螺栓" },
    },
  },
  isolated_objects: {
    "ot_supplier-43": { _instance_id: "ot_supplier-43", object_type_id: "ot_supplier", object_type_name: "供应商", properties: { city: "Wuhan" } },
  },
  relation_paths: [
    {
      length: 2,
      relations: [
        { relation_type_id: "rt_supplies", relation_type_name: "供货", source_object_id: "ot_supplier-42", target_object_id: "ot_order-A1_3" },
        { relation_type_id: "rt_contains", relation_type_name: "包含", source_object_id: "ot_order-A1_3", target_object_id: "ot_product-P9" },
      ],
    },
    {
      length: 1,
      relations: [
        { relation_type_id: "rt_supplies", relation_type_name: "供货", source_object_id: "ot_supplier-42", target_object_id: "ot_order-A1_3" },
      ],
    },
  ],
};

describe("fromExploreSubgraph", () => {
  it("maps objects to nodes, relations to deduplicated edges, and keeps isolated objects apart", () => {
    const result = fromExploreSubgraph(subgraphPayload);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["ot_order-A1_3", "ot_product-P9", "ot_supplier-42"]);
    expect(result.nodes.find((n) => n.id === "ot_supplier-42")?.display).toBe("华东供应");
    expect(result.nodes.find((n) => n.id === "ot_order-A1_3")?.display).toBe("A1");
    expect(result.nodes.find((n) => n.id === "ot_product-P9")?.display).toBe("螺栓");
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0]).toEqual<GEdge>({
      id: "ot_supplier-42|rt_supplies|ot_order-A1_3",
      source: "ot_supplier-42",
      target: "ot_order-A1_3",
      relTypeId: "rt_supplies",
      relTypeName: "供货",
    });
    expect(result.isolated.map((n) => n.id)).toEqual(["ot_supplier-43"]);
  });

  it("applies a per-object-type label property", () => {
    const result = fromExploreSubgraph(subgraphPayload, { ot_supplier: "city" });
    expect(result.nodes.find((n) => n.id === "ot_supplier-42")?.display).toBe("Shanghai");
  });
});

describe("shortestChainTo", () => {
  const paths = parseRelationPaths(subgraphPayload.relation_paths);

  it("returns the shortest prefix that touches the target", () => {
    const chain = shortestChainTo(paths, "ot_supplier-42", "ot_product-P9");
    expect(chain?.map((r) => r.relation_type_id)).toEqual(["rt_supplies", "rt_contains"]);
    expect(shortestChainTo(paths, "ot_supplier-42", "ot_order-A1_3")?.length).toBe(1);
  });

  it("returns null when the target is unreachable or equals the start", () => {
    expect(shortestChainTo(paths, "ot_supplier-42", "ot_missing")).toBeNull();
    expect(shortestChainTo(paths, "ot_supplier-42", "ot_supplier-42")).toBeNull();
  });
});

describe("mergeGraph", () => {
  const node = (id: string): GNode => ({ id, otId: "ot", otName: "ot", identity: {}, display: id, props: {} });
  const edge = (s: string, t: string): GEdge => ({ id: `${s}|r|${t}`, source: s, target: t, relTypeId: "r", relTypeName: "r" });

  it("adds only unseen nodes and only edges whose endpoints exist", () => {
    const nodes = new Map<string, GNode>([["a", node("a")]]);
    const edges = new Map<string, GEdge>();
    const first = mergeGraph(nodes, edges, { nodes: [node("a"), node("b")], edges: [edge("a", "b"), edge("b", "zzz")] });
    expect(first.addedNodes.map((n) => n.id)).toEqual(["b"]);
    expect(first.addedEdges.map((e) => e.id)).toEqual(["a|r|b"]);
    const second = mergeGraph(nodes, edges, { nodes: [node("b")], edges: [edge("a", "b")] });
    expect(second.addedNodes).toEqual([]);
    expect(second.addedEdges).toEqual([]);
    expect(nodes.size).toBe(2);
    expect(edges.size).toBe(1);
  });
});

describe("relabel", () => {
  it("recomputes display with the new label map", () => {
    const [n] = relabel([{ id: "x", otId: "ot", otName: "ot", identity: {}, display: "old", props: { _display: "d", city: "c" } }], { ot: "city" });
    expect(n.display).toBe("c");
  });
});

describe("createGraphExplorerClient", () => {
  const ok = (structured: unknown): McpToolCallResult => ({ ok: true, text: "", latencyMs: 1, structured, isError: false });

  it("injects kn_id, bkn_context and response_format into every call", async () => {
    const callTool = vi.fn<McpSession["callTool"]>().mockResolvedValue(ok({ objects: {}, relation_paths: [] }));
    const client = createGraphExplorerClient({ callTool }, "kn1");
    const scope = { nextContext: () => ({ conversation_id: "c", interaction_id: "i" }) };
    await client.exploreSubgraph(
      { sourceOtId: "ot_supplier", condition: { field: "supplier_id", operation: "==", value: 42 }, direction: "forward", pathLength: 1 },
      scope,
    );
    expect(callTool).toHaveBeenCalledWith("explore_subgraph", {
      kn_id: "kn1",
      source_object_type_id: "ot_supplier",
      direction: "forward",
      path_length: 1,
      condition: { field: "supplier_id", operation: "==", value: 42 },
      limit: 1,
      response_format: "json",
      bkn_context: { conversation_id: "c", interaction_id: "i" },
    });
  });

  it("falls back to the text body and unwraps a data envelope", async () => {
    const callTool = vi.fn<McpSession["callTool"]>().mockResolvedValue({
      ok: true,
      text: JSON.stringify({ data: { object_types: [{ id: "ot_a", name: "A", primary_keys: ["k"] }] } }),
      latencyMs: 1,
      isError: false,
    });
    const client = createGraphExplorerClient({ callTool }, "kn1");
    const metas = await client.loadObjectTypes(["ot_a"]);
    expect(metas).toEqual([{ id: "ot_a", name: "A", primaryKeys: ["k"], properties: [] }]);
  });

  it("surfaces tool errors as exceptions", async () => {
    const callTool = vi.fn<McpSession["callTool"]>().mockResolvedValue({ ok: true, text: "boom", latencyMs: 1, isError: true });
    const client = createGraphExplorerClient({ callTool }, "kn1");
    await expect(client.searchInstances("x")).rejects.toThrow("boom");
  });
});
