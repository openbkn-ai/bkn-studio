import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  cloneOperatorImpexForCreate,
  cloneToolboxImpexForCreate,
  buildImpexImportName,
} from "../../helpers/impex";
import {
  exportFromCardMenu,
  gotoUnitsTab,
  importBackupFileViaUi,
} from "../../helpers/execution-unit-ui";
import {
  buildOperatorName,
  cleanupOperatorViaApi,
  exportOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolboxViaApi,
  createToolViaApi,
  exportToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";
import {
  buildMcpName,
  cleanupMcpViaApi,
  createToolImportedMcpViaApi,
} from "../../helpers/mcp";

test.describe("Execution Factory — Impex UI E2E flows", () => {
  test.describe.configure({ timeout: 180_000 });

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
        console.warn(String(error));
      }
    }

    while (createdOperators.length > 0) {
      const operator = createdOperators.pop();
      if (!operator) continue;
      try {
        await cleanupOperatorViaApi(request, operator);
      } catch (error) {
        console.warn(String(error));
      }
    }

    while (createdBoxIds.length > 0) {
      const boxId = createdBoxIds.pop();
      if (!boxId) continue;
      try {
        await cleanupToolboxViaApi(request, boxId);
      } catch (error) {
        console.warn(String(error));
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("IMPEX-UI-01: import operator backup file through UI", async ({ page, request }) => {
    const source = await registerOperatorViaApi(request, buildOperatorName("ui_impex_src"));
    createdOperators.push(source);

    const exported = (await exportOperatorViaApi(request, source.operatorId)) as Record<
      string,
      unknown
    >;
    const importName = buildImpexImportName("at_e2e_ui_impex");
    const payload = cloneOperatorImpexForCreate(exported, importName);
    const filePath = join(tmpdir(), `e2e-operator-${Date.now()}.adp`);
    writeFileSync(filePath, JSON.stringify(payload), "utf8");

    await importBackupFileViaUi(page, "operator", filePath);

    const list = await request.get(apiUrl("/operator/info/list?page=1&page_size=50"), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as {
      data?: Array<{ operator_id: string; name?: string; version: string }>;
    };
    const imported = body.data?.find((item) => item.name === importName);
    expect(imported).toBeTruthy();
    if (imported) {
      createdOperators.push({
        operatorId: imported.operator_id,
        version: imported.version,
        name: importName,
      });
    }
  });

  test("IMPEX-UI-02: export operator backup from card menu", async ({ page, request }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("ui_export"));
    createdOperators.push(operator);

    await gotoUnitsTab(page, "operator");
    await exportFromCardMenu(page, operator.name, "operator");
  });

  test("IMPEX-UI-03: export toolbox backup from card menu", async ({ page, request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_export"));
    createdBoxIds.push(toolbox.boxId);

    await gotoUnitsTab(page, "toolbox");
    await exportFromCardMenu(page, toolbox.name, "toolbox");
  });

  test("IMPEX-UI-04: export MCP backup from card menu", async ({ page, request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_mcp_box"));
    createdBoxIds.push(toolbox.boxId);
    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("ui_mcp_tool"));
    const mcp = await createToolImportedMcpViaApi(
      request,
      buildMcpName("ui_export"),
      toolbox,
      tool,
    );
    createdMcpIds.push(mcp.mcpId);

    await gotoUnitsTab(page, "mcp");
    await exportFromCardMenu(page, mcp.name, "mcp");
  });

  test("IMPEX-UI-05: published toolbox backup roundtrip via UI import", async ({
    page,
    request,
  }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_roundtrip"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    const exported = (await exportToolboxViaApi(request, toolbox.boxId)) as Record<string, unknown>;
    const importName = buildImpexImportName("ui_roundtrip_copy");
    const payload = cloneToolboxImpexForCreate(exported, importName);
    const filePath = join(tmpdir(), `e2e-toolbox-${Date.now()}.adp`);
    writeFileSync(filePath, JSON.stringify(payload), "utf8");

    await importBackupFileViaUi(page, "toolbox", filePath);

    const list = await request.get(apiUrl("/tool-box/list?page=1&page_size=50"), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as {
      data?: Array<{ box_id: string; box_name?: string; name?: string }>;
    };
    const imported = body.data?.find(
      (item) => (item.box_name ?? item.name) === importName,
    );
    expect(imported?.box_id).toBeTruthy();
    if (imported?.box_id) {
      createdBoxIds.push(imported.box_id);
    }
  });
});
