import { gatewayOrigin } from "@/framework/auth/oauth";

/** 展示/示例用真实网关地址：dev 取 VITE_DEV_AUTH_ORIGIN，prod 同源。 */
export function serverOrigin(): string {
  const gw = gatewayOrigin();
  if (gw) return gw;
  return typeof window !== "undefined" ? window.location.origin : "https://your-bkn-host";
}

/**
 * 列表里 key 的掩码展示：后端只回 key_id（公开半段），完整密钥含的 secret 不可回取。
 * 显示 `bak_<key_id>_••••` —— 头是真实可识别的 key_id，尾用 •••• 表示隐藏的 secret。
 */
export function maskApiKey(keyId: string): string {
  return `bak_${keyId}_••••`;
}

const REST_PATH = "/api/agent-retrieval/v1/kn/search_schema";
const MCP_PATH = "/api/agent-retrieval/v1/mcp";

/** REST 调用示例（真实契约：/v1 前缀，仅 Authorization 头）。 */
export function buildRestSnippet(keyValue: string): string {
  return [
    `curl -X POST '${serverOrigin()}${REST_PATH}?response_format=json' \\`,
    `  -H 'Authorization: Bearer ${keyValue}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"kn_id":"your_kn_id","query":"查询核心业务对象与关系"}'`,
  ].join("\n");
}

/** MCP 客户端配置示例（Cursor / Claude Code 等）。 */
export function buildMcpSnippet(keyValue: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        "bkn-agent-retrieval": {
          type: "http",
          url: `${serverOrigin()}${MCP_PATH}`,
          headers: { Authorization: `Bearer ${keyValue}` },
        },
      },
    },
    null,
    2,
  );
}
