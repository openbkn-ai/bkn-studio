/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRuntimeConfig, setRuntimeConfig } from "@/framework/runtime/config";
import {
  CONTEXT_LOADER_OPS,
  buildCurl,
  createMcpSession,
  fetchMcpObjectTypes,
  fetchKnDetail,
  fetchKnDetailRestLegacy,
  listMcpTools,
  sendRequest,
} from "@/modules/knowledge-network/services/context-loader.service";

const searchSchema = CONTEXT_LOADER_OPS.find((operation) => operation.id === "search_schema")!;

const bknContext = {
  conversation_id: "conv_1",
  interaction_id: "int_1",
};

function restBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("Expected a JSON string request body");
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

function jsonRpcBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("Expected a JSON string request body");
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

beforeEach(() => {
  setRuntimeConfig(createRuntimeConfig({ locale: "en-US" }));
});

afterEach(() => {
  vi.restoreAllMocks();
  setRuntimeConfig(createRuntimeConfig());
});

describe("sendRequest", () => {
  it("passes cancellation through to the REST request", async () => {
    const controller = new AbortController();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await sendRequest(
      { base: "https://platform.example.com", token: "", knId: "kn-demo" },
      searchSchema,
      "rest",
      {},
      "{}",
      undefined,
      controller.signal,
    );

    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/kn/search_schema");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
    expect(init.headers).toMatchObject({ "Accept-Language": "en-US" });
  });

  it("completes the MCP initialize, initialized notification, and tools/call handshake", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-1" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response('{"jsonrpc":"2.0","result":{"content":[]}}', { status: 200 }));

    await sendRequest(
      { base: "https://platform.example.com", token: "token-1", knId: "kn-demo" },
      searchSchema,
      "mcp",
      {},
      "{}",
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://platform.example.com/api/agent-retrieval/v1/mcp/");
    expect(fetchSpy.mock.calls[1][0]).toBe("https://platform.example.com/api/agent-retrieval/v1/mcp/");
    expect(fetchSpy.mock.calls[2][0]).toBe("https://platform.example.com/api/agent-retrieval/v1/mcp/");
    expect(jsonRpcBody(fetchSpy.mock.calls[0][1])).toMatchObject({ method: "initialize" });
    expect(jsonRpcBody(fetchSpy.mock.calls[1][1])).toMatchObject({ method: "notifications/initialized" });
    expect(jsonRpcBody(fetchSpy.mock.calls[2][1])).toMatchObject({ method: "tools/call" });
    expect(fetchSpy.mock.calls[2][1]?.headers).toMatchObject({ "Mcp-Session-Id": "session-1" });
    fetchSpy.mock.calls.forEach(([, init]) => {
      expect(init?.headers).toMatchObject({ "Accept-Language": "en-US" });
    });
  });

  it("carries the managed context into the REST body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await sendRequest(
      { base: "https://platform.example.com", token: "", knId: "kn-demo" },
      searchSchema,
      "rest",
      {},
      '{"query":"订单"}',
      undefined,
      undefined,
      bknContext,
    );

    // Without bkn_context, Context Loader returns conversation_required and makes zero downstream calls.
    expect(restBody(fetchSpy.mock.calls[0][1])).toEqual({ query: "订单", bkn_context: bknContext });
  });

  it("carries the managed context into the MCP arguments", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-1" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response('{"jsonrpc":"2.0","result":{"content":[]}}', { status: 200 }));

    await sendRequest(
      { base: "https://platform.example.com", token: "token-1", knId: "kn-demo" },
      searchSchema,
      "mcp",
      {},
      '{"query":"订单"}',
      undefined,
      undefined,
      bknContext,
    );

    expect(jsonRpcBody(fetchSpy.mock.calls[2][1])).toMatchObject({
      params: { arguments: { query: "订单", bkn_context: bknContext } },
    });
  });

});

describe("fetchKnDetail", () => {
  it("uses the MCP get_kn_detail tool with managed context", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-1" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              structuredContent: {
                id: "kn-demo",
                object_types: [],
                concept_groups: [],
                relation_types: [],
              },
            },
          }),
          { status: 200 },
        ),
      );

    await fetchKnDetail({ base: "https://platform.example.com", token: "", knId: "kn-demo" }, undefined, undefined, {
      nextContext: () => bknContext,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(jsonRpcBody(fetchSpy.mock.calls[2][1])).toMatchObject({
      method: "tools/call",
      params: {
        name: "get_kn_detail",
        arguments: {
          kn_id: "kn-demo",
          response_format: "json",
          bkn_context: bknContext,
        },
      },
    });
  });
});

describe("legacy context-loader REST requests", () => {
  it("uses the current UI locale", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "kn-demo", object_types: [], concept_groups: [], relation_types: [] }), { status: 200 }),
    );

    await fetchKnDetailRestLegacy({ base: "https://platform.example.com", token: "", knId: "kn-demo" });

    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toMatchObject({ "Accept-Language": "en-US" });
  });
});

