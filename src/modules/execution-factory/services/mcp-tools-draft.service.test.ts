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

// While an MCP Server is editing, the proxy listing answers with its release; the authoring
// page asks for the draft it debugs with `draft=true` (bkn-foundry#1523).
describe("listMcpTools draft listing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    getMock.mockResolvedValue({ data: { tools: [{ name: "draft_only_tool" }] } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for the draft when requested", async () => {
    const { listMcpTools } = await import("./mcp.service");

    const tools = await listMcpTools("mcp-1", { draft: true });

    expect(tools.map((tool) => tool.name)).toEqual(["draft_only_tool"]);
    const [url, config] = getMock.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toContain("/mcp/proxy/mcp-1/tools");
    expect(config.params.draft).toBe(true);
  });

  it("leaves the served listing untouched by default", async () => {
    const { listMcpTools } = await import("./mcp.service");

    await listMcpTools("mcp-1");

    const [, config] = getMock.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.draft).toBeUndefined();
  });
});
