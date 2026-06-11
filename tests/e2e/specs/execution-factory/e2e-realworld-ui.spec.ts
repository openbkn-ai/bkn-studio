import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  cloneToolboxImpexForCreate,
  buildImpexImportName,
} from "../../helpers/impex";
import {
  debugToolFromToolsPage,
  debugMcpToolFromDetailPage,
  executionUnitCard,
  fillAndSubmitQuickAddApi,
  gotoToolboxToolsPage,
  gotoUnitsTab,
  gotoSkillDetailPage,
  importBackupFileViaUi,
  importToolboxOpenApiViaUi,
  openAddCapabilityWizard,
  registerLocalMcpViaUi,
  selectSkillFileInDetailPage,
} from "../../helpers/execution-unit-ui";
import { buildMultiEndpointOpenApiSpec } from "../../helpers/toolbox";
import { buildUniqueName } from "../../helpers/common";
import { buildLogBridgeLogsUrl } from "../../helpers/log-bridge";
import { AMAP_MCP_SSE_URL, LOCAL_MCP_SSE_DOCKER_URL, parseMcpSseViaApi } from "../../helpers/mcp-realworld";
import { buildOfflineWeatherApiUrl } from "../../helpers/oss-mock";
import { cleanupMcpViaApi } from "../../helpers/mcp";
import {
  cleanupOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
import {
  buildSkillName,
  buildSkillZipBuffer,
  cleanupSkillViaApi,
  registerSkillZipViaApi,
} from "../../helpers/skill";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolboxViaApi,
  exportToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";

const ALLOW_NETWORK = process.env.E2E_ALLOW_NETWORK === "1";

test.describe("Execution Factory — Realworld UI scenarios", () => {
  test.describe.configure({ timeout: 240_000 });

  let backendReady = false;
  const createdBoxIds: string[] = [];
  const createdMcpIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdOperators: RegisteredOperator[] = [];

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

    while (createdSkillIds.length > 0) {
      const skillId = createdSkillIds.pop();
      if (!skillId) continue;
      try {
        await cleanupSkillViaApi(request, skillId);
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

  test("RW-UI-01: quick add log bridge tool and debug", async ({ page }) => {
    const toolboxName = buildToolboxName("rw_ui01_logs");
    const toolName = `container_logs_${Date.now()}`;
    const curl = `curl '${buildLogBridgeLogsUrl("ef-operator-integration", { tail: 30, level: "all" })}'`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await gotoToolboxToolsPage(page, boxId, toolboxName);
    const debugResponse = await debugToolFromToolsPage(page, boxId, { toolName });
    expect(debugResponse.ok()).toBeTruthy();
  });

  test("RW-UI-02: backup import clone then debug toolbox tool", async ({ page, request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("rw_ui02_src"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    const exported = (await exportToolboxViaApi(request, toolbox.boxId)) as Record<string, unknown>;
    const importName = buildImpexImportName("at_e2e_rw_ui02_clone");
    const payload = cloneToolboxImpexForCreate(exported, importName);
    const filePath = join(tmpdir(), `e2e-rw-ui02-${Date.now()}.adp`);
    writeFileSync(filePath, JSON.stringify(payload), "utf8");

    await importBackupFileViaUi(page, "toolbox", filePath);

    const list = await request.get(apiUrl("/tool-box/list?page=1&page_size=50"), {
      headers: { "x-business-domain": "bd_public" },
    });
    const body = (await list.json()) as {
      data?: Array<{ box_id: string; box_name?: string; name?: string }>;
    };
    const imported = body.data?.find((item) => (item.box_name ?? item.name) === importName);
    expect(imported?.box_id).toBeTruthy();
    if (!imported?.box_id) {
      return;
    }
    createdBoxIds.push(imported.box_id);

    const tools = await request.get(
      apiUrl(`/tool-box/${imported.box_id}/tools/list?page=1&page_size=20`),
      { headers: { "x-business-domain": "bd_public" } },
    );
    const toolsBody = (await tools.json()) as {
      data?: Array<{ tool_id: string; tool_name?: string; name?: string }>;
      tools?: Array<{ tool_id: string; tool_name?: string; name?: string }>;
    };
    const firstTool = (toolsBody.tools ?? toolsBody.data ?? [])[0];
    const toolName = firstTool?.tool_name ?? firstTool?.name ?? "";
    expect(toolName).toBeTruthy();

    await gotoToolboxToolsPage(page, imported.box_id, importName);
    const debugResponse = await debugToolFromToolsPage(page, imported.box_id, {
      toolName,
      fromListItem: true,
    });
    expect(debugResponse.ok()).toBeTruthy();
  });

  test("RW-UI-03: quick add offline weather API and debug", async ({ page, request }) => {
    const health = await request.get("http://127.0.0.1:8080/health").catch(() => null);
    test.skip(!health?.ok(), "ef-oss-mock is not running on :8080");

    const toolboxName = buildToolboxName("rw_ui03_weather");
    const toolName = `weather_offline_${Date.now()}`;
    const curl = `curl '${buildOfflineWeatherApiUrl()}'`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await gotoToolboxToolsPage(page, boxId, toolboxName);
    const debugResponse = await debugToolFromToolsPage(page, boxId, { toolName });
    expect(debugResponse.ok()).toBeTruthy();
    const debugBody = (await debugResponse.json()) as {
      body?: { city?: string; weather?: string; source?: string };
    };
    expect(debugBody.body?.city).toBeTruthy();
    expect(debugBody.body?.weather).toBeTruthy();
  });

  test("RW-UI-08: quick add with operator sync bundle and debug", async ({ page, request }) => {
    const health = await request.get("http://127.0.0.1:8080/health").catch(() => null);
    test.skip(!health?.ok(), "ef-oss-mock is not running on :8080");

    const toolboxName = buildToolboxName("rw_ui08_bundle");
    const toolName = `weather_bundle_${Date.now()}`;
    const operatorName = `${toolName}_op`;
    const curl = `curl '${buildOfflineWeatherApiUrl()}'`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl,
      summary: toolName,
      toolboxName,
      drawer,
      operatorSync: { enabled: true, name: operatorName },
    });
    createdBoxIds.push(boxId);

    const operators = await request.get(apiUrl("/operator/info/list?page=1&page_size=50"), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(operators.ok()).toBeTruthy();
    const operatorBody = (await operators.json()) as {
      data?: Array<{ operator_id: string; name?: string; version?: string }>;
    };
    const created = operatorBody.data?.find((item) => item.name === toolName || item.name === operatorName);
    if (created?.operator_id && created.version) {
      createdOperators.push({
        operatorId: created.operator_id,
        version: created.version,
        name: created.name ?? operatorName,
      });
    }

    await gotoToolboxToolsPage(page, boxId, toolboxName);
    const debugResponse = await debugToolFromToolsPage(page, boxId, { toolName });
    expect(debugResponse.ok()).toBeTruthy();
  });

  test("RW-UI-03-online: quick add uapis weather when network allowed", async ({ page }) => {
    test.skip(!ALLOW_NETWORK, "set E2E_ALLOW_NETWORK=1 to run online weather UI case");

    const probe = await page.request
      .get("https://uapis.cn/api/v1/misc/weather?city=北京", { timeout: 15_000 })
      .catch(() => null);
    test.skip(!probe?.ok(), "uapis.cn is unreachable");

    const toolboxName = buildToolboxName("rw_ui03_online");
    const toolName = `weather_online_${Date.now()}`;
    const curl = "curl 'https://uapis.cn/api/v1/misc/weather?city=北京'";

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await gotoToolboxToolsPage(page, boxId, toolboxName);
    const debugResponse = await debugToolFromToolsPage(page, boxId, { toolName });
    expect(debugResponse.ok()).toBeTruthy();
  });

  test("RW-UI-04: import OpenAPI fixture via UI submit", async ({ page, request }) => {
    const toolboxName = buildUniqueName("at_e2e_rw04_box");
    const spec = JSON.stringify(buildMultiEndpointOpenApiSpec(toolboxName), null, 2);

    const { boxId } = await importToolboxOpenApiViaUi(page, spec, toolboxName, {
      serviceUrl: "http://127.0.0.1:9000/api/agent-operator-integration",
    });
    expect(boxId).toBeTruthy();
    createdBoxIds.push(boxId);

    const tools = await request.get(
      apiUrl(`/tool-box/${boxId}/tools/list?page=1&page_size=20`),
      { headers: { "x-business-domain": "bd_public" } },
    );
    expect(tools.ok()).toBeTruthy();
    const toolsBody = (await tools.json()) as {
      data?: unknown[];
      tools?: unknown[];
    };
    expect((toolsBody.tools ?? toolsBody.data ?? []).length).toBeGreaterThan(0);
    await expect(executionUnitCard(page, toolboxName)).toBeVisible();
  });

  test("RW-UI-05: amap MCP register via UI and detail debug when configured", async ({
    page,
    request,
  }) => {
    test.skip(!AMAP_MCP_SSE_URL, "set E2E_AMAP_MCP_SSE_URL for Gaode MCP UI test");

    const parsed = await parseMcpSseViaApi(request, AMAP_MCP_SSE_URL);
    const firstTool = parsed.tools?.[0]?.name;
    expect(firstTool).toBeTruthy();
    if (!firstTool) {
      return;
    }

    const mcpName = buildToolboxName("rw_ui05_amap").replace(/toolbox/, "mcp");
    const { mcpId } = await registerLocalMcpViaUi(page, {
      name: mcpName,
      sseUrl: AMAP_MCP_SSE_URL,
    });

    let resolvedMcpId = mcpId;
    if (!resolvedMcpId) {
      const list = await request.get(apiUrl("/mcp/list?page=1&page_size=20"), {
        headers: { "x-business-domain": "bd_public" },
      });
      const body = (await list.json()) as {
        data?: Array<{ mcp_id: string | number; name?: string }>;
      };
      resolvedMcpId = String(body.data?.find((item) => item.name === mcpName)?.mcp_id ?? "");
    }
    expect(resolvedMcpId).toBeTruthy();
    if (!resolvedMcpId) {
      return;
    }
    createdMcpIds.push(resolvedMcpId);

    const debugResponse = await debugMcpToolFromDetailPage(
      page,
      resolvedMcpId,
      mcpName,
      firstTool,
      { argumentsPayload: "{}" },
    );
    expect(debugResponse.ok()).toBeTruthy();
  });

  test("RW-UI-06: register local MCP via SSE wizard and echo debug", async ({ page, request }) => {
    const health = await request.get("http://127.0.0.1:8096/health").catch(() => null);
    test.skip(!health?.ok(), "ef-mcp-mock is not running on :8096");

    const mcpName = buildToolboxName("rw_ui06_mcp").replace(/toolbox/, "mcp");
    await registerLocalMcpViaUi(page, {
      name: mcpName,
      sseUrl: LOCAL_MCP_SSE_DOCKER_URL,
    });

    const list = await request.get(apiUrl("/mcp/list?page=1&page_size=20"), {
      headers: { "x-business-domain": "bd_public" },
    });
    const body = (await list.json()) as {
      data?: Array<{ mcp_id: string | number; name?: string }>;
    };
    const created = body.data?.find((item) => item.name === mcpName);
    if (created?.mcp_id) {
      createdMcpIds.push(String(created.mcp_id));
    }
    await expect(executionUnitCard(page, mcpName)).toBeVisible();

    const mcpId = created?.mcp_id ? String(created.mcp_id) : "";
    expect(mcpId).toBeTruthy();
    if (!mcpId) {
      return;
    }

    const debugResponse = await debugMcpToolFromDetailPage(page, mcpId, mcpName, "echo", {
      argumentsPayload: JSON.stringify({ message: "hello-rw-ui06" }),
    });
    expect(debugResponse.ok()).toBeTruthy();
  });

  test("RW-UI-07: skill detail preview and update package UI", async ({ page, request }) => {
    const skillName = buildSkillName("rw_ui07");
    const skill = await registerSkillZipViaApi(request, skillName);
    createdSkillIds.push(skill.skillId);

    await gotoSkillDetailPage(page, skill.skillId, skillName);
    await selectSkillFileInDetailPage(page, "refs/guide.md");
    await expect(page.locator('[class*="ioPanel"] pre')).toContainText("# Guide", {
      timeout: 45_000,
    });

    const updatedZipPath = join(tmpdir(), `skill-rw-ui07-upd-${Date.now()}.zip`);
    writeFileSync(updatedZipPath, buildSkillZipBuffer(`${skillName}_v2`));

    await gotoUnitsTab(page, "skill");
    const card = executionUnitCard(page, skillName);
    await card.getByRole("button", { name: /更多操作|More/i }).click();
    await page.getByRole("menuitem", { name: /更新包|Update Package/i }).click();
    const updateModal = page.locator(".ant-modal").last();
    await updateModal.locator('input[type="file"]').setInputFiles(updatedZipPath);
    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes(`/skills/${skill.skillId}/package`),
      { timeout: 120_000 },
    );
    await Promise.all([
      updateResponsePromise,
      updateModal.getByRole("button", { name: /确\s*定|^Confirm$|^OK$/i }).click(),
    ]);
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.ok()).toBeTruthy();
  });
});
