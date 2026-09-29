/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  maskHeaders,
  parseMcpServersConfig,
  redactHeaderValues,
  toCapabilityName,
} from "@/modules/execution-factory/utils/mcp-servers-config";

function parseEntries(servers: unknown) {
  const result = parseMcpServersConfig(JSON.stringify({ mcpServers: servers }));

  if (!result.ok) {
    throw new Error(`unexpected config error: ${result.error}`);
  }

  return result.entries;
}

describe("parseMcpServersConfig", () => {
  it("maps streamable_http to stream and keeps url and headers", () => {
    const [entry] = parseEntries({
      Bazi_MCP: {
        type: "streamable_http",
        url: "https://mcp.example.com/mcp",
        headers: { Authorization: "Bearer abc" },
      },
    });

    expect(entry).toMatchObject({
      key: "Bazi_MCP",
      name: "Bazi_MCP",
      mode: "stream",
      url: "https://mcp.example.com/mcp",
      headers: { Authorization: "Bearer abc" },
      errors: [],
      warnings: [],
    });
  });

  it.each([
    ["sse", "sse"],
    ["SSE", "sse"],
    ["http", "stream"],
    ["streamable-http", "stream"],
    ["streamableHttp", "stream"],
  ])("maps type %s to %s", (type, mode) => {
    const [entry] = parseEntries({ a: { type, url: "https://x.test/mcp" } });

    expect(entry?.mode).toBe(mode);
    expect(entry?.errors).toEqual([]);
  });

  it("accepts the transport alias and defaults a missing type to stream with a warning", () => {
    const [aliased, untyped] = parseEntries({
      aliased: { transport: "sse", url: "https://x.test/sse" },
      untyped: { url: "https://x.test/mcp" },
    });

    expect(aliased?.mode).toBe("sse");
    expect(untyped).toMatchObject({ mode: "stream", errors: [], warnings: ["type_missing"] });
  });

  it("rejects stdio configs instead of treating them as HTTP servers", () => {
    const [entry] = parseEntries({
      bkn: {
        command: "npx",
        args: ["-y", "mcp-remote", "https://x.test/mcp"],
      },
    });

    expect(entry?.errors).toEqual(["stdio_unsupported"]);
  });

  it("rejects stdio configs even when they also carry a url", () => {
    const [entry] = parseEntries({ a: { command: "uvx", url: "https://x.test/mcp" } });

    expect(entry?.errors).toContain("stdio_unsupported");
  });

  it("reports unknown types, bad urls and bad headers", () => {
    const [unknownType, missingUrl, badUrl, localFile, badHeaders, notObject] = parseEntries({
      a: { type: "websocket", url: "https://x.test/mcp" },
      b: { type: "sse" },
      c: { type: "sse", url: "not a url" },
      d: { type: "sse", url: "file:///etc/passwd" },
      e: { type: "sse", url: "https://x.test/mcp", headers: { "X-Retry": 3 } },
      f: "https://x.test/mcp",
    });

    expect(unknownType?.errors).toEqual(["unknown_type"]);
    expect(unknownType?.type).toBe("websocket");
    expect(missingUrl?.errors).toEqual(["missing_url"]);
    expect(badUrl?.errors).toEqual(["invalid_url"]);
    expect(localFile?.errors).toEqual(["invalid_url"]);
    expect(badHeaders?.errors).toEqual(["invalid_headers"]);
    expect(notObject?.errors).toEqual(["not_object"]);
  });

  it("warns about fields it does not import", () => {
    const [entry] = parseEntries({
      a: { type: "sse", url: "https://x.test/mcp", env: { A: "1" }, timeout: 30 },
    });

    expect(entry?.errors).toEqual([]);
    expect(entry?.warnings).toContain("fields_ignored");
    expect(entry?.ignoredFields).toEqual(["env", "timeout"]);
  });

  it("adjusts names outside the platform rule and flags collisions", () => {
    const [first, second] = parseEntries({
      "Bazi-MCP": { type: "sse", url: "https://x.test/a" },
      Bazi_MCP: { type: "sse", url: "https://x.test/b" },
    });

    expect(first).toMatchObject({ name: "Bazi_MCP", warnings: ["name_adjusted"], errors: [] });
    expect(second?.errors).toEqual(["duplicate_name"]);
  });

  it.each([
    ["{not json", "invalid_json"],
    ["[]", "missing_mcp_servers"],
    ['{"servers": {}}', "missing_mcp_servers"],
    ['{"mcpServers": []}', "missing_mcp_servers"],
    ['{"mcpServers": {}}', "empty"],
  ])("rejects %s as %s", (text, error) => {
    expect(parseMcpServersConfig(text)).toEqual({ ok: false, error });
  });
});

describe("toCapabilityName", () => {
  it("replaces runs of unsupported characters and trims underscores", () => {
    expect(toCapabilityName("my.mcp - server")).toBe("my_mcp_server");
    expect(toCapabilityName("-mcp-")).toBe("mcp");
    expect(toCapabilityName("---")).toBe("mcp_server");
  });
});

describe("header masking", () => {
  it("masks credential-like header values for display", () => {
    expect(
      maskHeaders({ Authorization: "Bearer abc", "X-Api-Key": "k", "X-Tenant": "t1" }),
    ).toEqual({ Authorization: "***", "X-Api-Key": "***", "X-Tenant": "t1" });
  });

  it("scrubs header values echoed back in error messages", () => {
    expect(
      redactHeaderValues("401 for header Bearer bak_secret123 on host", {
        Authorization: "Bearer bak_secret123",
        "X-Short": "a",
      }),
    ).toBe("401 for header *** on host");
  });
});
