/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  createClaudeCodeMcpCommand,
  createClaudeCodeMcpUrlCommand,
  createMcpRemoteJsonConfig,
  createMcpUrlJsonConfig,
  getMcpConnectionProtocol,
  isLikelySelfSignedMcpHost,
} from "@/modules/knowledge-network/services/mcp-client-config";

describe("MCP client configuration", () => {
  const apiKey = "bak_test";

  it("adds --allow-http for an HTTP deployment without disabling TLS verification", () => {
    const mcpUrl = "http://platform.example.com/api/agent-retrieval/v1/mcp";

    expect(createClaudeCodeMcpCommand(mcpUrl, apiKey)).toBe(`claude mcp add bkn-agent-retrieval \\
  --scope user \\
  -- npx -y mcp-remote http://platform.example.com/api/agent-retrieval/v1/mcp/ \\
  --transport http-only \\
  --allow-http \\
  --header "Authorization: Bearer bak_test"`);
    expect(JSON.parse(createMcpRemoteJsonConfig(mcpUrl, apiKey))).toEqual({
      mcpServers: {
        "bkn-agent-retrieval": {
          command: "npx",
          args: [
            "-y",
            "mcp-remote",
            "http://platform.example.com/api/agent-retrieval/v1/mcp/",
            "--transport",
            "http-only",
            "--allow-http",
            "--header",
            "Authorization: Bearer bak_test",
          ],
        },
      },
    });
  });

  it("keeps certificate verification enabled for an HTTPS deployment by default", () => {
    const mcpUrl = "https://platform.example.com/api/agent-retrieval/v1/mcp";

    expect(createClaudeCodeMcpCommand(mcpUrl, apiKey)).toBe(`claude mcp add bkn-agent-retrieval \\
  --scope user \\
  -- npx -y mcp-remote https://platform.example.com/api/agent-retrieval/v1/mcp/ \\
  --transport http-only \\
  --header "Authorization: Bearer bak_test"`);
    expect(JSON.parse(createMcpRemoteJsonConfig(mcpUrl, apiKey))).toEqual({
      mcpServers: {
        "bkn-agent-retrieval": {
          command: "npx",
          args: [
            "-y",
            "mcp-remote",
            "https://platform.example.com/api/agent-retrieval/v1/mcp/",
            "--transport",
            "http-only",
            "--header",
            "Authorization: Bearer bak_test",
          ],
        },
      },
    });
  });

  it("disables certificate verification only when explicitly allowed for HTTPS", () => {
    const mcpUrl = "https://platform.example.com/api/agent-retrieval/v1/mcp";
    const options = { allowInsecureTls: true };

    expect(createClaudeCodeMcpCommand(mcpUrl, apiKey, options))
      .toBe(`claude mcp add bkn-agent-retrieval \\
  --scope user \\
  --env NODE_TLS_REJECT_UNAUTHORIZED=0 \\
  -- npx -y mcp-remote https://platform.example.com/api/agent-retrieval/v1/mcp/ \\
  --transport http-only \\
  --header "Authorization: Bearer bak_test"`);
    expect(JSON.parse(createMcpRemoteJsonConfig(mcpUrl, apiKey, options))).toEqual({
      mcpServers: {
        "bkn-agent-retrieval": {
          command: "npx",
          args: [
            "-y",
            "mcp-remote",
            "https://platform.example.com/api/agent-retrieval/v1/mcp/",
            "--transport",
            "http-only",
            "--header",
            "Authorization: Bearer bak_test",
          ],
          env: {
            NODE_TLS_REJECT_UNAUTHORIZED: "0",
          },
        },
      },
    });
  });

  it("ignores the self-signed certificate option for HTTP", () => {
    const mcpUrl = "http://platform.example.com/api/agent-retrieval/v1/mcp";

    expect(
      JSON.parse(createMcpRemoteJsonConfig(mcpUrl, apiKey, { allowInsecureTls: true })),
    ).not.toHaveProperty("mcpServers.bkn-agent-retrieval.env");
  });

  it("detects supported protocols and rejects unsupported URLs", () => {
    expect(getMcpConnectionProtocol("http://platform.example.com/mcp")).toBe("http");
    expect(getMcpConnectionProtocol("https://platform.example.com/mcp")).toBe("https");
    expect(() => getMcpConnectionProtocol("ftp://platform.example.com/mcp")).toThrow(
      "Unsupported MCP URL protocol",
    );
  });

  // The compact endpoint gets its own server name, so a client can register both side by side.
  it("names the compact endpoint apart from the full one", () => {
    const mcpUrl = "https://platform.example.com/api/agent-retrieval/v1/mcp-compact/";

    expect(createClaudeCodeMcpCommand(mcpUrl, apiKey))
      .toBe(`claude mcp add bkn-agent-retrieval-compact \\
  --scope user \\
  -- npx -y mcp-remote https://platform.example.com/api/agent-retrieval/v1/mcp-compact/ \\
  --transport http-only \\
  --header "Authorization: Bearer bak_test"`);
    const config = JSON.parse(createMcpRemoteJsonConfig(mcpUrl, apiKey)) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(config.mcpServers)).toEqual(["bkn-agent-retrieval-compact"]);
  });
});

describe("MCP sign-in (URL only) configuration", () => {
  it("writes only the URL with a trailing slash, no key or header", () => {
    const mcpUrl = "https://platform.example.com/api/agent-retrieval/v1/mcp";

    expect(JSON.parse(createMcpUrlJsonConfig(mcpUrl))).toEqual({
      mcpServers: {
        "bkn-agent-retrieval": {
          type: "http",
          url: "https://platform.example.com/api/agent-retrieval/v1/mcp/",
        },
      },
    });
    expect(createClaudeCodeMcpUrlCommand(mcpUrl)).toBe(
      "claude mcp add --transport http --scope user bkn-agent-retrieval https://platform.example.com/api/agent-retrieval/v1/mcp/",
    );
  });

  it("keeps the compact endpoint name apart in sign-in mode", () => {
    const mcpUrl = "https://platform.example.com/api/agent-retrieval/v1/mcp-compact/";

    expect(createClaudeCodeMcpUrlCommand(mcpUrl)).toBe(
      "claude mcp add --transport http --scope user bkn-agent-retrieval-compact https://platform.example.com/api/agent-retrieval/v1/mcp-compact/",
    );
    const config = JSON.parse(createMcpUrlJsonConfig(mcpUrl)) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(config.mcpServers)).toEqual(["bkn-agent-retrieval-compact"]);
  });

  it("flags https addresses that likely use a self-signed certificate", () => {
    expect(isLikelySelfSignedMcpHost("https://10.211.55.4/api/agent-retrieval/v1/mcp/")).toBe(true);
    expect(isLikelySelfSignedMcpHost("https://[fd00::1]/api/agent-retrieval/v1/mcp/")).toBe(true);
    expect(isLikelySelfSignedMcpHost("https://bkn.local/api/agent-retrieval/v1/mcp/")).toBe(true);
    expect(isLikelySelfSignedMcpHost("https://poc.openbkn.ai/api/agent-retrieval/v1/mcp/")).toBe(
      false,
    );
    expect(isLikelySelfSignedMcpHost("http://10.211.55.4/api/agent-retrieval/v1/mcp/")).toBe(false);
    expect(isLikelySelfSignedMcpHost("not a url")).toBe(false);
  });
});
