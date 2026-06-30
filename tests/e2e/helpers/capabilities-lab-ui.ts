import { writeFileSync } from "node:fs";

import { expect, type Page } from "@playwright/test";

import { buildLabWeatherOpenApi } from "./capabilities-lab";
import { BUSINESS_DOMAIN } from "./common";

export const LAB_UI_PERMISSIONS = [
  "execution-factory-lab:capability:view",
  "execution-factory-lab:capability:create",
  "execution-factory-lab:capability:edit",
  "execution-factory-lab:capability:publish",
  "execution-factory-lab:capability:delete",
  "execution-factory-lab:capability:debug",
  "execution-factory-lab:mcp:create",
  "execution-factory-lab:mcp:publish",
  "execution-factory-lab:mcp:delete",
  "execution-factory-lab:mcp:debug",
  "execution-factory-lab:skill:create",
  "execution-factory-lab:skill:publish",
  "execution-factory-lab:skill:delete",
  "execution-factory-lab:impex:export",
  "execution-factory-lab:impex:import",
  "execution-factory-lab:catalog:view",
  "execution-factory-lab:catalog:install",
  "execution-factory-lab:function:create",
  "execution-factory-lab:function:debug",
];

const STUDIO_API_BASE_URL =
  process.env.E2E_STUDIO_API_BASE_URL ?? "http://127.0.0.1:9010/api";
const STUDIO_BASE_PATH = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173")
  .pathname.replace(/\/$/, "");

function studioPath(path: string) {
  return `${STUDIO_BASE_PATH}${path}`;
}

const CAPABILITY_NAME_LABEL = /能力名称|Capability name/i;
const PYTHON_CODE_LABEL = /Python 代码|Python code/i;
const FUNCTION_DRAWER_TITLE = /创建函数|添加 Function 能力|Add Function capability/i;

/** Ant Design inserts spaces between CJK chars in buttons (e.g. �?�?. */
function cjk(text: string) {
  return text.split("").join("\\s*");
}

const BTN_CREATE_CAPABILITY = new RegExp(`${cjk("创建能力")}|Create capability`, "i");
const BTN_IMPORT = new RegExp(`^${cjk("导入")}$|^Import$`, "i");
const BTN_EDIT = new RegExp(`${cjk("编辑")}|Edit`, "i");
const BTN_SAVE = new RegExp(`${cjk("保存")}|Save`, "i");
const BTN_PUBLISH = new RegExp(`${cjk("发布")}|Publish`, "i");
const BTN_MORE = new RegExp(`${cjk("更多")}|More`, "i");
const BTN_DEBUG = new RegExp(`${cjk("运行调试")}|Run debug`, "i");
const BTN_RUN_PYTHON = /用输入示例运行|运行\s*Python\s*调试|Run Python debug/i;
const BTN_CREATE_FUNCTION = /先运行再创建|创建\s*Function\s*能力|Create function capability/i;
const BTN_REGISTER_MCP = /注册\s*MCP|Register MCP/i;
const BTN_IMPORT_SKILL = /导入\s*Skill|Import Skill/i;
const BTN_IMPORT_PACKAGE = new RegExp(`${cjk("导入包")}|Import package`, "i");
const BTN_PARSE_SSE = new RegExp(`${cjk("解析 SSE")}|Parse SSE`, "i");
const BTN_CONFIRM = new RegExp(`${cjk("确定")}|OK|Yes|Confirm`, "i");
const BTN_DELETE = new RegExp(`${cjk("删除")}|Delete`, "i");
const BTN_INSTALL = new RegExp(`${cjk("安装")}|^Install$`, "i");

const BTN_ENABLE_ORCHESTRATION = /启用\s*流程编排|Enable orchestration/i;
const BTN_SAVE_OPERATOR_SETTINGS = /保存\s*算子设置|Save operator settings/i;
const BTN_DISABLE_ORCHESTRATION = /取消\s*流程编排|Disable orchestration/i;

