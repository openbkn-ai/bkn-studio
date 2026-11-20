/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { createApiResourceInput, validateApiResourceInput } from "../lib/api-resource";
import type { ApiResource } from "../types/api-resource";

type RequestOptions = {
  transformRequest: (data: unknown) => string;
  transformResponse: (data: unknown) => unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};
const { get, post, put } = vi.hoisted(() => ({
  get: vi.fn<(url: string, options: RequestOptions) => Promise<{ data: unknown }>>(),
  post: vi.fn<
    (url: string, data: unknown, options: RequestOptions) => Promise<{ data: unknown }>
  >(),
  put: vi.fn<(url: string, data: unknown, options: RequestOptions) => Promise<{ data: unknown }>>(),
}));
vi.mock("@/framework/request/http", () => ({ http: { get, post, put } }));
import {
  apiResourcePayload,
  getApiResource,
  queryApiResource,
  saveApiResource,
} from "./api-resource.service";

function saved(): ApiResource {
  const input = createApiResourceInput("catalog");
  return {
    ...input,
    id: "resource",
    category: "api",
    api_effect_type: "read",
    name: "Orders",
    source_identifier: "orders",
    update_time: 100,
    status: "active",
    operations: ["query_data"],
    schema_definition: [
      {
        name: "amount",
        original_name: "AMOUNT",
        type: "decimal",
        attributes: { precision: 30, scale: 0, extension: "keep" },
        condition_constraints: { operations: ["eq"] },
      },
    ],
  };
}

