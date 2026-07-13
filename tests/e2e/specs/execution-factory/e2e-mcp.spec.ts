/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  buildMcpName,
  cleanupMcpViaApi,
  createToolImportedMcpViaApi,
  exportMcpViaApi,
  importMcpViaApi,
  publishMcpViaApi,
} from "../../helpers/mcp";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolViaApi,
  createToolboxViaApi,
} from "../../helpers/toolbox";

test.describe("Execution Factory — MCP E2E flows", () => {
  let backendReady = false;
  const createdMcpIds: string[] = [];
  const createdBoxIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    try {
      await assertBackendReady(request);
      backendReady = true;
    } catch (error) {
      backendReady = false;
      console.warn(String(error));
    }
  });

  test.afterEach(async ({ request }) => {
    while (createdMcpIds.length > 0) {
      const mcpId = createdMcpIds.pop();
      if (!mcpId) continue;
      try {
        await cleanupMcpViaApi(request, mcpId);
      } catch (error) {
        console.warn(`Cleanup failed for MCP ${mcpId}: ${String(error)}`);
      }
    }

    while (createdBoxIds.length > 0) {
      const boxId = createdBoxIds.pop();
      if (!boxId) continue;
      try {
        await cleanupToolboxViaApi(request, boxId);
      } catch (error) {
        console.warn(`Cleanup failed for toolbox ${boxId}: ${String(error)}`);
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("MCP-01: create tool_imported MCP", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("mcp_box"));
    createdBoxIds.push(toolbox.boxId);
    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("mcp_tool"));

    const mcp = await createToolImportedMcpViaApi(
      request,
      buildMcpName("tool_imported"),
      toolbox,
      tool,
    );
    createdMcpIds.push(mcp.mcpId);

    const detail = await request.get(apiUrl(`/mcp/${mcp.mcpId}`), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(detail.ok()).toBeTruthy();
  });

  test("MCP-02: publish MCP and verify market", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("mcp_pub_box"));
    createdBoxIds.push(toolbox.boxId);
    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("mcp_pub_tool"));

    const mcp = await createToolImportedMcpViaApi(
      request,
      buildMcpName("publish"),
      toolbox,
      tool,
    );
    createdMcpIds.push(mcp.mcpId);

    await publishMcpViaApi(request, mcp.mcpId);

    const market = await request.get(apiUrl("/mcp/market/list?page=1&page_size=20"), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(market.ok()).toBeTruthy();
    const body = (await market.json()) as { data?: Array<{ mcp_id: string | number }> };
    expect(
      body.data?.some((item) => String(item.mcp_id) === mcp.mcpId),
    ).toBeTruthy();
  });

  test("MCP-03: impex export then import copy", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("mcp_impex_box"));
    createdBoxIds.push(toolbox.boxId);
    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("mcp_impex_tool"));

    const mcp = await createToolImportedMcpViaApi(
      request,
      buildMcpName("impex"),
      toolbox,
      tool,
    );
    createdMcpIds.push(mcp.mcpId);

    const exported = await exportMcpViaApi(request, mcp.mcpId);
    expect(exported).toBeTruthy();
    await importMcpViaApi(request, exported, "upsert");
  });
});