async function maybeDismissInfoModal(page: Page, titlePattern: RegExp) {
  const modal = page.locator(".ant-modal").filter({ hasText: titlePattern });
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByRole("button", { name: /知道了|确定|OK|Got it/i }).click();
  }
}

async function expectLabActionFeedback(
  page: Page,
  options: { toast?: RegExp; capabilityName?: string },
) {
  if (options.toast) {
    await page
      .locator(".ant-message-notice-content")
      .filter({ hasText: options.toast })
      .first()
      .waitFor({ state: "visible", timeout: 5_000 })
      .catch(() => undefined);
  }

  if (options.capabilityName) {
    const detail = capabilityDetailDrawer(page);
    const card = capabilityCard(page, options.capabilityName);
    await expect(detail.or(card).first()).toBeVisible({ timeout: 20_000 });
  }
}

async function confirmPopconfirm(page: Page) {
  const popconfirm = page.locator(".ant-popconfirm");
  await expect(popconfirm).toBeVisible({ timeout: 10_000 });
  await popconfirm.getByRole("button", { name: BTN_CONFIRM }).click();
}

async function confirmModal(page: Page, titlePattern?: RegExp) {
  const modal = titlePattern
    ? page.locator(".ant-modal, [role='dialog']").filter({ hasText: titlePattern })
    : page.locator(".ant-modal-confirm, .ant-modal").last();
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await modal.getByRole("button", { name: BTN_CONFIRM }).click();
}

export async function ensureOverviewTab(page: Page) {
  const drawer = capabilityDetailDrawer(page);
  const overviewTab = drawer.getByRole("tab", { name: /概览|Overview/i });
  if ((await overviewTab.getAttribute("aria-selected")) !== "true") {
    await overviewTab.click();
  }
}

export async function ensureLabE2eRuntime(page: Page) {
  await page.addInitScript(({ apiBaseUrl, businessDomainId, permissions }) => {
    window.__BKN_STUDIO_RUNTIME__ = {
      ...(window.__BKN_STUDIO_RUNTIME__ ?? {}),
      apiBaseUrl,
      mode: "hosted",
      currentUser: {
        ...(window.__BKN_STUDIO_RUNTIME__?.currentUser ?? {}),
        businessDomainId,
        permissions,
      },
    };
  }, {
    apiBaseUrl: STUDIO_API_BASE_URL,
    businessDomainId: BUSINESS_DOMAIN,
    permissions: LAB_UI_PERMISSIONS,
  });
}

export async function gotoCapabilitiesLab(page: Page) {
  await ensureLabE2eRuntime(page);
  await page.goto(studioPath("/execution-factory-lab/capabilities"));
  await expect(
    page.getByRole("heading", { level: 2, name: /能力库|Capability Library/i }),
  ).toBeVisible({ timeout: 60_000 });
}

export async function gotoCatalogLab(page: Page) {
  await ensureLabE2eRuntime(page);
  await page.goto(studioPath("/execution-factory-lab/catalog"));
  await expect(
    page.getByRole("heading", { level: 2, name: /能力市场|Capability Catalog/i }),
  ).toBeVisible({ timeout: 60_000 });
}

export function catalogCard(page: Page, name: string) {
  return page.locator("article").filter({
    has: page.getByRole("heading", { level: 3, name }),
  });
}

export async function searchCatalogEntry(page: Page, name: string) {
  const search = page.getByPlaceholder(/搜索市场|Search catalog/i);
  const token = name.match(/(\d{10,})$/)?.[1] ?? name;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await search.clear();
    await search.fill(token);
    await search.press("Enter");
    await page
      .waitForResponse(
        (response) =>
          response.url().includes("/capabilities-lab/v1/catalog") &&
          response.request().method() === "GET",
        { timeout: 30_000 },
      )
      .catch(() => undefined);

    const card = catalogCard(page, name);
    try {
      await expect(card).toBeVisible({ timeout: 20_000 });
      return card;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  throw new Error(`Catalog entry not found: ${name}`);
}

export async function installCatalogEntryViaUi(page: Page, entryName: string) {
  const card = await searchCatalogEntry(page, entryName);
  const installedButton = card.getByRole("button", { name: /已安装|Installed/i });
  if (await installedButton.isVisible().catch(() => false)) {
    await expect(installedButton).toBeDisabled();
    return { name: entryName };
  }

  const installResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/catalog/install") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    card.getByRole("button", { name: BTN_INSTALL }).click(),
  ]).then(([response]) => response);

  expect(installResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, {
    toast: /已从市场安装|Installed from catalog/i,
  });

  const body = (await installResponse.json()) as {
    capabilities?: Array<{ id?: string; name?: string; box_id?: string }>;
  };
  return body.capabilities?.[0];
}

