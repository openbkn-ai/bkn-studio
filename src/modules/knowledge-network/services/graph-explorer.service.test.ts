/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_RRF_OPTIONS,
  buildInstanceId,
  buildKnSearchBody,
  capIncomingNodes,
  edgesAmong,
  effectiveLabelsFrom,
  keyValueFor,
  knSearchInstances,
  meetInTheMiddle,
  needsKnSearch,
  parseIdList,
  createGraphExplorerClient,
  fromExploreSubgraph,
  fromQueryObjectInstance,
  friendlyError,
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
  orientEdges,
  collectSubgraphByIds,
  type GraphExplorerClient,
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

describe("meetInTheMiddle", () => {
  const rel = (id: string, s: string, t: string) => ({ relation_type_id: id, relation_type_name: id, source_object_id: s, target_object_id: t });
  it("joins a chain from each side at the first shared node, keeping relation directions", () => {
    const fromA = [{ relations: [rel("r1", "A", "T")] }];
    const fromB = [{ relations: [rel("r2", "B", "T")] }];
    expect(meetInTheMiddle(fromA, "A", fromB, "B")).toEqual([rel("r1", "A", "T"), rel("r2", "B", "T")]);
  });
  it("prefers the shortest total and handles a direct hit from B's side", () => {
    const fromA = [{ relations: [rel("r1", "A", "X"), rel("r2", "X", "Y"), rel("r3", "Y", "Z")] }];
    const fromB = [{ relations: [rel("r4", "B", "Z")] }, { relations: [rel("r5", "B", "A")] }];
    expect(meetInTheMiddle(fromA, "A", fromB, "B")).toEqual([rel("r5", "B", "A")]);
  });
  it("returns null when the explorations never touch", () => {
    expect(meetInTheMiddle([{ relations: [rel("r", "A", "X")] }], "A", [{ relations: [rel("r", "B", "Y")] }], "B")).toBeNull();
    expect(meetInTheMiddle([], "A", [], "A")).toBeNull();
  });
});

