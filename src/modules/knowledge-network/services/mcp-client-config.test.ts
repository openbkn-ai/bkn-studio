/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  createClaudeCodeMcpCommand,
  createMcpRemoteJsonConfig,
  getMcpConnectionProtocol,
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

    expect(createClaudeCodeMcpCommand(mcpUrl, apiKey, options)).toBe(`claude mcp add bkn-agent-retrieval \\
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

    expect(JSON.parse(createMcpRemoteJsonConfig(mcpUrl, apiKey, { allowInsecureTls: true }))).not.toHaveProperty(
      "mcpServers.bkn-agent-retrieval.env",
    );
  });

  it("detects supported protocols and rejects unsupported URLs", () => {
    expect(getMcpConnectionProtocol("http://platform.example.com/mcp")).toBe("http");
    expect(getMcpConnectionProtocol("https://platform.example.com/mcp")).toBe("https");
    expect(() => getMcpConnectionProtocol("ftp://platform.example.com/mcp")).toThrow("Unsupported MCP URL protocol");
  });
});