export function capabilityCard(page: Page, name: string) {
  return page.getByTestId("capability-lab-card").filter({ hasText: name }).first();
}

export function capabilityDetailDrawer(page: Page) {
  return page.getByRole("dialog", { name: /能力详情|Capability detail/i });
}

export async function searchCapabilityByName(page: Page, name: string) {
  const search = page.getByPlaceholder(/搜索能力名称|Search by name/i);
  const token = name.match(/(\d{10,})$/)?.[1] ?? name;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await search.clear();
    await search.fill(token);
    await page
      .waitForResponse(
        (response) =>
          response.url().includes("/capabilities-lab/v1/capabilities") &&
          response.request().method() === "GET",
        { timeout: 30_000 },
      )
      .catch(() => undefined);

    const card = capabilityCard(page, name);
    try {
      await expect(card).toBeVisible({ timeout: 20_000 });
      return card;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  throw new Error(`Capability card not found: ${name}`);
}

export async function openCapabilityDetail(page: Page, name: string) {
  const drawer = capabilityDetailDrawer(page);
  if (await drawer.isVisible().catch(() => false)) {
    const onOverview = await drawer
      .getByRole("tab", { name: /概览|Overview/i })
      .getAttribute("aria-selected")
      .then((value) => value === "true")
      .catch(() => false);
    const showsName =
      onOverview &&
      (await drawer.getByText(name, { exact: false }).isVisible().catch(() => false));
    if (!showsName) {
      await closeCapabilityDetail(page);
    }
  }

  if (!(await drawer.isVisible().catch(() => false))) {
    const card = await searchCapabilityByName(page, name);
    await card.click();
  }

  await expect(drawer).toBeVisible();
  return drawer;
}

export async function closeCapabilityDetail(page: Page) {
  const drawer = capabilityDetailDrawer(page);
  if (await drawer.isVisible().catch(() => false)) {
    await drawer.getByRole("button", { name: /关闭|Close/i }).click();
    await expect(drawer).toBeHidden({ timeout: 10_000 });
  }
}

export async function openAddCapabilityMenu(page: Page) {
  await page.getByRole("button", { name: /添加能力|Add capability/i }).click();
}

export async function clickCreateMenuItem(page: Page, pattern: RegExp) {
  await openAddCapabilityMenu(page);
  await page.getByRole("menuitem", { name: pattern }).click();
}

export async function createHttpCapabilityViaUi(
  page: Page,
  input: { name: string; curl: string; description?: string },
) {
  await clickCreateMenuItem(page, /添加 HTTP API|Add HTTP API/i);

  const drawer = page.getByRole("dialog", { name: /添加 HTTP API|Add HTTP API/i });
  await expect(drawer).toBeVisible();

  await drawer.getByLabel(/cURL|curl/i).fill(input.curl);
  await drawer.getByLabel(CAPABILITY_NAME_LABEL).fill(input.name);
  if (input.description) {
    await drawer.getByLabel(/描述|Description/i).fill(input.description);
  }

  const createResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/capabilities/http") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_CREATE_CAPABILITY }).click(),
  ]).then(([response]) => response);

  expect(createResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, {
    toast: /HTTP 能力已创建|HTTP capability created/i,
    capabilityName: input.name,
  });

  const body = (await createResponse.json()) as {
    capability?: { id?: string; box_id?: string; name?: string };
  };

  return body.capability;
}

