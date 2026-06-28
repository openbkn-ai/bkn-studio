import { describe, expect, it } from "vitest";

import {
  CONTEXT_LOADER_OPS,
  buildTestData,
  opSupportsTestData,
  pickQueryableObjectType,
  type KnDetail,
  type KnObjectType,
} from "@/modules/knowledge-network/services/context-loader.service";

const opById = (id: string) => CONTEXT_LOADER_OPS.find((o) => o.id === id)!;

const ot = (id: string, fields: string[], resourceId?: string): KnObjectType => ({
  id,
  name: id,
  data_source: resourceId ? { id: resourceId } : null,
  data_properties: fields.map((name) => ({ name })),
});

const detail = (objectTypes: KnObjectType[], groups: { id: string }[] = []): KnDetail => ({
  id: "kn_demo",
  name: "demo",
  object_types: objectTypes,
  concept_groups: groups.map((g) => ({ id: g.id })),
});

describe("opSupportsTestData", () => {
  it("covers data ops, excludes relation/action/metric ops", () => {
    expect(opSupportsTestData("query_object_instance")).toBe(true);
    expect(opSupportsTestData("run_sql")).toBe(true);
    expect(opSupportsTestData("search_schema")).toBe(true);
    expect(opSupportsTestData("get_kn_detail")).toBe(true);
    expect(opSupportsTestData("query_instance_subgraph")).toBe(false);
    expect(opSupportsTestData("find_skills")).toBe(false);
    expect(opSupportsTestData("get_action_info")).toBe(false);
  });
});

describe("pickQueryableObjectType", () => {
  it("returns the first object type with a bound resource", () => {
    const d = detail([ot("a", ["x"]), ot("b", ["y"], "res_b"), ot("c", ["z"], "res_c")]);
    expect(pickQueryableObjectType(d)?.id).toBe("b");
  });

  it("returns null when nothing has a resource", () => {
    expect(pickQueryableObjectType(detail([ot("a", ["x"]), ot("b", ["y"])]))).toBeNull();
  });
});

describe("buildTestData", () => {
  const d = detail([ot("orders", ["status", "amount"], "res_orders")], [{ id: "grp_sales" }]);

  it("get_kn_detail fills only kn_id", () => {
    const fill = buildTestData(opById("get_kn_detail"), "rest", "kn_demo", d, null, null);
    expect(JSON.parse(fill.body)).toEqual({ kn_id: "kn_demo" });
  });

  it("search_schema injects a real concept group when present", () => {
    const fill = buildTestData(opById("search_schema"), "rest", "kn_demo", d, null, null);
    const body = JSON.parse(fill.body);
    expect(body.kn_id).toBe("kn_demo");
    expect(body.search_scope.concept_groups).toEqual(["grp_sales"]);
  });

  it("search_schema leaves concept_groups empty when none exist", () => {
    const noGroups = detail([ot("orders", ["status"], "res_orders")]);
    const fill = buildTestData(opById("search_schema"), "rest", "kn_demo", noGroups, null, null);
    expect(JSON.parse(fill.body).search_scope.concept_groups).toEqual([]);
  });

  it("run_sql references the resource via dotted template placeholder", () => {
    const resOt = pickQueryableObjectType(d);
    const fill = buildTestData(opById("run_sql"), "rest", "kn_demo", d, resOt, null);
    expect(JSON.parse(fill.body).sql).toBe("SELECT * FROM {{.res_orders}} LIMIT 10");
  });

  it("query_object_instance (REST) filters by a real field+value from the sample row", () => {
    const resOt = pickQueryableObjectType(d);
    const fill = buildTestData(opById("query_object_instance"), "rest", "kn_demo", d, resOt, {
      _instance_id: "i1",
      status: "paid",
      amount: 99,
    });
    const body = JSON.parse(fill.body);
    expect(body.filters).toEqual([{ field: "status", op: "==", value: "paid" }]);
    expect(body.limit).toBe(10);
    expect(fill.query).toEqual({ kn_id: "kn_demo", ot_id: "orders" });
  });

  it("query_object_instance skips null/empty fields when choosing the filter", () => {
    const resOt = pickQueryableObjectType(d);
    const fill = buildTestData(opById("query_object_instance"), "rest", "kn_demo", d, resOt, {
      status: "  ",
      amount: 42,
    });
    expect(JSON.parse(fill.body).filters).toEqual([{ field: "amount", op: "==", value: 42 }]);
  });

  it("query_object_instance (REST) omits filters when no sample row is available", () => {
    const resOt = pickQueryableObjectType(d);
    const fill = buildTestData(opById("query_object_instance"), "rest", "kn_demo", d, resOt, null);
    const body = JSON.parse(fill.body);
    expect(body.filters).toBeUndefined();
    expect(fill.query).toEqual({ kn_id: "kn_demo", ot_id: "orders" });
  });

  it("query_object_instance (MCP) puts kn_id/ot_id/filters in the arguments body", () => {
    const resOt = pickQueryableObjectType(d);
    const fill = buildTestData(opById("query_object_instance"), "mcp", "kn_demo", d, resOt, {
      status: "paid",
    });
    const body = JSON.parse(fill.body);
    expect(body).toMatchObject({
      kn_id: "kn_demo",
      ot_id: "orders",
      include_logic_params: false,
      filters: [{ field: "status", op: "==", value: "paid" }],
    });
    expect(fill.query).toBeUndefined();
  });
});