describe("effectiveLabelsFrom", () => {
  it("takes the display key per type and lets the user override it", () => {
    const metas = { a: { id: "a", name: "a", primaryKeys: ["k"], properties: [], displayKey: "title" }, b: { id: "b", name: "b", primaryKeys: ["k"], properties: [] } };
    expect(effectiveLabelsFrom(metas, { b: "code", a: "name" })).toEqual({ a: "name", b: "code" });
    expect(effectiveLabelsFrom(metas, {})).toEqual({ a: "title" });
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

describe("capIncomingNodes", () => {
  const node = (id: string): GNode => ({ id, otId: "ot", otName: "ot", identity: {}, display: id, props: {} });

  it("fills the remaining room and reports what was dropped, keeping already-present nodes", () => {
    const result = capIncomingNodes([node("a"), node("x"), node("y"), node("z")], new Set(["a", "b"]), 4);
    expect(result.nodes.map((n) => n.id)).toEqual(["a", "x", "y"]);
    expect(result.dropped).toBe(1);
    expect(capIncomingNodes([node("q")], new Set(["a"]), 1)).toEqual({ nodes: [], dropped: 1 });
  });
});

describe("parseIdList", () => {
  it("resolves instance ids by the longest object type prefix and falls back to the selected type", () => {
    const parsed = parseIdList("product-e68c\nproduct_line-7, knowledge-abc;knowledge-abc\n12345\n", ["product", "product_line", "knowledge"], "block");
    expect(parsed.items).toEqual([
      { otId: "product", key: "e68c" },
      { otId: "product_line", key: "7" },
      { otId: "knowledge", key: "abc" },
      { otId: "block", key: "12345" },
    ]);
    expect(parsed.unknown).toEqual([]);
  });

  it("reports raw keys as unknown when no object type is selected", () => {
    expect(parseIdList("12345\nproduct-x", ["product"])).toEqual({ items: [{ otId: "product", key: "x" }], unknown: ["12345"] });
  });
});

describe("keyValueFor / edgesAmong", () => {
  it("types numeric keys and keeps strings", () => {
    expect(keyValueFor({ id: "a", name: "a", primaryKeys: ["k"], properties: [{ name: "k", type: "integer" }] }, "42")).toBe(42);
    expect(keyValueFor({ id: "a", name: "a", primaryKeys: ["k"], properties: [{ name: "k", type: "string" }] }, "42")).toBe("42");
  });

  it("keeps only edges with both ends in the set", () => {
    const edge = (s: string, t: string): GEdge => ({ id: `${s}|r|${t}`, source: s, target: t, relTypeId: "r", relTypeName: "r" });
    expect(edgesAmong([edge("a", "b"), edge("a", "z")], new Set(["a", "b"])).map((e) => e.id)).toEqual(["a|r|b"]);
  });
});

describe("kn_search routing", () => {
  it("only leaves the MCP tool when a fusion knob differs from the backend default", () => {
    expect(needsKnSearch(undefined)).toBe(false);
    expect(needsKnSearch({ ...DEFAULT_RRF_OPTIONS })).toBe(false);
    expect(needsKnSearch({ ...DEFAULT_RRF_OPTIONS, knnWeight: 0.7 })).toBe(true);
    expect(needsKnSearch({ ...DEFAULT_RRF_OPTIONS, rerankMode: "shadow" })).toBe(true);
  });

  it("maps scope and fusion knobs onto retrieval_config", () => {
    expect(
      buildKnSearchBody("kn1", "q", { objectTypes: ["a", "b", "c"], conceptGroups: ["cg"], maxObjectTypes: 2, maxInstancesPerType: 7 }, { ...DEFAULT_RRF_OPTIONS, rrfK: 30, knnWeight: 0.8, rerankMode: "shadow" }),
    ).toEqual({
      query: "q",
      kn_id: "kn1",
      only_schema: false,
      retrieval_config: {
        concept_retrieval: { top_k: 3, object_types: ["a", "b", "c"], concept_groups: ["cg"] },
        semantic_instance_retrieval: {
          per_type_instance_limit: 7,
          enable_rrf_fusion: true,
          enable_knn_instance_retrieval: true,
          rrf_k: 30,
          knn_weight: 0.8,
          initial_candidate_count: 50,
          min_direct_relevance: 0.3,
          instance_rerank_mode: "shadow",
        },
      },
    });
  });
});

describe("createGraphExplorerClient", () => {
  const env = { base: "https://studio.example.com/", token: "", knId: "kn1" };
  const auth = { getToken: () => "tok" };
  const REST = "https://studio.example.com/api/agent-retrieval/v1/kn";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Answers every request with `payload`; the spy records what each call sent. */
  function mockFetch(payload: unknown, status = 200) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status })));
  }

  function sent(spy: ReturnType<typeof mockFetch>, index = 0): { url: string; body: Record<string, unknown>; headers: Record<string, string> } {
    const [url, init] = spy.mock.calls[index];
    return { url: url as string, body: JSON.parse(init?.body as string) as Record<string, unknown>, headers: init?.headers as Record<string, string> };
  }

  it("posts get_object_types with kn_id and ids in the body", async () => {
    const spy = mockFetch({ kn_id: "kn1", object_types: [{ id: "ot_a", name: "A", primary_keys: ["k"], data_properties: [{ name: "k", type: "string" }] }] });
    const metas = await createGraphExplorerClient(env, auth).loadObjectTypes(["ot_a"]);
    expect(sent(spy)).toMatchObject({ url: `${REST}/get_object_types?response_format=json`, body: { kn_id: "kn1", ids: ["ot_a"] } });
    expect(sent(spy).headers).toMatchObject({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    expect(metas).toEqual([{ id: "ot_a", name: "A", primaryKeys: ["k"], properties: [{ name: "k", displayName: undefined, type: "string" }] }]);
  });

  it("skips get_object_types when no id is asked for", async () => {
    const spy = mockFetch({ object_types: [] });
    await expect(createGraphExplorerClient(env, auth).loadObjectTypes([])).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("puts kn_id in the query string of query_instance_subgraph", async () => {
    const spy = mockFetch({ entries: [] });
    const paths = [{ object_types: [{ id: "a" }, { id: "b" }], relation_types: [{ relation_type_id: "r", source_object_type_id: "a", target_object_type_id: "b" }] }];
    await createGraphExplorerClient(env, auth).queryInstanceSubgraph(paths);
    expect(sent(spy)).toMatchObject({ url: `${REST}/query_instance_subgraph?kn_id=kn1&response_format=json`, body: { relation_type_paths: paths } });
    expect(Object.keys(sent(spy).body)).toEqual(["relation_type_paths"]);
  });

  it("puts kn_id in the query string of explore_subgraph and the walk in the body", async () => {
    const spy = mockFetch({ objects: {}, relation_paths: [] });
    await createGraphExplorerClient(env, auth).exploreSubgraph({
      sourceOtId: "ot_supplier",
      condition: { field: "supplier_id", operation: "==", value: 42 },
      direction: "forward",
      pathLength: 2,
    });
    expect(sent(spy).url).toBe(`${REST}/explore_subgraph?kn_id=kn1&response_format=json`);
    expect(sent(spy).body).toEqual({
      source_object_type_id: "ot_supplier",
      direction: "forward",
      path_length: 2,
      condition: { field: "supplier_id", operation: "==", value: 42 },
      limit: 1,
    });
  });

  it("limits search_instance to the chosen object types", async () => {
    const spy = mockFetch({ nodes: [] });
    const client = createGraphExplorerClient(env, auth);
    await client.searchInstances("q");
    await client.searchInstances("q", { objectTypes: ["ot_a", "ot_b"] });
    await client.searchInstances("q", { excludeObjectTypes: ["ot_x"], conceptGroups: ["cg1"], maxInstancesPerType: 5, maxObjectTypes: 3, rerank: true });
    // A key passed as undefined (an optional argument forwarded as is) must keep its default, not erase it.
    await client.searchInstances("q", { objectTypes: undefined, maxInstancesPerType: 3 });
    expect(sent(spy, 0).url).toBe(`${REST}/search_instance?response_format=json`);
    expect(sent(spy, 0).body).toEqual({ kn_id: "kn1", query: "q", max_instances_per_type: 20 });
    expect(sent(spy, 1).body).toEqual({ kn_id: "kn1", query: "q", max_instances_per_type: 20, object_types: ["ot_a", "ot_b"] });
    expect(sent(spy, 2).body).toEqual({
      kn_id: "kn1",
      query: "q",
      max_instances_per_type: 5,
      exclude_object_types: ["ot_x"],
      concept_groups: ["cg1"],
      max_object_types: 3,
      rerank: true,
    });
    expect(sent(spy, 3).body).toEqual({ kn_id: "kn1", query: "q", max_instances_per_type: 3 });
  });

  it("puts kn_id and ot_id in the query string of query_object_instance and pages only when offset is positive", async () => {
    const spy = mockFetch({ datas: [] });
    const client = createGraphExplorerClient(env, auth);
    await client.queryInstances("ot_a", null, 50, 0);
    await client.queryInstances("ot_a", { field: "k", operation: "in", value: [1, 2] }, 2, 50);
    expect(sent(spy, 0).url).toBe(`${REST}/query_object_instance?kn_id=kn1&ot_id=ot_a&response_format=json`);
    expect(sent(spy, 0).body).toEqual({ limit: 50 });
    expect(sent(spy, 1).body).toEqual({ limit: 2, condition: { field: "k", operation: "in", value: [1, 2] }, offset: 50 });
  });

  it("posts run_cypher with kn_id and the query in the body and keeps only well-formed rows", async () => {
    const spy = mockFetch({ columns: [{ name: "a", type: "node" }, { name: 7 }], entries: [{ a: 1 }, "junk"] });
    const result = await createGraphExplorerClient(env, auth).runCypher("MATCH (a:x) RETURN a");
    expect(sent(spy)).toMatchObject({ url: `${REST}/run_cypher?response_format=json`, body: { kn_id: "kn1", query: "MATCH (a:x) RETURN a" } });
    expect(result).toEqual({ columns: [{ name: "a", type: "node" }, { name: "7", type: undefined }], entries: [{ a: 1 }] });
  });

  it("never sends bkn_context or a body response_format, so no interaction is opened", async () => {
    const spy = mockFetch({ entries: [], object_types: [], nodes: [], datas: [], objects: {}, columns: [] });
    const client = createGraphExplorerClient(env, auth);
    await client.loadObjectTypes(["ot_a"]);
    await client.queryInstanceSubgraph([]);
    await client.exploreSubgraph({ sourceOtId: "a", condition: { field: "k", operation: "==", value: 1 }, direction: "backward", pathLength: 1 });
    await client.searchInstances("q");
    await client.queryInstances("a", null, 10);
    await client.runCypher("MATCH (a:x)");
    expect(spy).toHaveBeenCalledTimes(6);
    for (let index = 0; index < 6; index += 1) {
      const { url, body } = sent(spy, index);
      expect(body).not.toHaveProperty("bkn_context");
      expect(body).not.toHaveProperty("response_format");
      expect(url).not.toContain("bkn_context");
    }
  });

  it("unwraps a data envelope", async () => {
    mockFetch({ data: { object_types: [{ id: "ot_a", name: "A", primary_keys: ["k"] }] } });
    const metas = await createGraphExplorerClient(env, auth).loadObjectTypes(["ot_a"]);
    expect(metas).toEqual([{ id: "ot_a", name: "A", primaryKeys: ["k"], properties: [] }]);
  });

  it("surfaces the error body of a failed call so friendlyError can read it", async () => {
    const envelope = JSON.stringify({ description: "调用依赖服务异常", details: "boom" });
    mockFetch(envelope, 500);
    const error = await createGraphExplorerClient(env, auth).searchInstances("x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(envelope);
    expect(friendlyError(error)).toBe("调用依赖服务异常：boom");
  });

  it("names the tool and status when a failed call has no body", async () => {
    mockFetch("", 502);
    await expect(createGraphExplorerClient(env, auth).exploreSubgraph({ sourceOtId: "a", condition: { field: "k", operation: "==", value: 1 }, direction: "forward", pathLength: 1 })).rejects.toThrow(
      "explore_subgraph failed (502)",
    );
  });

  it("retries once with a refreshed token after 401", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ nodes: [] }), { status: 200 }));
    await createGraphExplorerClient(env, { getToken: () => "old", refresh: () => Promise.resolve("new") }).searchInstances("q");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(sent(spy, 1).headers).toMatchObject({ Authorization: "Bearer new" });
  });
});