export async function importOpenApiViaUi(
  page: Page,
  input: { openapiSpec: string; serviceUrl?: string },
) {
  await clickCreateMenuItem(page, /导入 OpenAPI|Import OpenAPI/i);

  const drawer = page.getByRole("dialog", { name: /导入 OpenAPI|Import OpenAPI/i });
  await expect(drawer).toBeVisible();

  if (input.serviceUrl) {
    await drawer.getByPlaceholder(/服务地址|Service URL/i).fill(input.serviceUrl);
  }

  await drawer
    .getByPlaceholder(/粘贴 OpenAPI|Paste OpenAPI/i)
    .fill(input.openapiSpec);

  const importResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/capabilities/http/import") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    drawer.locator(".ant-drawer-extra").getByRole("button", { name: BTN_IMPORT }).click(),
  ]).then(([response]) => response);

  expect(importResponse.ok()).toBeTruthy();
  await maybeDismissInfoModal(page, /OpenAPI 导入完成|OpenAPI import complete/i);
  await expectLabActionFeedback(page, {
    toast: /OpenAPI 能力已导入|OpenAPI capabilities imported/i,
  });

  const body = (await importResponse.json()) as {
    capabilities?: Array<{ id?: string; name?: string; box_id?: string }>;
    box_id?: string;
  };

  return body;
}

export async function registerMcpViaUi(
  page: Page,
  input: { name: string; url: string; description?: string },
) {
  await clickCreateMenuItem(page, /注册 MCP|Register MCP/i);

  const drawer = page.getByRole("dialog", { name: /注册 MCP|Register MCP/i });
  await expect(drawer).toBeVisible();

  await drawer.getByLabel(CAPABILITY_NAME_LABEL).fill(input.name);
  if (input.description) {
    await drawer.getByLabel(/描述|Description/i).fill(input.description);
  }
  await drawer.getByLabel(/MCP SSE|MCP SSE URL/i).fill(input.url);

  const parseButton = drawer.getByRole("button", { name: BTN_PARSE_SSE });
  if (await parseButton.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/capabilities-lab/v1/capabilities/mcp/parse-sse") &&
          response.request().method() === "POST",
        { timeout: 60_000 },
      ),
      parseButton.click(),
    ]);
  }

  const registerResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/capabilities/mcp") &&
        response.request().method() === "POST" &&
        !response.url().includes("parse-sse"),
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_REGISTER_MCP }).click(),
  ]).then(([response]) => response);

  expect(registerResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, {
    toast: /MCP 能力已注册|MCP capability registered/i,
    capabilityName: input.name,
  });

  const body = (await registerResponse.json()) as {
    capability?: { id?: string; name?: string };
  };
  return body.capability;
}

export async function importSkillZipViaUi(page: Page, zipPath: string) {
  await clickCreateMenuItem(page, /导入 Skill|Import Skill/i);

  const drawer = page.getByRole("dialog", { name: /导入 Skill|Import Skill/i });
  await expect(drawer).toBeVisible();

  const fileInput = drawer.locator('input[type="file"]');
  await fileInput.setInputFiles(zipPath);

  const importResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/capabilities/skill") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_IMPORT_SKILL }).click(),
  ]).then(([response]) => response);

  expect(importResponse.ok()).toBeTruthy();

  await expectLabActionFeedback(page, {
    toast: /Skill 能力已导入|Skill capability imported/i,
  });

  const body = (await importResponse.json()) as {
    capability?: { id?: string; name?: string };
  };

  return body.capability;
}

export async function importSkillContentViaUi(page: Page, content: string) {
  await clickCreateMenuItem(page, /导入 Skill|Import Skill/i);

  const drawer = page.getByRole("dialog", { name: /导入 Skill|Import Skill/i });
  await expect(drawer).toBeVisible();
  await drawer.getByText(/Markdown 内容|Markdown content/i).click();
  await drawer
    .getByPlaceholder(/粘贴 Skill|Paste Skill/i)
    .fill(content);

  const importResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/capabilities/skill") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_IMPORT_SKILL }).click(),
  ]).then(([response]) => response);

  expect(importResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, {
    toast: /Skill 能力已导入|Skill capability imported/i,
  });

  const body = (await importResponse.json()) as {
    capability?: { id?: string; name?: string };
  };
  return body.capability;
}

