import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  debugToolFromToolsPage,
  expectAppToast,
  expectOpenApiOperationsIoPreview,
  executionUnitCard,
  fillAndSubmitQuickAddApi,
  gotoToolboxToolsPage,
  gotoUnitsTab,
  openAddCapabilityWizard,
  triggerImpexExport,
  waitForCategoryFieldReady,
} from "../../helpers/execution-unit-ui";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";

const QUICK_API_CURL =
  "curl 'http://127.0.0.1:9000/api/agent-operator-integration/v1/operator/info/list?page=1&page_size=1'";

const UAPIS_WEATHER_CURL = "curl 'https://uapis.cn/api/v1/misc/weather?city=北京'";

test.describe("Execution Factory — Quick Add API lifecycle", () => {
  test.describe.configure({ timeout: 180_000 });

  let backendReady = false;
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
    while (createdBoxIds.length > 0) {
      const boxId = createdBoxIds.pop();
      if (!boxId) {
        continue;
      }
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

  test("QA-01: quick add API wizard creates toolset and tool", async ({ page }) => {
    const toolboxName = buildToolboxName("quick_api");
    const toolName = `list_operators_${Date.now()}`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");

    const { boxId, toolIds } = await fillAndSubmitQuickAddApi(page, {
      curl: QUICK_API_CURL,
      summary: toolName,
      toolboxName,
      drawer,
    });

    expect(boxId).toBeTruthy();
    expect(toolIds.length).toBeGreaterThan(0);
    createdBoxIds.push(boxId);

    await expect(page).toHaveURL(new RegExp(`/execution-factory/toolboxes/${boxId}/tools`));
    await expectAppToast(page, /已添加到工具集|added to the toolset/i);
    await expect(page.getByRole("heading", { level: 3, name: toolboxName })).toBeVisible();
  });

  test("QA-01b: quick add API from cURL tab submits parsed service URL", async ({ page }) => {
    const toolboxName = buildToolboxName("quick_api_curl");
    const toolName = `manual_http_weather_${Date.now()}`;
    const curl =
      'curl -X GET "http://host.docker.internal:8080/proxy/uapis/weather"';

    const drawer = await openAddCapabilityWizard(page, "toolbox");

    await drawer.getByRole("textbox", { name: /cURL/i }).fill(curl);
    await drawer.getByRole("button", { name: /识别接口信息|Detect API details/i }).click();
    await drawer.getByLabel(/工具名称|Tool name/i).fill(toolName);
    await drawer.getByRole("radio", { name: /新建工具集|New toolset/i }).check();
    await drawer.getByLabel(/工具箱名称|Toolbox Name/i).fill(toolboxName);
    await waitForCategoryFieldReady(page, drawer);
    await expectOpenApiOperationsIoPreview(drawer, { containsText: /GET/i });

    await drawer.locator(".ant-drawer-body").evaluate((body) => {
      body.scrollTop = body.scrollHeight;
    });

    const saveButton = drawer.getByRole("button", { name: /保存并完成|Save and finish/i });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page).toHaveURL(/\/execution-factory\/toolboxes\/[^/]+\/tools/, {
      timeout: 180_000,
    });
    await expect(page.getByText("http://host.docker.internal:8080")).toBeVisible({
      timeout: 30_000,
    });
    const currentUrl = new URL(page.url());
    const boxId = currentUrl.pathname.match(/\/toolboxes\/([^/]+)/)?.[1] ?? "";
    expect(boxId).toBeTruthy();
    createdBoxIds.push(boxId);
  });

  test("QA-01c: quick add API previews JSON request body parsed from cURL", async ({ page }) => {
    const curl = `curl -X POST https://api.example.com/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"test","password":"123456"}'`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");

    await drawer.getByRole("textbox", { name: /cURL/i }).fill(curl);

    await expectOpenApiOperationsIoPreview(drawer, {
      containsText: /请求体 2 个字段|request body 2 field/i,
    });
    await expect(drawer.getByText(/username/i).first()).toBeVisible();
    await expect(drawer.getByText(/password/i).first()).toBeVisible();
  });

  test("QA-02: quick added toolset supports publish and export", async ({ page, request }) => {
    const toolboxName = buildToolboxName("quick_api_pub");
    const toolName = `health_probe_${Date.now()}`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl: QUICK_API_CURL,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await publishToolboxViaApi(request, boxId);

    const detail = await request.get(apiUrl(`/tool-box/${boxId}`), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(detail.ok()).toBeTruthy();
    const body = (await detail.json()) as { status?: string; data?: { status?: string } };
    expect(body.status ?? body.data?.status).toBe("published");

    await gotoToolboxToolsPage(page, boxId, toolboxName, { editMode: true });
    await triggerImpexExport(page, "toolbox", async () => {
      await page.getByRole("button", { name: /导出|Export/i }).first().click();
    });
  });

  test("QA-03: quick added toolset appears on management list", async ({ page }) => {
    const toolboxName = buildToolboxName("quick_api_list");
    const toolName = `market_list_${Date.now()}`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl: QUICK_API_CURL,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await gotoUnitsTab(page, "toolbox");
    await expect(executionUnitCard(page, toolboxName)).toBeVisible();
  });

  test("QA-04: quick added tool can be debugged from tools page", async ({ page }) => {
    const toolboxName = buildToolboxName("quick_api_dbg");
    const toolName = `debug_probe_${Date.now()}`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl: QUICK_API_CURL,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await gotoToolboxToolsPage(page, boxId, toolboxName);
    const debugResponse = await debugToolFromToolsPage(page, boxId, { toolName });
    const debugBody = (await debugResponse.json()) as {
      status_code?: number;
      error?: string;
    };
    expect(debugBody.error).toBeFalsy();
    expect(debugBody.status_code).toBeGreaterThanOrEqual(200);
    expect(debugBody.status_code).toBeLessThan(500);
  });

  test("QA-06: quick add wizard shows IO preview before save", async ({ page }) => {
    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const apiUrl = QUICK_API_CURL.match(/https?:\/\/[^\s'"]+/i)?.[0] ?? "";

    await drawer.getByRole("tab", { name: /填表单|Fill form/i }).click();
    await drawer.getByLabel(/完整 API 地址|Full API URL/i).fill(apiUrl);
    await drawer.getByRole("button", { name: /识别接口信息|Detect API details/i }).click();
    await drawer.getByLabel(/工具名称|Tool name/i).fill(`preview_${Date.now()}`);
    await expectOpenApiOperationsIoPreview(drawer, { containsText: /GET|POST/i });
    await page.keyboard.press("Escape");
  });

  test("QA-07: tool list debug button opens debug modal", async ({ page }) => {
    const toolboxName = buildToolboxName("quick_api_list_dbg");
    const toolName = `list_debug_${Date.now()}`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl: QUICK_API_CURL,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await gotoToolboxToolsPage(page, boxId, toolboxName);
    await expect(page.getByText(/输入输出|Input \/ Output/i).first()).toBeVisible();
    const debugResponse = await debugToolFromToolsPage(page, boxId, {
      toolName,
      fromListItem: true,
    });
    expect(debugResponse.ok()).toBeTruthy();
  });

  test("QA-05: optional uapis weather curl quick add when network available", async ({
    page,
    request,
  }) => {
    const probe = await request
      .get("https://uapis.cn/api/v1/misc/weather?city=北京", { timeout: 15_000 })
      .catch(() => null);
    test.skip(!probe?.ok(), "uapis.cn is unreachable from this environment");

    const toolboxName = buildToolboxName("uapis_weather");
    const toolName = `weather_${Date.now()}`;

    const drawer = await openAddCapabilityWizard(page, "toolbox");
    const { boxId } = await fillAndSubmitQuickAddApi(page, {
      curl: UAPIS_WEATHER_CURL,
      summary: toolName,
      toolboxName,
      drawer,
    });
    createdBoxIds.push(boxId);

    await expect(page).toHaveURL(new RegExp(`/execution-factory/toolboxes/${boxId}/tools`));
    await expect(page.getByRole("heading", { level: 3, name: toolboxName })).toBeVisible();
  });
});
