import { expect, test } from "@playwright/test";

import { assertBackendReady, apiUrl } from "../../helpers/common";
import {
  buildImpexImportName,
  cloneMcpImpexForCreate,
  cloneOperatorImpexForCreate,
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
  buildOperatorName,
  cleanupOperatorViaApi,
  exportOperatorViaApi,
  importOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
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
  const createdOperators: RegisteredOperator[] = [];
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

    while (createdOperators.length > 0) {
      const operator = createdOperators.pop();
      if (!operator) continue;
      try {
        await cleanupOperatorViaApi(request, operator);
      } catch (error) {
        console.warn(`Cleanup operator ${operator.operatorId}: ${String(error)}`);
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

  test("IMPEX-01: operator import create mode with cloned ids", async ({ request }) => {
    const source = await registerOperatorViaApi(request, buildOperatorName("impex_src"));
    createdOperators.push(source);

    const exported = (await exportOperatorViaApi(request, source.operatorId)) as Record<
      string,
      unknown
    >;
    const importName = buildImpexImportName("at_e2e_impex_op_create");
    const payload = cloneOperatorImpexForCreate(exported, importName);

    await importOperatorViaApi(request, payload, "create");

    const list = await request.get(
      apiUrl(`/operator/info/list?page=1&page_size=50&name=${encodeURIComponent(importName)}`),
      { headers: { "x-business-domain": "bd_public" } },
    );
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as {
      data?: Array<{ operator_id: string; name?: string; version: string }>;
    };
    const imported = body.data?.find((item) => item.name === importName);
    expect(imported?.operator_id).toBeTruthy();
    if (imported) {
      createdOperators.push({
        operatorId: imported.operator_id,
        version: imported.version,
        name: importName,
      });
    }
  });

  test("IMPEX-02: operator import upsert updates existing resource", async ({ request }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("impex_upsert"));
    createdOperators.push(operator);

    const exported = (await exportOperatorViaApi(request, operator.operatorId)) as Record<
      string,
      unknown
    >;
    const item = (exported.operator as { configs?: Array<Record<string, unknown>> })?.configs?.[0];
    const metadata = item?.metadata as Record<string, unknown> | undefined;
    if (metadata) {
      metadata.description = "E2E upserted operator description";
    }

    await importOperatorViaApi(request, exported, "upsert");

    const reExported = (await exportOperatorViaApi(request, operator.operatorId)) as Record<
      string,
      unknown
    >;
    const reItem = (reExported.operator as { configs?: Array<Record<string, unknown>> })
      ?.configs?.[0];
    const reMetadata = reItem?.metadata as Record<string, unknown> | undefined;
    expect(String(reMetadata?.description ?? "")).toContain("upserted");
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
      const detail = await request.get(apiUrl(`/tool-box/${newBoxId}`), {
        headers: { "x-business-domain": "bd_public" },
      });
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

    const newMcpId = (payload.mcp as { configs?: Array<{ mcp_id?: string }> })?.configs?.[0]?.mcp_id;
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