export async function createFunctionCapabilityViaUi(
  page: Page,
  input: { name: string; code: string; description?: string },
) {
  await clickCreateMenuItem(page, FUNCTION_DRAWER_TITLE);

  const drawer = page.getByRole("dialog", { name: FUNCTION_DRAWER_TITLE });
  await expect(drawer).toBeVisible();

  await drawer.getByLabel(CAPABILITY_NAME_LABEL).fill(input.name);
  if (input.description) {
    await drawer.getByLabel(/描述|Description/i).fill(input.description);
  }
  await drawer.getByLabel(PYTHON_CODE_LABEL).fill(input.code);
  await runPythonSandboxInCreateDrawer(page, '{"x": 41}');

  const createResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/capabilities/function") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_CREATE_FUNCTION }).click(),
  ]).then(([response]) => response);

  expect(createResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, {
    toast: /Function 能力已创建|Function capability created/i,
    capabilityName: input.name,
  });

  const body = (await createResponse.json()) as {
    capability?: { id?: string; name?: string; box_id?: string };
  };
  return body.capability;
}

export async function runPythonSandboxInCreateDrawer(page: Page, eventPayload: string) {
  const drawer = page.getByRole("dialog", { name: FUNCTION_DRAWER_TITLE });
  const inlineRunButton = drawer.getByRole("button", { name: BTN_RUN_PYTHON });
  if (await inlineRunButton.isVisible().catch(() => false)) {
    const exampleInput = drawer.getByLabel(/输入示例|Input example/i);
    if (await exampleInput.isVisible().catch(() => false)) {
      await exampleInput.fill(eventPayload);
    }
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/capabilities-lab/v1/function/execute") &&
          response.request().method() === "POST",
        { timeout: 60_000 },
      ),
      inlineRunButton.click(),
    ]);

    const resultText = drawer.locator("pre, .ant-alert, .ant-result").filter({
      hasText: /output|result|42|error/i,
    });
    if (await resultText.first().isVisible({ timeout: 30_000 }).catch(() => false)) {
      return resultText.first().innerText();
    }
    return drawer.innerText();
  }
  await drawer.getByRole("button", { name: BTN_RUN_PYTHON }).click();

  const modal = page.getByRole("dialog", { name: /Python 沙箱|Python sandbox/i });
  await expect(modal).toBeVisible();
  await modal.locator("textarea").first().fill(eventPayload);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/function/execute") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    modal.getByRole("button", { name: BTN_RUN_PYTHON }).click(),
  ]);

  const resultPre = modal.locator("pre");
  await expect(resultPre).toBeVisible({ timeout: 30_000 });
  const text = await resultPre.innerText();

  await modal.getByRole("button", { name: /取\s*消|Cancel|关\s*闭|Close/i }).first().click();
  await expect(modal).toBeHidden({ timeout: 10_000 });

  return text;
}

export async function switchDetailTab(page: Page, tabPattern: RegExp) {
  const drawer = capabilityDetailDrawer(page);
  await drawer.getByRole("tab", { name: tabPattern }).click();
}

export async function editCapabilityOverview(
  page: Page,
  input: { name?: string; description?: string },
) {
  await ensureOverviewTab(page);
  const drawer = capabilityDetailDrawer(page);
  await drawer.getByRole("button", { name: BTN_EDIT }).click();

  if (input.name) {
    await drawer.locator(".ant-descriptions input").first().fill(input.name);
  }
  if (input.description !== undefined) {
    await drawer.locator(".ant-descriptions textarea").first().fill(input.description);
  }

  const saveResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/capabilities-lab\/v1\/capabilities\//.test(response.url()) &&
        response.request().method() === "PATCH",
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_SAVE }).click(),
  ]).then(([response]) => response);

  expect(saveResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, { toast: /已保存|Changes saved|saved/i });
}

