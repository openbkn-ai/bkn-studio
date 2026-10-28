/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { assertBackendReady, apiUrl } from "../../helpers/common";
import {
  buildImpexImportName,
  cloneMcpImpexForCreate,
  cloneToolboxImpexForCreate,
} from "../../helpers/impex";
import {
  buildMcpName,
  cleanupMcpViaApi,
  createToolImportedMcpViaApi,
  exportMcpViaApi,
  importMcpViaApi,
} from "../../helpers/mcp";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolViaApi,
  createToolboxViaApi,
  exportToolboxViaApi,
  importToolboxViaApi,
} from "../../helpers/toolbox";

test.describe("Execution Factory — Impex E2E flows", () => {
  let backendReady = false;
  const createdBoxIds: string[] = [];
  const createdMcpIds: string[] = [];

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
        console.warn(`Cleanup MCP ${mcpId}: ${String(error)}`);
      }
    }

    while (createdBoxIds.length > 0) {
      const boxId = createdBoxIds.pop();
      if (!boxId) continue;
      try {
        await cleanupToolboxViaApi(request, boxId);
      } catch (error) {
        console.warn(`Cleanup toolbox ${boxId}: ${String(error)}`);
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("IMPEX-03: toolbox import create mode with cloned ids", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("impex_src_box"));
    createdBoxIds.push(toolbox.boxId);

    const exported = (await exportToolboxViaApi(request, toolbox.boxId)) as Record<string, unknown>;
    const importName = buildImpexImportName("at_e2e_impex_box_create");
    const payload = cloneToolboxImpexForCreate(exported, importName);

    await importToolboxViaApi(request, payload, "create");

    const newBoxId = (payload.toolbox as { configs?: Array<{ box_id?: string }> })?.configs?.[0]
      ?.box_id;
    expect(newBoxId).toBeTruthy();
    if (newBoxId) {
      createdBoxIds.push(newBoxId);
      const detail = await request.get(apiUrl(`/tool-box/${newBoxId}`));
      expect(detail.ok()).toBeTruthy();
    }
  });

  test("IMPEX-04: MCP import create mode with cloned ids", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("mcp_impex_create_box"));
    createdBoxIds.push(toolbox.boxId);
    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("mcp_impex_tool"));

    const mcp = await createToolImportedMcpViaApi(
      request,
      buildMcpName("impex_src"),
      toolbox,
      tool,
    );
    createdMcpIds.push(mcp.mcpId);

    const exported = (await exportMcpViaApi(request, mcp.mcpId)) as Record<string, unknown>;
    const importName = buildImpexImportName("at_e2e_impex_mcp_create");
    const payload = cloneMcpImpexForCreate(exported, importName);

    await importMcpViaApi(request, payload, "create");

    const newMcpId = (payload.mcp as { configs?: Array<{ mcp_id?: string }> })?.configs?.[0]
      ?.mcp_id;
    expect(newMcpId).toBeTruthy();
    if (newMcpId) {
      createdMcpIds.push(String(newMcpId));
    }
    const newBoxId = (payload.toolbox as { configs?: Array<{ box_id?: string }> })?.configs?.[0]
      ?.box_id;
    if (newBoxId) {
      createdBoxIds.push(String(newBoxId));
    }
  });
});