describe("fetchMcpObjectTypes", () => {
  it("uses get_object_types with the managed context and returns related metrics", async () => {
    const session = {
      callTool: vi.fn().mockResolvedValue({
        ok: true,
        text: "",
        latencyMs: 1,
        structured: { object_types: [{ id: "orders", related_metrics: [{ id: "m_order_count" }] }] },
        isError: false,
      }),
    };
    await expect(fetchMcpObjectTypes(session, "kn-demo", ["orders"], { nextContext: () => bknContext })).resolves.toEqual([
      { id: "orders", related_metrics: [{ id: "m_order_count" }] },
    ]);
    expect(session.callTool).toHaveBeenCalledWith("get_object_types", {
      kn_id: "kn-demo",
      ids: ["orders"],
      response_format: "json",
      bkn_context: bknContext,
    });
  });

  it("falls back to a JSON data envelope when structured content is unavailable", async () => {
    const session = {
      callTool: vi.fn().mockResolvedValue({
        ok: true,
        text: '{"data":{"object_types":[{"id":"orders","related_metrics":[{"id":"m_order_count"}]}]}}',
        latencyMs: 1,
        isError: false,
      }),
    };
    await expect(fetchMcpObjectTypes(session, "kn-demo", ["orders"])).resolves.toEqual([
      { id: "orders", related_metrics: [{ id: "m_order_count" }] },
    ]);
  });
});

describe("buildCurl", () => {
  it("includes the managed context so the copied command is the one that was sent", () => {
    const curl = buildCurl(
      { base: "https://platform.example.com", token: "token-1", knId: "kn-demo" },
      searchSchema,
      "rest",
      {},
      '{"query":"订单"}',
      bknContext,
    );

    expect(curl).toContain('"bkn_context":{"conversation_id":"conv_1"');
    expect(curl).toContain("Accept-Language: en-US");
  });

  it("keeps a half-written request body readable instead of showing it as empty", () => {
    const curl = buildCurl(
      { base: "https://platform.example.com", token: "token-1", knId: "kn-demo" },
      searchSchema,
      "rest",
      {},
      '{"query":',
      bknContext,
    );

    expect(curl).toContain('{"query":');
  });
});

describe("listMcpTools", () => {
  it("refreshes the token after a 401 and retries the full MCP handshake", async () => {
    const refresh = vi.fn().mockResolvedValue("fresh-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-2" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response('{"jsonrpc":"2.0","result":{"tools":[{"name":"search_schema","inputSchema":{"type":"object"}}]}}', { status: 200 }),
      );

    const tools = await listMcpTools(
      { base: "https://platform.example.com", token: "expired-token", knId: "kn-demo" },
      { getToken: () => "expired-token", refresh },
    );

    expect(tools).toEqual([{ name: "search_schema", inputSchema: { type: "object" }, outputSchema: undefined }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy.mock.calls[1][0]).toBe("https://platform.example.com/api/agent-retrieval/v1/mcp/");
    expect(fetchSpy.mock.calls[2][0]).toBe("https://platform.example.com/api/agent-retrieval/v1/mcp/");
    expect(fetchSpy.mock.calls[3][0]).toBe("https://platform.example.com/api/agent-retrieval/v1/mcp/");
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer expired-token" });
    expect(fetchSpy.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "Bearer fresh-token" });
    expect(jsonRpcBody(fetchSpy.mock.calls[2][1])).toMatchObject({ method: "notifications/initialized" });
    expect(jsonRpcBody(fetchSpy.mock.calls[3][1])).toMatchObject({ method: "tools/list" });
  });

  it("keeps the display metadata tools/list puts on title and _meta", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-4" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              tools: [
                {
                  name: "run_sql",
                  title: "SQL 查询",
                  _meta: { "openbkn.ai/group": "query", "openbkn.ai/group_title": "实例查询", "openbkn.ai/order": 240 },
                },
                // Legacy server shape has no display field, so parsing must yield undefined rather than an empty string.
                { name: "legacy_tool" },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const tools = await listMcpTools({ base: "https://platform.example.com", token: "token-1", knId: "kn-demo" });

    expect(tools[0]).toMatchObject({ name: "run_sql", title: "SQL 查询", group: "query", groupTitle: "实例查询", order: 240 });
    expect(tools[1]).toMatchObject({ name: "legacy_tool", title: undefined, group: undefined, groupTitle: undefined, order: undefined });
  });

  it("returns an empty list and forwards cancellation to every MCP request", async () => {
    const controller = new AbortController();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-3" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response('{"jsonrpc":"2.0","result":{"tools":[]}}', { status: 200 }));

    await expect(
      listMcpTools({ base: "https://platform.example.com", token: "token-1", knId: "kn-demo" }, undefined, controller.signal),
    ).resolves.toEqual([]);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    fetchSpy.mock.calls.forEach((call) => {
      const init = call[1] as RequestInit;
      expect(init).toMatchObject({
        signal: controller.signal,
        headers: { "Accept-Language": "en-US" },
      });
    });
  });
});

describe("createMcpSession", () => {
  it("reconnects once when the MCP session expires", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-old" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response("session expired", { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Mcp-Session-Id": "session-new" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response('{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"reconnected"}]}}', { status: 200 }),
      );

    const session = createMcpSession({ base: "https://platform.example.com", token: "token-1", knId: "kn-demo" });
    await expect(session.callTool("search_schema", { query: "order" })).resolves.toMatchObject({ ok: true, text: "reconnected" });

    expect(fetchSpy).toHaveBeenCalledTimes(6);
    expect(fetchSpy.mock.calls[2][1]?.headers).toMatchObject({ "Mcp-Session-Id": "session-old" });
    expect(fetchSpy.mock.calls[5][1]?.headers).toMatchObject({ "Mcp-Session-Id": "session-new" });
    fetchSpy.mock.calls.forEach(([, init]) => {
      expect(init?.headers).toMatchObject({ "Accept-Language": "en-US" });
    });
  });
});