describe("knSearchInstances", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the fusion body to kn_search without bkn_context", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ nodes: [], object_types: [] }), { status: 200 }));
    const rrf = { ...DEFAULT_RRF_OPTIONS, rrfK: 30 };
    await knSearchInstances({ base: "https://studio.example.com", token: "t", knId: "kn1" }, undefined, "q", {}, rrf);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://studio.example.com/api/agent-retrieval/v1/kn/kn_search?response_format=json");
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body).toEqual(buildKnSearchBody("kn1", "q", {}, rrf));
    expect(body).not.toHaveProperty("bkn_context");
  });
});

describe("friendlyError", () => {
  it("unwraps the downstream envelope embedded in the Context Loader details", () => {
    const downstream = JSON.stringify({ error_code: "VegaBackend.Resource.NotFound", description: "数据资源不存在", solution: "请检查数据资源ID", error_details: "" });
    const outer = JSON.stringify({
      code: "agentRetrieval.InternalServerError.CommonExternalServerError",
      description: "调用依赖服务异常",
      solution: "Please check the service",
      details: `Exception(http do error, method: POST, url: http://ontology-query-svc:13018/x, http status: 500, error: ${downstream})`,
    });
    expect(friendlyError(new Error(outer))).toBe("调用依赖服务异常：数据资源不存在（请检查数据资源ID）");
  });

  it("reaches the innermost envelope through three layers, as ontology-query wraps bkn-backend", () => {
    const outer = JSON.stringify({
      code: "agentRetrieval.InternalServerError.CommonExternalServerError",
      description: "调用依赖服务异常",
      solution: "Please check the service",
      details:
        'Exception(http do error, method: POST, url: http://ontology-query-svc:13018/x, http status: 500, error: {"error_code":"OntologyQuery.ObjectType.InternalError.GetObjectTypesByIDFailed","description":"按id获取对象类信息失败","solution":"请重试该操作","error_link":"暂无","error_details":"get relation type paths failed: {\\"error_code\\":\\"BknBackend.KnowledgeNetwork.NotFound\\",\\"description\\":\\"业务知识网络不存在\\",\\"solution\\":\\"请检查参数是否正确。\\",\\"error_link\\":\\"\\",\\"error_details\\":\\"Knowledge network[] not found\\"}"})',
    });
    expect(friendlyError(new Error(outer))).toBe("调用依赖服务异常：业务知识网络不存在（请检查参数是否正确。）");
  });

  it("unwraps a downstream envelope whose quotes arrive escaped", () => {
    const outer = JSON.stringify({
      code: "agentRetrieval.InternalServerError.CommonExternalServerError",
      description: "调用依赖服务异常",
      details:
        'Exception(http do error, method: POST, url: http://ontology-query-svc:13018/x, http status: 500, error: {"error_code":"OntologyQuery.Internal","description":"内部错误","error_details":"query object failed: {\\"error_code\\":\\"VegaBackend.Resource.NotFound\\",\\"description\\":\\"数据资源不存在\\",\\"solution\\":\\"请检查数据资源ID\\",\\"error_link\\":\\"\\",\\"error_details\\":\\"\\"}"})',
    });
    expect(friendlyError(new Error(outer))).toBe("调用依赖服务异常：数据资源不存在（请检查数据资源ID）");
  });

  it("falls back to the description and a detail tail when there is no inner envelope", () => {
    expect(friendlyError(new Error(JSON.stringify({ description: "内部错误", details: "QueryDatasetData returned HTTP 500" })))).toBe("内部错误：QueryDatasetData returned HTTP 500");
    expect(friendlyError(new Error(JSON.stringify({ error: { message: "conversation_id is required" } })))).toBe("conversation_id is required");
  });

  it("returns plain messages untouched", () => {
    expect(friendlyError(new Error("boom"))).toBe("boom");
    expect(friendlyError("text")).toBe("text");
  });
});