export async function setDebugPayload(page: Page, payload: string) {
  await switchDetailTab(page, /调试|Debug/i);
  const drawer = capabilityDetailDrawer(page);
  const advancedPanel = drawer.getByText(/高级请求 JSON|Advanced request JSON/i);
  if (await advancedPanel.isVisible().catch(() => false)) {
    const expanded = await drawer.locator(".ant-collapse-item-active").isVisible().catch(() => false);
    if (!expanded) {
      await advancedPanel.click();
    }
  }
  const payloadTextarea = drawer.locator("textarea").first();
  if (!(await payloadTextarea.isVisible({ timeout: 2_000 }).catch(() => false))) {
    const generateParams = drawer.getByRole("button", { name: /按定义生成参数|Generate parameters/i });
    if (await generateParams.isVisible().catch(() => false)) {
      await generateParams.click();
    }
    return;
  }
  await payloadTextarea.fill(payload);
}

export async function runDebugInDetail(
  page: Page,
  options?: { useExample?: boolean; payload?: string; allowErrorResponse?: boolean },
) {
  await switchDetailTab(page, /调试|Debug/i);
  const drawer = capabilityDetailDrawer(page);

  if (options?.payload) {
    await setDebugPayload(page, options.payload);
  } else if (options?.useExample) {
    const fillExample = drawer.getByRole("button", { name: /填充示例|Fill example/i });
    if (await fillExample.isVisible().catch(() => false)) {
      await fillExample.click();
    }
  }

  const debugResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/debug") && response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_DEBUG }).click(),
  ]).then(([response]) => response);

  if (!options?.allowErrorResponse) {
    expect(debugResponse.ok()).toBeTruthy();
  }

  const resultPre = drawer.locator("pre").filter({
    hasText: /status_code|body|output|result|error|502|failed/i,
  });
  if (await resultPre.first().isVisible().catch(() => false)) {
    return {
      response: debugResponse,
      text: await resultPre.first().innerText(),
    };
  }

  const errorAlert = drawer.locator(".ant-alert-error");
  if (await errorAlert.isVisible().catch(() => false)) {
    return {
      response: debugResponse,
      text: await errorAlert.innerText(),
    };
  }
  return {
    response: debugResponse,
    text: await drawer.innerText(),
  };
}

const DESTRUCTIVE_WARNING = /影响正在运行|disrupt running systems/i;

async function expectDestructiveImpactWarning(modal: ReturnType<Page["locator"]>) {
  await expect(modal.getByText(DESTRUCTIVE_WARNING)).toBeVisible({ timeout: 10_000 });
}

function visibleDropdownMenu(page: Page) {
  return page.locator(".ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu");
}

function destructiveConfirmDialog(page: Page, titlePattern: RegExp) {
  return page.getByRole("dialog").filter({ hasText: titlePattern });
}

export async function deleteCapabilityInDetail(page: Page) {
  await openDetailMoreMenu(page);
  const menu = visibleDropdownMenu(page);
  await expect(menu).toBeVisible({ timeout: 10_000 });
  await menu.getByRole("menuitem", { name: BTN_DELETE }).click();

  const confirmModal = destructiveConfirmDialog(page, /确定删除该能力|Delete this capability/i);
  await expect(confirmModal).toBeVisible({ timeout: 15_000 });
  await expectDestructiveImpactWarning(confirmModal);

  const deleteResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/capabilities-lab\/v1\/capabilities\//.test(response.url()) &&
        response.request().method() === "DELETE",
      { timeout: 60_000 },
    ),
    confirmModal.getByRole("button", { name: BTN_DELETE }).click(),
  ]).then(([response]) => response);

  expect(deleteResponse.ok()).toBeTruthy();
  await expect(capabilityDetailDrawer(page)).toBeHidden({ timeout: 15_000 });
}

const BTN_OFFLINE = new RegExp(`${cjk("下线")}|Take offline`, "i");