describe("API Resource service", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    vi.clearAllMocks();
    get.mockResolvedValue({ data: { entries: [saved()] } });
    post.mockResolvedValue({ data: { id: "new", entries: [] } });
    put.mockResolvedValue({ data: {} });
  });

  it("preserves exact literals, source mappings, scale=0 and unknown metadata across read/edit/write", async () => {
    await getApiResource("resource");
    const transform = get.mock.calls[0][1].transformResponse;
    const raw =
      '{"entries":[{"id":"resource","category":"api","api_effect_type":"read","update_time":1795000000000000,"api_definition":{"variables":{"amount":{"value":1234567890.123456789},"id":{"value":9007199254740993},"text":{"value":"9007199254740993"}}},"schema_definition":[{"name":"amount","original_name":"AMOUNT","type":"decimal","attributes":{"precision":30,"scale":0},"condition_constraints":{"operations":["eq"],"value":{"minimum":1234567890.123456789}}}]}]}';
    const resource = (transform(raw) as { entries: ApiResource[] }).entries[0];
    const payload = apiResourcePayload(
      {
        ...resource,
        api_definition: { ...resource.api_definition, request: { method: "POST", path: "orders" } },
        schema_definition: [{ ...resource.schema_definition[0], description: "Updated field" }],
      },
      resource,
    );
    const text = transformPrecisionSafeJSONRequest(payload);
    expect(text).toContain('"value":1234567890.123456789');
    expect(text).toContain('"value":9007199254740993');
    expect(text).toContain('"value":"9007199254740993"');
    expect(text).toContain('"minimum":1234567890.123456789');
    expect(text).toContain('"scale":0');
    expect(text).toContain('"original_name":"AMOUNT"');
    expect(payload.expected_update_time).toBe(1795000000000000);
    expect(payload).not.toHaveProperty("logical_type");
    expect(payload).not.toHaveProperty("logical_view_definition");
  });

  it("submits only the changed part of the saved resource with the exact definition", async () => {
    const previous = saved();
    await saveApiResource({ ...previous, name: "New name" }, previous);
    expect(put.mock.calls[0][1]).not.toHaveProperty("api_definition");
    expect(put.mock.calls[0][1]).not.toHaveProperty("schema_definition");
    expect(put.mock.calls[0][1]).not.toHaveProperty("source_identifier");
    await saveApiResource(
      {
        ...previous,
        api_definition: {
          ...previous.api_definition,
          variables: { amount: { value: parsePrecisionPreservingJSON("1234567890.123456789") } },
        },
      },
      previous,
    );
    expect(put.mock.calls[1][1]).toMatchObject({
      category: "api",
      api_effect_type: "read",
      expected_update_time: 100,
    });
    expect(put.mock.calls[1][1]).not.toHaveProperty("schema_definition");
    expect(put.mock.calls[1][2].transformRequest(put.mock.calls[1][1])).toContain(
      "1234567890.123456789",
    );
  });

  it("retains original Query, Body and variable number spellings when only a Header changes", async () => {
    const raw =
      '{"entries":[{"id":"resource","category":"api","api_effect_type":"read","update_time":100,"schema_definition":[],"api_definition":{"request":{"method":"POST","path":"orders","parameters":[{"name":"price","value":1.2300}],"body":{"type":"array","value":[-0,9.123456789012E+02]}},"variables":{"limit":{"value":1e3},"wide":{"value":9007199254740993.000},"label":{"value":"1e3"}}}}]}';
    get.mockImplementationOnce((_path, options) =>
      Promise.resolve({ data: options.transformResponse(raw) }),
    );
    const resource = await getApiResource("resource");
    await saveApiResource(
      {
        ...resource,
        api_definition: {
          ...resource.api_definition,
          request: {
            ...(resource.api_definition.request as Record<string, unknown>),
            headers: { "X-Demo": "updated" },
          },
        },
      },
      resource,
    );
    const [, payload, options] = put.mock.calls[0];
    const wire = options.transformRequest(payload);
    expect(wire).toContain('"headers":{"X-Demo":"updated"}');
    expect(wire).toContain('"price","value":1.2300');
    expect(wire).toContain('"value":[-0,9.123456789012E+02]');
    expect(wire).toContain('"limit":{"value":1e3}');
    expect(wire).toContain('"wide":{"value":9007199254740993.000}');
    expect(wire).toContain('"label":{"value":"1e3"}');
  });

  it("sends a schema-only update without submitting the redacted API definition", async () => {
    const previous = saved();
    previous.api_definition.variables = { credential: { sensitive: true } };
    const schema = previous.schema_definition.map((field) => ({ ...field, display_name: "Label" }));
    await saveApiResource({ ...previous, schema_definition: schema }, previous);
    expect(put.mock.calls[0][1]).toMatchObject({ schema_definition: schema });
    expect(put.mock.calls[0][1]).not.toHaveProperty("api_definition");
  });

  it("creates through the existing Resource API and propagates a failed candidate without a second request", async () => {
    await expect(saveApiResource(saved())).resolves.toBe("new");
    expect(post.mock.calls[0][0]).toBe("/vega-backend/v1/resources");
    expect(post.mock.calls[0][1]).toMatchObject({ category: "api", api_effect_type: "read" });
    expect(post.mock.calls[0][1]).not.toHaveProperty("source_identifier");
    post.mockRejectedValueOnce(new Error("validation failed"));
    await expect(saveApiResource(saved())).rejects.toThrow("validation failed");
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("uses ResourceData GET override, preserves explicit zero/conditions and never adds destination or credential inputs", async () => {
    const filter = {
      field: "amount",
      operation: "eq",
      value: parsePrecisionPreservingJSON("1234567890.123456789"),
    };
    const signal = new AbortController().signal;
    await queryApiResource(
      "id/part",
      {
        filter_condition: filter,
        paging: { mode: "single", offset: 0, limit: 0 },
        need_total: true,
        target: "forbidden",
        credentials: "forbidden",
      } as never,
      signal,
    );
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("/vega-backend/v1/resources/id%2Fpart/data");
    expect(body).toEqual({
      filter_condition: filter,
      paging: { mode: "single", offset: 0, limit: 0 },
      need_total: true,
    });
    expect(config).toMatchObject({ signal, headers: { "X-HTTP-Method-Override": "GET" } });
    expect(config.transformRequest(body)).toContain("1234567890.123456789");
    const response = config.transformResponse(
      '{"entries":[{"id":9007199254740993,"amount":1234567890.123456789,"date":"2026-01-01T00:00:00.123456789Z"}]}',
    ) as { entries: Record<string, unknown>[] };
    expect(response.entries[0]).toEqual({
      id: "9007199254740993",
      amount: "1234567890.123456789",
      date: "2026-01-01T00:00:00.123456789Z",
    });
    expect(response).not.toHaveProperty("total_count");
    expect(response).not.toHaveProperty("paging");
  });

  it("does not invent paging, totals or filters for a no-filter validation and preserves legal empty entries", async () => {
    post.mockResolvedValueOnce({
      data: { entries: [], query_source: "source", is_approximate: false },
    });
    expect(await queryApiResource("resource", {})).toEqual({
      entries: [],
      query_source: "source",
      is_approximate: false,
    });
    expect(post.mock.calls[0][1]).toEqual({});
  });

  it("propagates unsupported filters, permission, edition and concurrency errors without retry/fallback", async () => {
    for (const status of [400, 403, 409, 429]) {
      const error = { response: { status, data: { error_code: "Rejected" } } };
      post.mockRejectedValueOnce(error);
      await expect(
        queryApiResource("resource", { filter_condition: { operation: "unsupported" } }),
      ).rejects.toBe(error);
    }
    expect(post).toHaveBeenCalledTimes(4);
  });

  it("rejects another category/read effect and validates required decimal metadata without replacing scale zero", async () => {
    get.mockResolvedValueOnce({ data: { entries: [{ ...saved(), category: "table" }] } });
    await expect(getApiResource("resource")).rejects.toThrow(
      "dataCatalog.apiResource.errors.resource",
    );
    const input = saved();
    input.api_definition = { ...input.api_definition, request: { method: "POST", path: "orders" } };
    expect(validateApiResourceInput(input)).toBeUndefined();
    for (const [precision, scale] of [
      [2, -3],
      [3, 5],
    ]) {
      expect(
        validateApiResourceInput({
          ...input,
          schema_definition: [{ ...input.schema_definition[0], attributes: { precision, scale } }],
        }),
      ).toBeUndefined();
    }
    expect(
      validateApiResourceInput({
        ...input,
        schema_definition: [{ ...input.schema_definition[0], attributes: { precision: 30 } }],
      }),
    ).toBe("dataCatalog.apiResource.errors.decimal");
  });

  it("accepts non-null JSON variable values and requires a string for sensitive values", () => {
    const input = saved();
    const withVariable = (declaration: Record<string, unknown>) => ({
      ...input,
      api_definition: {
        ...input.api_definition,
        request: { method: "GET", path: "orders" },
        variables: { setting: declaration },
      },
    });
    const number = parsePrecisionPreservingJSON("9007199254740993.12345");
    for (const value of [
      "",
      0,
      false,
      number,
      { optional: null, nested: [number] },
      [null, false],
    ]) {
      expect(validateApiResourceInput(withVariable({ value }))).toBeUndefined();
    }
    expect(
      validateApiResourceInput(withVariable({ value: "example", sensitive: true })),
    ).toBeUndefined();
    expect(
      validateApiResourceInput(withVariable({ value: false, sensitive: null })),
    ).toBeUndefined();
    for (const invalid of [
      {},
      { value: null },
      { value: number, sensitive: true },
      { value: {}, sensitive: true },
      { sensitive: true },
    ]) {
      expect(validateApiResourceInput(withVariable(invalid))).toBe(
        "dataCatalog.apiResource.errors.variables",
      );
    }
  });
});