describe("collectSubgraphByIds", () => {
  const meta = { id: "a", name: "A", primaryKeys: ["id"], properties: [] };
  const metas = { a: meta, b: { ...meta, id: "b", name: "B" } };
  const relations = Array.from({ length: 6 }, (_, index) => ({ id: `rel${index}`, sourceId: "a", targetId: "b" }));

  it("retries a failed batch one path at a time so one bad relation type costs only its own edges", async () => {
    const calls: string[][] = [];
    const client = {
      queryInstances: vi.fn(() => Promise.resolve({ datas: [{ id: "1", _instance_identity: { id: "1" } }] })),
      queryInstanceSubgraph: vi.fn((paths: { relation_types: { relation_type_id: string }[] }[]) => {
        const names = paths.map((path) => path.relation_types[0].relation_type_id);
        calls.push(names);
        if (names.includes("rel3")) return Promise.reject(new Error("请求参数不合法"));
        return Promise.resolve({ entries: [] });
      }),
    } as unknown as GraphExplorerClient;
    const result = await collectSubgraphByIds(client, [{ otId: "a", key: "1" }, { otId: "b", key: "1" }], metas, relations, {});
    // First batch of five fails on rel3, so those five are retried alone; the sixth batch is fine.
    expect(calls[0]).toEqual(["rel0", "rel1", "rel2", "rel3", "rel4"]);
    expect(calls.slice(1, 6).map((names) => names[0])).toEqual(["rel0", "rel1", "rel2", "rel3", "rel4"]);
    const failures = (result.raw.paths as { error?: string }[]).filter((entry) => entry.error);
    expect(failures).toHaveLength(1);
  });
});

