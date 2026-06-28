import { gatewayOrigin } from "@/framework/auth/oauth";

/** 展示/示例用真实网关地址：dev 取 VITE_DEV_AUTH_ORIGIN，prod 同源。 */
export function serverOrigin(): string {
  const gw = gatewayOrigin();
  if (gw) return gw;
  return typeof window !== "undefined" ? window.location.origin : "https://your-bkn-host";
}

const REST_PATH = "/api/agent-retrieval/v1/kn/search_schema";
const MCP_PATH = "/api/agent-retrieval/v1/mcp";
const MCP_NAME = "bkn-agent-retrieval";

/** MCP 服务端点（真实网关地址 + /mcp）。 */
export function mcpUrl(): string {
  return `${serverOrigin()}${MCP_PATH}`;
}

/** REST 调用示例（真实契约：/v1 前缀，仅 Authorization 头）。 */
export function buildRestSnippet(keyValue: string): string {
  return [
    `curl -X POST '${serverOrigin()}${REST_PATH}?response_format=json' \\`,
    `  -H 'Authorization: Bearer ${keyValue}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"kn_id":"your_kn_id","query":"查询核心业务对象与关系"}'`,
  ].join("\n");
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
