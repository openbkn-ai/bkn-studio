/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, expect, it, vi } from "vitest";
import { http } from "@/framework/request/http";
import {
  getCaseFormOptions,
  getCaseTargetSchema,
  listCaseActionInstances,
  listRelationCheckInstances,
} from "./case-form.service";
import type { EvalCaseResource } from "./m0-run.service";
vi.mock("@/framework/request/http", () => ({ http: { get: vi.fn(), post: vi.fn() } }));
const getSpy = vi.spyOn(http, "get");
const postSpy = vi.spyOn(http, "post");

const get = getSpy;
const resource: EvalCaseResource = {
  id: "fn",
  kind: "function",
  name: "query",
  box_id: "box/a",
  capability_id: "tool?b",
};
beforeEach(() => get.mockReset());
it("uses a network-scoped form contract and propagates read failures", async () => {
  get.mockResolvedValueOnce({ data: { version: 2, predicates: ["exists"] } });
  expect(await getCaseFormOptions("kn/a")).toEqual({ version: 2, predicates: ["exists"] });
  expect(get).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn%2Fa/evals/case-form", {
    skipErrorToast: true,
  });
  get.mockRejectedValueOnce(new Error("forbidden"));
  await expect(getCaseFormOptions("kn")).rejects.toThrow("forbidden");
});
it.each(["function", "api", "mcp", "action", "metric", "relationType", "skill"])(
  "reads the authorized %s contract from the network-scoped form endpoint",
  async (kind) => {
    const target = {
      input: { type: "object", properties: {} },
      available: true,
      help: "Real contract",
    };
    get.mockResolvedValueOnce({ data: { target } });
    expect(await getCaseTargetSchema({ ...resource, kind }, "kn/a")).toEqual(target);
    expect(get).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn%2Fa/evals/case-form", {
      params: { resource_kind: kind, resource_id: "fn" },
      skipErrorToast: true,
    });
  },
);
it("does not turn a source read failure into an empty valid contract", async () => {
  get.mockRejectedValueOnce(new Error("forbidden"));
  await expect(getCaseTargetSchema(resource, "kn")).rejects.toThrow("forbidden");
});

it("loads action instances through the existing query cursor without requiring a total count", async () => {
  postSpy.mockResolvedValueOnce({
    data: { datas: [{ name: "one", _instance_identity: { id: 1 } }], cursor: "next-page" },
  });
  expect(await listCaseActionInstances("kn", "order", "current-page")).toMatchObject({
    nextCursor: "next-page",
    rows: [{ _instance_identity: { id: 1 } }],
  });
  expect(postSpy).toHaveBeenCalledWith(
    "/agent-retrieval/v1/kn/query_object_instance",
    { limit: 20, need_total: false, properties: [], cursor: "current-page" },
    expect.objectContaining({ params: { kn_id: "kn", ot_id: "order", response_format: "json" } }),
  );
});

it("searches all authorized relation instances with typed numeric identities and preserves the cursor", async () => {
  postSpy.mockResolvedValueOnce({ data: { datas: [{ id: 108 }], cursor: "next" } });
  const endpoint = {
    id: "supplier",
    name: "供应商",
    primary_keys: ["id"],
    data_properties: [
      { name: "id", type: "integer" },
      { name: "name", type: "string" },
    ],
  };
  expect(await listRelationCheckInstances("kn", endpoint, "108", "after-search")).toEqual({
    rows: [{ id: 108 }],
    nextCursor: "next",
  });
  expect(postSpy).toHaveBeenLastCalledWith(
    "/agent-retrieval/v1/kn/query_object_instance",
    expect.objectContaining({
      cursor: "after-search",
      need_total: false,
      condition: {
        operation: "or",
        sub_conditions: [
          { field: "name", operation: "like", value_from: "const", value: "%108%" },
          { field: "id", operation: "==", value_from: "const", value: 108 },
        ],
      },
    }),
    expect.anything(),
  );
});
it("searches relation names by substring and treats LIKE metacharacters literally", async () => {
  postSpy.mockResolvedValueOnce({ data: { datas: [] } });
  await listRelationCheckInstances(
    "kn",
    {
      id: "supplier",
      name: "供应商",
      primary_keys: ["id"],
      data_properties: [{ name: "name", type: "string" }],
    },
    "a%_\\b",
  );
  expect(postSpy).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      condition: {
        operation: "or",
        sub_conditions: [
          { field: "name", operation: "like", value_from: "const", value: "%a\\%\\_\\\\b%" },
        ],
      },
    }),
    expect.anything(),
  );
});
it("searches complete composite identities as an exact conjunction", async () => {
  postSpy.mockResolvedValueOnce({ data: { datas: [] } });
  await listRelationCheckInstances(
    "kn",
    { id: "node", name: "节点", primary_keys: ["id", "site"], data_properties: [] },
    '{"id":0,"site":false}',
  );
  expect(postSpy).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      condition: {
        operation: "and",
        sub_conditions: [
          { field: "id", operation: "==", value_from: "const", value: 0 },
          { field: "site", operation: "==", value_from: "const", value: false },
        ],
      },
    }),
    expect.anything(),
  );
});
