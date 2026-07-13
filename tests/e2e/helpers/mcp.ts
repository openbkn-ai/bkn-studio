/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, buildUniqueName, defaultApiHeaders, expectOk } from "./common";
import type { ToolRecord, ToolboxRecord } from "./toolbox";

export type McpRecord = {
  mcpId: string;
  name: string;
};

export function buildMcpName(suffix?: string) {
  return buildUniqueName(suffix ? `at_e2e_mcp_${suffix}` : "at_e2e_mcp");
}

export async function createToolImportedMcpViaApi(
  request: APIRequestContext,
  name: string,
  toolbox: ToolboxRecord,
  tool: ToolRecord,
): Promise<McpRecord> {
  const response = await request.post(`${API_PREFIX}/mcp`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      name,
      description: "E2E tool_imported MCP",
      mode: "stream",
      source: "custom",
      category: "other_category",
      creation_type: "tool_imported",
      tool_configs: [
        {
          box_id: toolbox.boxId,
          tool_id: tool.toolId,
          tool_name: tool.name,
          description: "E2E MCP imported tool",
        },
      ],
    },
  });

  await expectOk(response, "Create MCP");

  const body = (await response.json()) as { mcp_id?: string | number; name?: string };
  if (!body.mcp_id) {
    throw new Error(`Create MCP failed: ${JSON.stringify(body)}`);
  }

  return { mcpId: String(body.mcp_id), name: body.name ?? name };
}

export async function publishMcpViaApi(request: APIRequestContext, mcpId: string) {
  const response = await request.post(`${API_PREFIX}/mcp/${mcpId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "published" },
  });
  await expectOk(response, "Publish MCP");
}

export async function exportMcpViaApi(request: APIRequestContext, mcpId: string) {
  const response = await request.get(`${API_PREFIX}/impex/export/mcp/${mcpId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Export MCP");
  return response.json();
}

export async function importMcpViaApi(
  request: APIRequestContext,
  payload: unknown,
  mode: "create" | "upsert" = "create",
) {
  const response = await request.post(`${API_PREFIX}/impex/import/mcp`, {
    headers: defaultApiHeaders(),
    multipart: {
      mode,
      data: {
        name: "import.adp.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(payload)),
      },
    },
  });
  await expectOk(response, "Import MCP");
  const text = await response.text();
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}

export async function unpublishMcpViaApi(request: APIRequestContext, mcpId: string) {
  const response = await request.post(`${API_PREFIX}/mcp/${mcpId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "unpublish" },
  });
  await expectOk(response, "Unpublish MCP");
}

export async function offlineMcpViaApi(request: APIRequestContext, mcpId: string) {
  const response = await request.post(`${API_PREFIX}/mcp/${mcpId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "offline" },
  });
  await expectOk(response, "Offline MCP");
}

export async function deleteMcpViaApi(request: APIRequestContext, mcpId: string) {
  try {
    await request.post(`${API_PREFIX}/mcp/${mcpId}/status`, {
      headers: {
        ...defaultApiHeaders(),
        "Content-Type": "application/json",
      },
      data: { status: "offline" },
    });
  } catch {
    // Ignore offline errors.
  }

  const response = await request.delete(`${API_PREFIX}/mcp/${mcpId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Delete MCP");
}

export async function cleanupMcpViaApi(request: APIRequestContext, mcpId: string) {
  await deleteMcpViaApi(request, mcpId);
}
