/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { gatewayOrigin } from "@/framework/auth/oauth";

/** 展示/示例用真实网关地址：dev 取 VITE_DEV_AUTH_ORIGIN，prod 同源。 */
export function serverOrigin(): string {
  const gw = gatewayOrigin();
  if (gw) return gw;
  return typeof window !== "undefined" ? window.location.origin : "https://your-bkn-host";
}

const MCP_PATH = "/api/agent-retrieval/v1/mcp";
const MCP_NAME = "bkn-agent-retrieval";

/** MCP 服务端点（真实网关地址 + /mcp）。 */
export function mcpUrl(): string {
  return `${serverOrigin()}${MCP_PATH}`;
}

/** 通用 mcp.json 配置（Cursor / Claude Code .mcp.json / 大多数 MCP 客户端）。 */
export function buildMcpSnippet(keyValue: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [MCP_NAME]: {
          type: "http",
          url: mcpUrl(),
          headers: { Authorization: `Bearer ${keyValue}` },
        },
      },
    },
    null,
    2,
  );
}

/** Claude Code：CLI 一行接入。 */
export function buildClaudeCliSnippet(keyValue: string): string {
  return [
    `claude mcp add --transport http ${MCP_NAME} ${mcpUrl()} \\`,
    `  --header "Authorization: Bearer ${keyValue}"`,
  ].join("\n");
}

/** Codex CLI：~/.codex/config.toml 的 streamable-HTTP MCP 配置。 */
export function buildCodexSnippet(keyValue: string): string {
  return [
    `# ~/.codex/config.toml`,
    `[mcp_servers.${MCP_NAME}]`,
    `url = "${mcpUrl()}"`,
    `http_headers = { Authorization = "Bearer ${keyValue}" }`,
  ].join("\n");
}

/** OpenBKN CLI：复用统一的 BKN_BASE_URL / BKN_TOKEN 环境变量。 */
export function buildCliSnippet(keyValue: string): string {
  return [
    "npm install -g @openbkn/bkn-sdk",
    "",
    `export BKN_BASE_URL="${serverOrigin()}"`,
    `export BKN_TOKEN="${keyValue}"`,
    "",
    'openbkn context search-schema <kn-id> "查询核心业务对象与关系"',
  ].join("\n");
}

/** Node.js SDK：与 CLI 使用同一对环境变量和同一枚 API Key。 */
export function buildSdkSnippet(keyValue: string): string {
  return [
    "npm install @openbkn/bkn-sdk",
    "",
    `export BKN_BASE_URL="${serverOrigin()}"`,
    `export BKN_TOKEN="${keyValue}"`,
    "",
    'import { createClient } from "@openbkn/bkn-sdk";',
    "",
    "const bkn = createClient({",
    "  baseUrl: process.env.BKN_BASE_URL!,",
    "  token: process.env.BKN_TOKEN!,",
    "});",
    "",
    'const result = await bkn.context.searchSchema("your_kn_id", "查询核心业务对象与关系");',
  ].join("\n");
}
