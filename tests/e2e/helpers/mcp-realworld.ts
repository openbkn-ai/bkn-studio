import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, buildUniqueName, defaultApiHeaders, expectOk } from "./common";

export const LOCAL_MCP_SSE_HOST_URL =
  process.env.E2E_LOCAL_MCP_SSE_URL ?? "http://127.0.0.1:8096/sse";
export const LOCAL_MCP_SSE_DOCKER_URL = "http://ef-mcp-mock:8096/sse";
export const AMAP_MCP_SSE_URL = process.env.E2E_AMAP_MCP_SSE_URL ?? "";

export function buildMcpRealworldName(suffix?: string) {
  return buildUniqueName(suffix ? `at_e2e_mcp_rw_${suffix}` : "at_e2e_mcp_rw");
}

export async function assertLocalMcpMockHealthy(request: APIRequestContext) {
  const response = await request.get(LOCAL_MCP_SSE_HOST_URL.replace(/\/sse$/, "/health"));
  if (!response.ok()) {
    throw new Error(`ef-mcp-mock unavailable (${response.status()})`);
  }
}

export async function parseMcpSseViaApi(
  request: APIRequestContext,
  url: string,
  headers?: Record<string, string>,
) {
  const response = await request.post(`${API_PREFIX}/mcp/parse/sse`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      mode: "sse",
      url,
      headers: headers ?? {},
    },
  });
  await expectOk(response, "Parse MCP SSE");
  return response.json() as Promise<{
    tools?: Array<{ name?: string; description?: string }>;
  }>;
}

export async function createSseMcpViaApi(
  request: APIRequestContext,
  name: string,
  url: string,
  options?: { description?: string; headers?: Record<string, string> },
) {
  const response = await request.post(`${API_PREFIX}/mcp`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      name,
      description: options?.description ?? "E2E SSE MCP",
      mode: "sse",
      url,
      headers: options?.headers ?? {},
      source: "custom",
      category: "other_category",
    },
  });
  await expectOk(response, "Create SSE MCP");
  const body = (await response.json()) as { mcp_id?: string | number; name?: string };
  if (!body.mcp_id) {
    throw new Error(`Create SSE MCP failed: ${JSON.stringify(body)}`);
  }
  return { mcpId: String(body.mcp_id), name: body.name ?? name };
}

export async function debugMcpToolViaApi(
  request: APIRequestContext,
  mcpId: string,
  toolName: string,
  parameters: Record<string, unknown> = {},
) {
  const response = await request.post(`${API_PREFIX}/mcp/${mcpId}/tool/${toolName}/debug`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: parameters,
  });
  await expectOk(response, `Debug MCP tool ${toolName}`);
  return response.json() as Promise<{
    content?: Array<{ type?: string; text?: string }>;
    is_error?: boolean;
    error?: string;
  }>;
}

export async function updateMcpViaApi(
  request: APIRequestContext,
  mcpId: string,
  patch: { description?: string },
) {
  const response = await request.put(`${API_PREFIX}/mcp/${mcpId}`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: patch,
  });
  await expectOk(response, "Update MCP");
}
