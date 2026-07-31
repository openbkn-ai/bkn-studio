/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const MCP_SERVER_NAME = "bkn-agent-retrieval";
const TLS_BYPASS_ENV = "NODE_TLS_REJECT_UNAUTHORIZED=0";

export function withMcpTrailingSlash(mcpUrl: string): string {
  return mcpUrl.endsWith("/") ? mcpUrl : `${mcpUrl}/`;
}

function createMcpRemoteServer(mcpUrl: string, apiKey: string) {
  return {
    command: "npx",
    args: [
      "-y",
      "mcp-remote",
      withMcpTrailingSlash(mcpUrl),
      "--transport",
      "http-only",
      "--header",
      `Authorization: Bearer ${apiKey}`,
    ],
    env: {
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    },
  };
}

export function createMcpRemoteJsonConfig(mcpUrl: string, apiKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: createMcpRemoteServer(mcpUrl, apiKey),
      },
    },
    null,
    2,
  );
}

export function createClaudeCodeMcpCommand(mcpUrl: string, apiKey: string): string {
  return [
    `claude mcp add ${MCP_SERVER_NAME} \\`,
    "  --scope user \\",
    `  --env ${TLS_BYPASS_ENV} \\`,
    `  -- npx -y mcp-remote ${withMcpTrailingSlash(mcpUrl)} \\`,
    "  --transport http-only \\",
    `  --header "Authorization: Bearer ${apiKey}"`,
  ].join("\n");
}