export async function offlineCapabilityInDetail(page: Page) {
  await ensureOverviewTab(page);
  const drawer = capabilityDetailDrawer(page);
  await drawer.getByRole("button", { name: BTN_OFFLINE }).click();

  const confirmModal = destructiveConfirmDialog(
    page,
    /确定下线该能力|Take this capability offline/i,
  );
  const popconfirm = page.locator(".ant-popconfirm").filter({
    hasText: /确定下线该能力|Take this capability offline/i,
  });

  if (await confirmModal.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await expectDestructiveImpactWarning(confirmModal);
    await confirmModal.getByRole("button", { name: BTN_OFFLINE }).click();
  } else {
    await expect(popconfirm).toBeVisible({ timeout: 10_000 });
    await popconfirm.getByRole("button", { name: BTN_CONFIRM }).click();
  }
  await expectLabActionFeedback(page, {
    toast: /已下线|Capability taken offline|taken offline/i,
  });
}

export async function publishCapabilityInDetail(page: Page) {
  await ensureOverviewTab(page);
  const drawer = capabilityDetailDrawer(page);
  const publishButton = drawer.getByRole("button", { name: BTN_PUBLISH });
  if (!(await publishButton.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return;
  }
  await publishButton.click();
  await confirmPopconfirm(page);
  await expectLabActionFeedback(page, {
    toast: /已发布|Capability published|published/i,
  });
}

export async function runOrchestrationLifecycleInDetail(page: Page) {
  await switchDetailTab(page, /编排|Orchestration/i);
  const drawer = capabilityDetailDrawer(page);
  const enableButton = drawer.getByRole("button", { name: BTN_ENABLE_ORCHESTRATION });
  const saveButton = drawer.getByRole("button", { name: BTN_SAVE_OPERATOR_SETTINGS });
  const disableButton = drawer.getByRole("button", { name: BTN_DISABLE_ORCHESTRATION });

  await expect(enableButton).toBeEnabled();
  await expect(saveButton).toBeDisabled();
  await expect(disableButton).toBeDisabled();

  const enableResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/orchestration/enable") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    enableButton.click(),
  ]).then(([response]) => response);
  expect(enableResponse.ok()).toBeTruthy();

  await expect(enableButton).toBeDisabled();
  await expect(saveButton).toBeEnabled();
  await expect(disableButton).toBeEnabled();
  const operatorAlert = drawer.locator(".ant-alert").filter({
    hasText: /流程算子|workflow operator/i,
  }).first();
  await expect(operatorAlert).toBeVisible();
  await expect(operatorAlert).toHaveClass(/ant-alert-success/);

  const saveResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/orchestration/config") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    saveButton.click(),
  ]).then(([response]) => response);
  expect(saveResponse.ok()).toBeTruthy();

  await disableButton.click();
  const abortModal = destructiveConfirmDialog(page, /确定取消流程编排|Disable workflow orchestration/i);
  await expect(abortModal).toBeVisible({ timeout: 15_000 });
  await expectDestructiveImpactWarning(abortModal);
  await abortModal.locator(".ant-modal-footer .ant-btn:not(.ant-btn-dangerous)").click();
  await expect(abortModal).toBeHidden({ timeout: 10_000 });
  await expect(enableButton).toBeDisabled();
  await expect(saveButton).toBeEnabled();
  await expect(disableButton).toBeEnabled();

  await disableButton.click();
  const confirmModal = destructiveConfirmDialog(page, /确定取消流程编排|Disable workflow orchestration/i);
  await expect(confirmModal).toBeVisible({ timeout: 15_000 });
  await expectDestructiveImpactWarning(confirmModal);
  const disableResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/orchestration/disable") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    confirmModal.getByRole("button", { name: BTN_DISABLE_ORCHESTRATION }).click(),
  ]).then(([response]) => response);
  expect(disableResponse.ok()).toBeTruthy();

  await expect(enableButton).toBeEnabled({ timeout: 15_000 });
  await expect(saveButton).toBeDisabled();
  await expect(disableButton).toBeDisabled();
}

export async function openDetailMoreMenu(page: Page) {
  await ensureOverviewTab(page);
  const drawer = capabilityDetailDrawer(page);
  await drawer.getByRole("button", { name: BTN_MORE }).click();
}

