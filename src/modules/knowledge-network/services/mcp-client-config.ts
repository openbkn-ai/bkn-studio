/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const MCP_SERVER_NAME = "bkn-agent-retrieval";
const MCP_COMPACT_SERVER_NAME = "bkn-agent-retrieval-compact";
const TLS_BYPASS_ENV = "NODE_TLS_REJECT_UNAUTHORIZED=0";

export type McpConnectionProtocol = "http" | "https";

export interface McpClientConfigOptions {
  allowInsecureTls?: boolean;
}

/** Keep client examples on Agent Retrieval's slash-terminated `/mcp/*path` root route. */
export function withMcpTrailingSlash(mcpUrl: string): string {
  return mcpUrl.endsWith("/") ? mcpUrl : `${mcpUrl}/`;
}

export function getMcpConnectionProtocol(mcpUrl: string): McpConnectionProtocol {
  let protocol: string;

  try {
    protocol = new URL(mcpUrl).protocol;
  } catch {
    throw new Error("Invalid MCP URL");
  }

  if (protocol === "http:" || protocol === "https:") {
    return protocol.slice(0, -1) as McpConnectionProtocol;
  }

  throw new Error(`Unsupported MCP URL protocol: ${protocol}`);
}

/**
 * Names the compact endpoint apart from the full one, so a client can register both side by side
 * and switching one does not overwrite the other.
 */
export function mcpServerNameFor(mcpUrl: string): string {
  let path: string;
  try {
    path = new URL(mcpUrl).pathname;
  } catch {
    return MCP_SERVER_NAME;
  }
  return /\/mcp-compact(\/|$)/.test(path) ? MCP_COMPACT_SERVER_NAME : MCP_SERVER_NAME;
}

function createMcpRemoteServer(mcpUrl: string, apiKey: string, options: McpClientConfigOptions) {
  const protocol = getMcpConnectionProtocol(mcpUrl);
  const args = ["-y", "mcp-remote", withMcpTrailingSlash(mcpUrl), "--transport", "http-only"];

  if (protocol === "http") {
    args.push("--allow-http");
  }

  args.push("--header", `Authorization: Bearer ${apiKey}`);

  const server: {
    command: string;
    args: string[];
    env?: { NODE_TLS_REJECT_UNAUTHORIZED: string };
  } = {
    command: "npx",
    args,
  };

  if (protocol === "https" && options.allowInsecureTls) {
    server.env = { NODE_TLS_REJECT_UNAUTHORIZED: "0" };
  }

  return server;
}

export function createMcpRemoteJsonConfig(
  mcpUrl: string,
  apiKey: string,
  options: McpClientConfigOptions = {},
): string {
  return JSON.stringify(
    {
      mcpServers: {
        [mcpServerNameFor(mcpUrl)]: createMcpRemoteServer(mcpUrl, apiKey, options),
      },
    },
    null,
    2,
  );
}

export function createClaudeCodeMcpCommand(
  mcpUrl: string,
  apiKey: string,
  options: McpClientConfigOptions = {},
): string {
  const protocol = getMcpConnectionProtocol(mcpUrl);
  const lines = [`claude mcp add ${mcpServerNameFor(mcpUrl)} \\`, "  --scope user \\"];

  if (protocol === "https" && options.allowInsecureTls) {
    lines.push(`  --env ${TLS_BYPASS_ENV} \\`);
  }

  lines.push(
    `  -- npx -y mcp-remote ${withMcpTrailingSlash(mcpUrl)} \\`,
    "  --transport http-only \\",
  );

  if (protocol === "http") {
    lines.push("  --allow-http \\");
  }

  lines.push(`  --header "Authorization: Bearer ${apiKey}"`);

  return lines.join("\n");
}
