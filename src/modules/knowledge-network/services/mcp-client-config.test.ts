/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createClaudeCodeMcpCommand, createMcpRemoteJsonConfig } from "@/modules/knowledge-network/services/mcp-client-config";

describe("MCP client configuration", () => {
  const mcpUrl = "https://platform.example.com/api/agent-retrieval/v1/mcp";
  const apiKey = "bak_test";

  it("creates a Claude Code command that starts mcp-remote with TLS handling", () => {
    expect(createClaudeCodeMcpCommand(mcpUrl, apiKey)).toBe(`claude mcp add bkn-agent-retrieval \\
  --scope user \\
  --env NODE_TLS_REJECT_UNAUTHORIZED=0 \\
  -- npx -y mcp-remote https://platform.example.com/api/agent-retrieval/v1/mcp/ \\
  --transport http-only \\
  --header "Authorization: Bearer bak_test"`);
  });

  it("creates the same mcp-remote server structure for project configuration", () => {
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
          env: {
            NODE_TLS_REJECT_UNAUTHORIZED: "0",
          },
        },
      },
    });
  });
});