export async function downloadSkillPackageFromDetail(page: Page) {
  await openDetailMoreMenu(page);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("menuitem", { name: /下载包|Download package/i }).click(),
  ]);
  return download;
}

export async function exportImpexFromDetail(page: Page) {
  await openDetailMoreMenu(page);
  const [response] = await Promise.all([
    page.waitForResponse(
      (item) =>
        item.url().includes("/capabilities-lab/v1/capabilities/") &&
        item.url().includes("/export") &&
        item.request().method() === "GET",
      { timeout: 60_000 },
    ),
    page.getByRole("menuitem", { name: /导出包|Export package/i }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  const body = await response.body();
  return {
    suggestedFilename: () => "capability-export.adp.json",
    saveAs: async (path: string) => {
      writeFileSync(path, body);
    },
  };
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("menuitem", { name: /导出包|Export package/i }).click(),
  ]);
  return download;
}

export async function replaceSkillPackageInDetail(page: Page, zipPath: string) {
  await openDetailMoreMenu(page);
  const replaceMenuItem = page
    .locator(".ant-dropdown-menu")
    .getByRole("menuitem", { name: /换包升级|Replace package/i });
  await expect(replaceMenuItem).toBeVisible({ timeout: 10_000 });
  await replaceMenuItem.click();

  const modal = page.locator(".ant-modal-wrap").filter({
    has: page.getByText(/确定替换 Skill|Replace the Skill/i),
  });
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await modal.locator('input[type="file"]').setInputFiles(zipPath);
  await expect(modal.locator(".ant-upload-list-item-name, .ant-upload-list-text").first()).toBeVisible({
    timeout: 10_000,
  });

  const replaceResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/skill/package") && response.request().method() === "PUT",
      { timeout: 60_000 },
    ),
    modal.getByRole("button", { name: BTN_CONFIRM }).click(),
  ]).then(([response]) => response);

  expect(replaceResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, {
    toast: /Skill 包已替换|Skill package replaced/i,
  });
}

export async function importImpexPackageViaUi(
  page: Page,
  filePath: string,
  mode: "create" | "upsert" = "create",
) {
  await openAddCapabilityMenu(page);
  await page.getByRole("menuitem", { name: /导入包|Import package/i }).click();

  const drawer = page.getByRole("dialog", { name: /导入包|Import package/i });
  await expect(drawer).toBeVisible();

  if (mode === "upsert") {
    await drawer.locator(".ant-select").click();
    await page
      .locator(".ant-select-item-option")
      .filter({ hasText: /新建或更新|Create or update/i })
      .click();
  }

  await drawer.locator('input[type="file"]').setInputFiles(filePath);

  const importResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/capabilities-lab/v1/capabilities/import") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    drawer.getByRole("button", { name: BTN_IMPORT_PACKAGE }).click(),
  ]).then(([response]) => response);

  expect(importResponse.ok()).toBeTruthy();
  await expectLabActionFeedback(page, {
    toast: /包已导入|Package imported|imported/i,
  });
}

export function buildOpenApiImportDocument(baseName: string, serviceUrl: string) {
  return JSON.stringify({
    openapi: "3.0.3",
    info: { title: baseName, version: "1.0.0" },
    servers: [{ url: serviceUrl }],
    paths: {
      [`/proxy/uapis/weather/${baseName}_a`]: {
        get: { summary: `${baseName}_a`, responses: { "200": { description: "ok" } } },
      },
      [`/proxy/uapis/weather/${baseName}_b`]: {
        get: { summary: `${baseName}_b`, responses: { "200": { description: "ok" } } },
      },
    },
  });
}

export function buildHttpCurl(serviceUrl: string, pathSuffix: string) {
  return `curl "${serviceUrl}/proxy/uapis/weather/${pathSuffix}?city=beijing"`;
}

export function buildSkillContentMarkdown(name: string) {
  return ["---", `name: ${name}`, "description: Skill content import test", "---", "Skill content import body."].join(
    "\n",
  );
}

export { buildLabWeatherOpenApi };