describe("pickDisplay", () => {
  it("prefers the tidied text over the raw one", () => {
    expect(pickDisplay({ text: "**原文** 带标记", text_clean: "原文带标记" }, "a-1")).toBe("原文带标记");
    expect(pickDisplay({ text: "只有原文" }, "a-1")).toBe("只有原文");
  });

  it("keeps the configured and conventional names ahead of any text", () => {
    expect(pickDisplay({ name: "名称", text_clean: "正文" }, "a-1")).toBe("名称");
    expect(pickDisplay({ title: "标题", text_clean: "正文" }, "a-1")).toBe("标题");
    expect(pickDisplay({ description: "说明", text_clean: "正文" }, "a-1")).toBe("说明");
    expect(pickDisplay({ title: "标题", description: "说明" }, "a-1")).toBe("标题");
    expect(pickDisplay({ topic: "主题", description: "说明", text_clean: "正文" }, "a-1")).toBe("主题");
    expect(pickDisplay({ title: "标题", topic: "主题" }, "a-1")).toBe("标题");
    expect(pickDisplay({ Topic: "主题", Description: "说明" }, "a-1")).toBe("主题");
    expect(pickDisplay({ text_clean: "正文", note: "别的" }, "a-1", "note")).toBe("别的");
  });

  it("matches the property names whatever their case", () => {
    expect(pickDisplay({ Title: "标题" }, "a-1")).toBe("标题");
    expect(pickDisplay({ Description: "说明", Text: "正文" }, "a-1")).toBe("说明");
    expect(pickDisplay({ TEXT: "原文", Text_Clean: "清洗后" }, "a-1")).toBe("清洗后");
    expect(pickDisplay({ Note: "别的" }, "a-1", "note")).toBe("别的");
  });

  it("falls back to the id and then to the node id", () => {
    expect(pickDisplay({ id: "abc" }, "a-1")).toBe("abc");
    expect(pickDisplay({}, "a-1")).toBe("a-1");
  });
});

describe("orientEdges", () => {
  const relations = new Map([
    ["rel_squads_tournament", { id: "rel_squads_tournament", sourceOtId: "squads", targetOtId: "tournaments" }],
    ["rel_person_person", { id: "rel_person_person", sourceOtId: "person", targetOtId: "person" }],
  ]);
  const otOf = (id: string) => id.split("-")[0];
  const edge = (source: string, rel: string, target: string) => ({ id: `${source}|${rel}|${target}`, source, target, relTypeId: rel, relTypeName: rel });

  it("swaps an edge reported against its declared direction and rebuilds its id", () => {
    const [out] = orientEdges([edge("tournaments-1", "rel_squads_tournament", "squads-10")], relations, otOf);
    expect(out).toMatchObject({ id: "squads-10|rel_squads_tournament|tournaments-1", source: "squads-10", target: "tournaments-1" });
  });

  it("keeps edges already in the declared direction, self-relations and unknown relation types", () => {
    const kept = [
      edge("squads-10", "rel_squads_tournament", "tournaments-1"),
      edge("person-2", "rel_person_person", "person-1"),
      edge("tournaments-1", "rel_unknown", "squads-10"),
    ];
    expect(orientEdges(kept, relations, otOf)).toEqual(kept);
  });
});
