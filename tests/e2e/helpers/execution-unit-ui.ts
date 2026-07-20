/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, type Locator, type Page } from "@playwright/test";

const STUDIO_BASE_PATH = "/studio";
const STUDIO_API_BASE_URL = process.env.E2E_STUDIO_API_BASE_URL ?? "/api";

export function toStudioPath(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url === STUDIO_BASE_PATH || url.startsWith(`${STUDIO_BASE_PATH}/`)) {
    return url;
  }

  return `${STUDIO_BASE_PATH}${url.startsWith("/") ? url : `/${url}`}`;
}

/** 强制 UI 请求走 Vite 同源代理，避免 localhost/127.0.0.1 跨域导致 impex 无响应 */
export async function ensureE2eRuntime(
  page: Page,
  options?: { capabilityUxV2?: boolean; marketCatalog?: boolean },
) {
  await page.addInitScript((runtimeConfig) => {
    window.__BKN_STUDIO_RUNTIME__ = {
      ...(window.__BKN_STUDIO_RUNTIME__ ?? {}),
      apiBaseUrl: runtimeConfig.baseUrl,
      mode: "hosted",
      features: {
        ...(window.__BKN_STUDIO_RUNTIME__?.features ?? {}),
        capabilityUxV2: runtimeConfig.capabilityUxV2,
        marketCatalog: runtimeConfig.marketCatalog,
      },
      currentUser: {
        businessDomainId: "bd_public",
        ...(window.__BKN_STUDIO_RUNTIME__?.currentUser ?? {}),
      },
    };
  }, {
    baseUrl: STUDIO_API_BASE_URL,
    capabilityUxV2: options?.capabilityUxV2 ?? true,
    // 市场入口产品上默认关(见 utils/market-catalog.ts),但 /catalog 的 spec
    // 仍要覆盖 marketMode 代码路径,所以 e2e 里默认开。
    marketCatalog: options?.marketCatalog ?? true,
  });
}

export async function ensureLegacyE2eRuntime(page: Page) {
  await ensureE2eRuntime(page, { capabilityUxV2: false });
}

export async function gotoE2ePage(
  page: Page,
  url: string,
  options?: { capabilityUxV2?: boolean },
) {
  await ensureE2eRuntime(page, { capabilityUxV2: options?.capabilityUxV2 ?? true });
  await page.goto(toStudioPath(url));
}

export async function gotoLegacyE2ePage(page: Page, url: string) {
  await gotoE2ePage(page, url, { capabilityUxV2: false });
}

export function executionUnitCard(page: Page, name: string) {
  return page
    .locator('[data-testid="execution-unit-card"]')
    .filter({ has: page.getByRole("heading", { level: 5, name }) })
    .first();
}

export async function retryListLoadIfNeeded(page: Page) {
  const alert = page.locator(".ant-alert-error").filter({ hasText: /timeout|超时|failed|错误/i });
  if (await alert.isVisible().catch(() => false)) {
    const retry = alert.getByRole("button", { name: /重试|Retry/i });
    if (await retry.isVisible().catch(() => false)) {
      await retry.click();
      await page.waitForTimeout(500);
    }
  }
}

export async function searchExecutionUnitByName(page: Page, name: string) {
  const search = page.getByPlaceholder(/搜索名称|Search name/i);
  const token = name.match(/(\d{10,})$/)?.[1] ?? name;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await retryListLoadIfNeeded(page);
    await search.clear();
    await search.fill(token);
    await page.waitForTimeout(400);
    await page
      .waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          /\/(operator\/info\/list|tool-box\/list|tool-box\/market|mcp\/list|mcp\/market\/list|skill\/list|skill\/market\/list)/.test(
            response.url(),
          ),
        { timeout: 30_000 },
      )
      .catch(() => undefined);

    const card = executionUnitCard(page, name);
    try {
      await expect(card).toBeVisible({ timeout: 20_000 });
      return card;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  throw new Error(`Execution unit card not found: ${name}`);
}

export const UNITS_PAGE_TITLE =
  /能力管理|执行能力管理|执行单元管理|Capability Management|Execution Capabilities|Execution Unit Management/i;

export const CATALOG_PAGE_TITLE = /能力市场|全部执行单元|Capability Market|All Execution Units/i;

export const OPERATOR_TAB_LABEL = /算子开发|Operator Dev/i;

export const BACKUP_FILE_TAB_LABEL = /备份文件|Backup file/i;

const TAB_LABELS_V2: Record<"operator" | "toolbox" | "mcp" | "skill", RegExp> = {
  toolbox: /工具集|Toolsets/i,
  mcp: /MCP 服务|MCP Services/i,
  skill: /Skill 包|Skill Packs/i,
  operator: OPERATOR_TAB_LABEL,
};

export async function expectCapabilityManagementPage(page: Page) {
  await expect(page.getByRole("heading", { level: 2, name: UNITS_PAGE_TITLE })).toBeVisible();
  await retryListLoadIfNeeded(page);
}

export async function expectOperatorAdvancedBanner(page: Page) {
  await expect(
    page
      .getByText(
        /算子列表与调试入口|Operator list and debug|同步发布为算子|Sync publish as operator/i,
      )
      .first(),
  ).toBeVisible();
}

export async function gotoUnitsTab(
  page: Page,
  tab: "operator" | "toolbox" | "mcp" | "skill",
  options?: { legacy?: boolean },
) {
  if (tab === "operator" && !options?.legacy) {
    await openAdvancedOperatorTab(page);
    return;
  }

  await gotoE2ePage(page, `/execution-factory/units?activeTab=${tab}`);
  await expectCapabilityManagementPage(page);
  await expect(page.getByRole("tab", { name: TAB_LABELS_V2[tab] })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

export async function openAdvancedOperatorTab(page: Page) {
  await gotoE2ePage(page, "/execution-factory/units?activeTab=operator");
  await expectCapabilityManagementPage(page);
  await expect(page.getByRole("tab", { name: TAB_LABELS_V2.operator })).toBeVisible();
  await expectOperatorAdvancedBanner(page);
}

export async function gotoMcpDetailPage(
  page: Page,
  mcpId: string,
  mcpName: string,
  options?: { editMode?: boolean; catalog?: boolean },
) {
  const title = () => page.getByRole("heading", { level: 3, name: mcpName });
  const params = new URLSearchParams();
  if (options?.editMode) {
    params.set("action", "edit");
  }
  if (options?.catalog) {
    params.set("from", "catalog");
  }
  const query = params.toString() ? `?${params.toString()}` : "";

  await gotoE2ePage(page, `/execution-factory/mcp/${mcpId}${query}`);
  await expect(title()).toBeVisible({ timeout: 45_000 });
}

export async function gotoSkillDetailPage(
  page: Page,
  skillId: string,
  skillName: string,
  options?: { editMode?: boolean; catalog?: boolean },
) {
  const title = () => page.getByRole("heading", { level: 3, name: skillName });
  const params = new URLSearchParams();
  if (options?.editMode) {
    params.set("action", "edit");
  }
  if (options?.catalog) {
    params.set("from", "catalog");
  }
  const query = params.toString() ? `?${params.toString()}` : "";

  await gotoE2ePage(page, `/execution-factory/skills/${skillId}${query}`);
  await expect(title()).toBeVisible({ timeout: 45_000 });
}

export async function selectSkillFileInDetailPage(page: Page, relPath: string) {
  const item = page.locator('[class*="toolItem"]').filter({ hasText: relPath }).first();
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.click();
}

export async function gotoToolboxToolsPage(
  page: Page,
  boxId: string,
  toolboxName: string,
  options?: { editMode?: boolean },
) {
  const title = () => page.getByRole("heading", { level: 3, name: toolboxName });
  const query = options?.editMode ? "?action=edit" : "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoE2ePage(page, `/execution-factory/toolboxes/${boxId}/tools${query}`);
    try {
      await expect(title()).toBeVisible({ timeout: 45_000 });
      return;
    } catch (error) {
      const hasError = await page
        .locator(".ant-alert-error")
        .isVisible()
        .catch(() => false);
      if (!hasError || attempt === 2) {
        throw error;
      }
      await page.reload();
    }
  }
}

export async function clickMarketCardInstallButton(card: Locator) {
  await card.getByRole("button", { name: "sync 同步", exact: true }).click();
}

export async function openCatalogInstallDialog(page: Page, card: Locator) {
  await clickMarketCardInstallButton(card);
  return page.locator(".ant-modal-content").filter({
    hasText: /引入到本业务域|从市场同步|Introduce|Sync from market/i,
  });
}

export function primaryToolbar(page: Page) {
  return page.locator('[class*="toolbarActions"], [class*="toolbarRow"]').first();
}

export async function clickPrimaryToolbarButton(page: Page, pattern: RegExp) {
  const button = page.locator('[class*="toolbarActions"]').getByRole("button", { name: pattern }).first();
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
}

/** Ant Design Drawer exposes role="dialog". */
export function visibleDrawer(page: Page) {
  return page.getByRole("dialog").last();
}

export async function expectVisibleDrawer(page: Page) {
  const drawer = visibleDrawer(page);
  await expect(drawer).toBeVisible({ timeout: 30_000 });
  return drawer;
}

export async function openAddCapabilityWizard(page: Page, tab: "toolbox" | "mcp" | "skill" = "toolbox") {
  await gotoUnitsTab(page, tab);
  await clickPrimaryToolbarButton(page, /添加能力|Add Capability/i);

  const menuItemPatterns: Record<typeof tab, RegExp> = {
    toolbox: /添加 HTTP API|Add HTTP API/i,
    mcp: /注册 MCP 服务|Register MCP/i,
    skill: /导入 Skill|Import Skill/i,
  };
  await page.getByRole("menuitem", { name: menuItemPatterns[tab] }).click();

  const drawer = await expectVisibleDrawer(page);
  const wizardTitle = /添加能力|Add Capability|添加 API|Add API|导入 OpenAPI|Import OpenAPI|添加 MCP 服务|Add MCP service|导入 Skill 包|Import skill pack/i;
  await expect(page.getByRole("dialog").filter({ hasText: wizardTitle })).toBeVisible();
  return drawer;
}

export async function openCreateWizard(
  page: Page,
  tab: "operator" | "toolbox" | "mcp" | "skill",
  options?: { legacy?: boolean },
) {
  if (!options?.legacy && tab !== "operator") {
    return openAddCapabilityWizard(page, tab);
  }

  const createPatterns: Record<typeof tab, RegExp> = {
    operator: /新建算子|New Operator/i,
    toolbox: /新建工具箱|New Toolbox|添加能力|Add Capability/i,
    mcp: /新建 MCP|New MCP|添加能力|Add Capability/i,
    skill: /导入 Skill|Import Skill|添加能力|Add Capability/i,
  };

  if (tab === "operator") {
    await openAdvancedOperatorTab(page);
    await clickPrimaryToolbarButton(page, createPatterns.operator);
  } else {
    await gotoUnitsTab(page, tab);
    await clickPrimaryToolbarButton(page, createPatterns[tab]);
  }

  const drawer = await expectVisibleDrawer(page);
  return drawer;
}

export async function advanceCreateWizardToDetails(page: Page) {
  const drawer = visibleDrawer(page);
  await drawer.getByRole("button", { name: /下一步|Next/i }).click();
}

export async function openOperatorCreateWizardStep2(page: Page) {
  const drawer = await openCreateWizard(page, "operator");
  await advanceCreateWizardToDetails(page);
  await expect(drawer.getByText(/函数计算|Function/i)).toBeVisible();
  await expect(drawer.getByText(/^OpenAPI$/)).toBeVisible();
  return drawer;
}

export async function selectOperatorCreateMode(
  page: Page,
  mode: "openapi" | "function",
  drawer?: import("@playwright/test").Locator,
) {
  const scope = drawer ?? visibleDrawer(page);
  if (mode === "openapi") {
    await scope.getByText(/^OpenAPI$/).click();
  } else {
    await scope.getByText(/函数计算|Function/i).click();
  }

  await scope
    .getByRole("button", { name: /继续配置|Continue setup/i })
    .click();

  await expect(page).toHaveURL(new RegExp(`metadataType=${mode}`));
  await expect(page.getByLabel(/算子名称|Operator Name/i)).toBeVisible();
}

/** 新建算子 → 向导选类型 → 选择 OpenAPI/函数计算 → 进入配置表单 */
export async function openOperatorCreateForm(
  page: Page,
  mode: "openapi" | "function" = "openapi",
) {
  const drawer = await openOperatorCreateWizardStep2(page);
  await selectOperatorCreateMode(page, mode, drawer);
}

export async function expectFunctionDefinitionSections(
  page: Page,
  root?: import("@playwright/test").Locator,
) {
  const scope = root ?? page;
  const inputs = scope.locator("#function-inputs");
  const logic = scope.locator("#function-logic");
  const outputs = scope.locator("#function-outputs");

  await expect(inputs).toBeVisible();
  await expect(logic).toBeVisible();
  await expect(outputs).toBeVisible();
  await expect(logic.getByText(/处理逻辑|Function Logic/i)).toBeVisible();

  const positions = await page.evaluate(() => {
    const top = (id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? -1;
    return {
      inputs: top("function-inputs"),
      logic: top("function-logic"),
      outputs: top("function-outputs"),
    };
  });

  expect(positions.inputs).toBeGreaterThanOrEqual(0);
  expect(positions.logic).toBeGreaterThan(positions.inputs);
  expect(positions.outputs).toBeGreaterThan(positions.logic);
}

export async function fillOpenApiSpecPaste(page: Page, spec: string, scope?: import("@playwright/test").Locator) {
  const root = scope ?? page;
  const pasteTab = root.getByRole("tab", { name: /粘贴|Paste/i });
  if (await pasteTab.isVisible().catch(() => false)) {
    await pasteTab.click();
  }
  const pastePanel = root.getByRole("tabpanel", { name: /粘贴|Paste/i });
  await expect(pastePanel.getByRole("textbox")).toBeVisible();
  await pastePanel.getByRole("textbox").fill(spec);
}

export const OPENAPI_IO_PREVIEW_HINT =
  /展开.*接口|Expand an endpoint|输入参数、请求体|parameters, request body/i;

export async function expectOpenApiOperationsIoPreview(
  scope: Page | import("@playwright/test").Locator,
  options?: { containsText?: RegExp | string },
) {
  const root = "locator" in scope ? scope : scope.locator("body");
  await expect(root.getByText(OPENAPI_IO_PREVIEW_HINT).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(root.locator(".ant-collapse").first()).toBeVisible();

  if (options?.containsText) {
    await expect(root.getByText(options.containsText).first()).toBeVisible();
  }
}

export async function openImportOpenApiPanel(importDialog: import("@playwright/test").Locator) {
  const openApiTab = importDialog.getByRole("tab", { name: /^OpenAPI$/i });
  if (await openApiTab.isVisible().catch(() => false)) {
    await openApiTab.click();
  }
  return importDialog.locator(".ant-tabs-tabpane-active");
}

export async function openImportOpenApiWizard(drawer: import("@playwright/test").Locator) {
  await drawer.getByText(/导入 OpenAPI|Import OpenAPI/i).click();
  await expect(drawer.getByText(/粘贴|Paste/i).first()).toBeVisible();
}

export async function openToolboxCardMenu(
  page: Page,
  toolboxName: string,
  menuItem: "查看" | "编辑" | "导出" | "View" | "Edit" | "Export",
) {
  const card = await searchExecutionUnitByName(page, toolboxName);
  await card.getByRole("button", { name: /更多操作|More/i }).click();
  const menu = page.getByRole("menu").last();
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: menuItem }).click();
}

export async function openToolboxDetailDrawer(page: Page, toolboxName: string) {
  await openToolboxCardMenu(page, toolboxName, "查看");
  const drawer = page.locator(".ant-drawer").first();
  await expect(drawer.getByText(/工具箱详情|Toolbox Detail/i)).toBeVisible();
  return drawer;
}

export async function openCardMenu(
  page: Page,
  name: string,
  menuItem: string | RegExp,
) {
  const card = await searchExecutionUnitByName(page, name);
  await card.getByRole("button", { name: /更多操作|More/i }).click();
  const menu = page.getByRole("menu").last();
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: menuItem }).click();
}

export async function openDetailDrawerByCardClick(page: Page, name: string) {
  await executionUnitCard(page, name).click();
  const drawer = page.locator('.ant-drawer, [role="dialog"]').first();
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function closeImportOrOverlay(page: Page) {
  await page.keyboard.press("Escape");
}

export async function confirmAntModal(page: Page) {
  const modal = page.locator(".ant-modal-confirm, .ant-modal").last();
  await modal.getByRole("button", { name: /保\s*存|Save|确\s*定|OK/i }).click();
}

export async function openImportModal(page: Page) {
  await clickPrimaryToolbarButton(page, /导入|Import/i);
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
}

export async function openImportBackupTab(importDialog: Locator) {
  const backupTab = importDialog.getByRole("tab", { name: BACKUP_FILE_TAB_LABEL });
  if (await backupTab.isVisible().catch(() => false)) {
    await backupTab.click();
  }
  return importDialog.locator(".ant-tabs-tabpane-active");
}

export async function submitImportModal(
  page: Page,
  importDialog: Locator,
  type: "operator" | "toolbox" | "mcp",
) {
  const importResponsePromise = waitForImpexImportResponse(page, type);
  await Promise.all([
    importResponsePromise,
    importDialog.getByRole("button", { name: /开始导入|^Import$/i }).click(),
  ]);
  const importResponse = await importResponsePromise;
  expect(
    importResponse.ok(),
    `Import ${type} backup failed (${importResponse.status()}) at ${importResponse.url()}: ${await importResponse.text()}`,
  ).toBeTruthy();
  await expectAppToast(page, /导入成功|Imported successfully/i);
  await expect(importDialog).toBeHidden();
  return importResponse;
}

export async function selectWizardResourceType(
  drawer: import("@playwright/test").Locator,
  tab: "operator" | "toolbox" | "mcp" | "skill",
) {
  const labelPatterns: Record<typeof tab, RegExp> = {
    operator: /高级.*算子|Advanced.*Operators|算子|Operators/i,
    toolbox: /添加 API|Add API|导入 OpenAPI|Import OpenAPI|工具|Tools|工具集|Toolsets/i,
    mcp: /MCP 服务|MCP service|连接外部服务|Connect external service|^MCP$/i,
    skill: /Skill 包|Skill pack|导入技能包|Import skill pack|^Skill$/i,
  };
  await drawer.getByText(labelPatterns[tab]).first().click();
}

export async function openToolDebugModalFromToolsPage(page: Page) {
  const ioHeader = page.locator('[class*="ioHeader"]');
  await ioHeader.getByRole("button", { name: /调\s*试|^Debug$/i }).click();
  const modal = page.locator(".ant-modal").filter({ hasText: /调试工具|Debug Tool/i });
  await expect(modal).toBeVisible();
  return modal;
}

export async function openToolDebugModalFromToolList(
  page: Page,
  toolName: string,
) {
  const toolItem = page.locator('[class*="toolItem"]').filter({ hasText: toolName }).first();
  await toolItem.getByRole("button", { name: /调\s*试|^Debug$/i }).click();
  const modal = page.locator(".ant-modal").filter({ hasText: /调试工具|Debug Tool/i });
  await expect(modal).toBeVisible();
  return modal;
}

export async function runToolDebugFromToolsPage(page: Page, boxId: string) {
  const debugResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/tool-box/${boxId}/tool/`) &&
      response.url().includes("/debug"),
    { timeout: 120_000 },
  );

  const modal = page.locator(".ant-modal").filter({ hasText: /调试工具|Debug Tool/i });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /运行调试|Run Debug/i }).click();

  const response = await debugResponse;
  expect(response.ok()).toBeTruthy();
  await expect(modal.getByText(/调试结果|Debug Result/i)).toBeVisible();
  return response;
}

export async function debugToolFromToolsPage(
  page: Page,
  boxId: string,
  options?: { toolName?: string; fromListItem?: boolean },
) {
  if (options?.fromListItem && options.toolName) {
    await openToolDebugModalFromToolList(page, options.toolName);
  } else {
    if (options?.toolName) {
      await page.locator('[class*="toolItem"]').filter({ hasText: options.toolName }).first().click();
    }
    await openToolDebugModalFromToolsPage(page);
  }

  return runToolDebugFromToolsPage(page, boxId);
}

/** Scrolls category into view and waits for category options to load (new toolset mode). */
export async function waitForCategoryFieldReady(
  page: Page,
  drawer: import("@playwright/test").Locator,
) {
  const categoryCombobox = drawer.getByRole("combobox", { name: /分类|Category/i });
  if (!(await categoryCombobox.isVisible().catch(() => false))) {
    return;
  }

  await categoryCombobox.scrollIntoViewIfNeeded();
  await page
    .waitForResponse(
      (response) => response.url().includes("/operator/category") && response.ok(),
      { timeout: 15_000 },
    )
    .catch(() => undefined);
}

export async function fillAndSubmitQuickAddApi(
  page: Page,
  options: {
    curl: string;
    summary: string;
    toolboxName: string;
    drawer?: import("@playwright/test").Locator;
    operatorSync?: { enabled?: boolean; name?: string };
  },
) {
  const drawer = options.drawer ?? visibleDrawer(page);
  const apiUrl =
    options.curl.match(/https?:\/\/[^\s'"]+/i)?.[0] ??
    options.curl.replace(/^curl\s+/i, "").replace(/^['"]|['"]$/g, "");

  await drawer.getByRole("tab", { name: /填表单|Fill form/i }).click();
  await drawer.getByLabel(/完整 API 地址|Full API URL/i).fill(apiUrl);
  await drawer.getByRole("button", { name: /识别接口信息|Detect API details/i }).click();
  const summaryField = drawer.getByLabel(/工具名称|Tool name/i);
  await expect(summaryField).not.toHaveValue("", { timeout: 15_000 });
  await summaryField.fill(options.summary);
  await drawer.getByRole("radio", { name: /新建工具集|New toolset/i }).check();
  await drawer.getByLabel(/工具箱名称|Toolbox Name/i).fill(options.toolboxName);
  await waitForCategoryFieldReady(page, drawer);

  await expectOpenApiOperationsIoPreview(drawer, { containsText: /POST|GET/i });

  if (options.operatorSync?.enabled) {
    await drawer
      .getByRole("checkbox", { name: /同步发布为算子|Sync publish as operator/i })
      .check();
    const operatorName = options.operatorSync.name ?? options.summary;
    await drawer.getByLabel(/算子名称|Operator name/i).fill(operatorName);
  }

  await drawer.locator(".ant-drawer-body").evaluate((body) => {
    body.scrollTop = body.scrollHeight;
  });

  const saveButton = drawer.getByRole("button", { name: /保存并完成|Save and finish/i });
  await saveButton.scrollIntoViewIfNeeded();
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  const errorToast = page
    .locator(".ant-message-notice-content")
    .filter({ hasText: /失败|错误|error|invalid/i });
  const nextSteps = drawer.getByTestId("capability-created-next-steps");
  await expect(nextSteps).toBeVisible({ timeout: 180_000 });
  await expect(nextSteps).toContainText(options.summary);
  await expect(nextSteps).toContainText(options.toolboxName);
  await nextSteps.locator("button").first().click();

  await expect(page).toHaveURL(/\/execution-factory\/toolboxes\/[^/]+\/tools/, {
    timeout: 180_000,
  });
  if (await errorToast.isVisible().catch(() => false)) {
    throw new Error(`Quick add API failed: ${(await errorToast.first().textContent()) ?? "unknown"}`);
  }
  await expectAppToast(page, /已添加到工具集|added to the toolset/i);

  const currentUrl = new URL(page.url());
  const boxId = currentUrl.pathname.match(/\/toolboxes\/([^/]+)/)?.[1] ?? "";
  const toolId = currentUrl.searchParams.get("toolId");

  return {
    boxId,
    toolIds: toolId ? [toolId] : [],
  };
}

export async function expectOpenApiInputModes(page: Page) {
  const tabs = page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: /粘贴|Paste/i }) });
  await expect(tabs.getByRole("tab", { name: /粘贴|Paste/i })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /上传文件|Upload/i })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /^URL$/i })).toBeVisible();
}

export async function fillFunctionOperatorForm(
  page: Page,
  operatorName: string,
  code: string,
) {
  await page.getByLabel(/算子名称|Operator Name/i).fill(operatorName);
  await page.getByLabel(/描述|Description/i).fill("Playwright AT — function operator");
  const codeArea = page.locator("#function-logic textarea");
  await expect(codeArea).toBeVisible();
  await codeArea.fill(code);
}

export async function closeTopDrawer(page: Page) {
  const drawer = page.locator('.ant-drawer, [role="dialog"]').first();
  if (await drawer.isVisible()) {
    await drawer.getByRole("button", { name: /Close|关闭/i }).click();
    await expect(drawer).toBeHidden();
  }
}

export async function expectAppToast(page: Page, pattern: RegExp | string) {
  const toast = page.locator(".ant-message-notice-content").filter({ hasText: pattern });
  await expect(toast.first()).toBeVisible({ timeout: 30_000 });
}

export async function waitForImpexExportResponse(
  page: Page,
  type: "operator" | "toolbox" | "mcp",
) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`impex/export/${type}`),
    { timeout: 120_000 },
  );
}

export async function waitForImpexImportResponse(
  page: Page,
  type: "operator" | "toolbox" | "mcp",
) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`impex/import/${type}`),
    { timeout: 120_000 },
  );
}

export async function uploadBackupFileInImportDialog(importDialog: Locator, filePath: string) {
  const panel = await openImportBackupTab(importDialog);
  await expect(
    panel.getByText(/导出.*下载|downloaded earlier via Export|备份文件|Backup file/i).first(),
  ).toBeVisible();
  await panel.getByRole("radio", { name: /^新建$|^New$/ }).check();
  await panel.locator('input[type="file"]').setInputFiles(filePath);
  await expect(panel.locator(".ant-upload-list-item").first()).toBeVisible({
    timeout: 10_000,
  });
}

/** @deprecated use uploadBackupFileInImportDialog */
export const uploadAdpPackageInImportDialog = uploadBackupFileInImportDialog;

export async function openOperatorDetailDrawer(page: Page, name: string) {
  const drawer = await openDetailDrawerByCardClick(page, name);
  await expect(drawer.getByText(/算子详情|Operator Detail/i)).toBeVisible();
  return drawer;
}

export async function openOperatorVersionHistoryDrawer(page: Page, name: string) {
  const drawer = await openOperatorDetailDrawer(page, name);
  await drawer.getByRole("button", { name: /版本历史|Version history/i }).click();
  await expect(page.getByText(/算子版本历史|Operator version history/i)).toBeVisible();
  return page.locator(".ant-drawer").last();
}

export async function openSkillReleaseHistoryDrawer(page: Page, name: string) {
  const drawer = await openDetailDrawerByCardClick(page, name);
  await drawer.getByRole("button", { name: /发布历史|Release history/i }).click();
  await expect(page.getByText(/发布历史|Release history/i).first()).toBeVisible();
  return page.locator(".ant-drawer").last();
}

export async function importToolboxOpenApiViaUi(
  page: Page,
  spec: string,
  toolboxName: string,
  options?: { serviceUrl?: string },
) {
  await gotoUnitsTab(page, "toolbox");
  const importDialog = await openImportModal(page);
  const panel = await openImportOpenApiPanel(importDialog);
  await fillOpenApiSpecPaste(page, spec, panel);
  await expectOpenApiOperationsIoPreview(panel, { containsText: /GET|POST/i });
  await expect(panel.getByText(/Endpoint review|端点审阅|绔偣瀹￠槄/i)).toBeVisible();

  await importDialog.getByLabel(/工具箱名称|Toolbox Name/i).fill(toolboxName);
  if (options?.serviceUrl) {
    await importDialog.getByLabel(/服务地址|Service URL/i).fill(options.serviceUrl);
  }

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/tool-box") &&
      !response.url().includes("/tool/"),
    { timeout: 180_000 },
  );

  await Promise.all([
    createResponsePromise,
    page.getByRole("dialog").getByRole("button", { name: /开始导入|^Import$/i }).click(),
  ]);
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBeTruthy();
  await expectAppToast(page, /导入成功|Imported successfully/i);
  await expect(importDialog).toBeHidden({ timeout: 30_000 });

  const body = (await createResponse.json()) as { box_id?: string };
  return { boxId: body.box_id ?? "" };
}

export async function openMcpToolDebugModal(
  page: Page,
  toolName: string,
  options?: { fromToolList?: boolean },
) {
  if (options?.fromToolList ?? true) {
    const toolItem = page.locator('[class*="toolItem"]').filter({ hasText: toolName }).first();
    await toolItem.getByRole("button", { name: /调\s*试|^Debug$/i }).click();
  } else {
    await page.locator('[class*="toolItem"]').filter({ hasText: toolName }).first().click();
    await page
      .locator('[class*="ioHeader"]')
      .getByRole("button", { name: /调\s*试|^Debug$/i })
      .click();
  }

  const modal = page.locator(".ant-modal").filter({
    hasText: /调试 MCP 工具|Debug MCP Tool/i,
  });
  await expect(modal).toBeVisible();
  return modal;
}

export async function runMcpToolDebugFromModal(
  page: Page,
  mcpId: string,
  options?: { argumentsPayload?: string },
) {
  const modal = page.locator(".ant-modal").filter({
    hasText: /调试 MCP 工具|Debug MCP Tool/i,
  });
  await expect(modal).toBeVisible();

  if (options?.argumentsPayload !== undefined) {
    await modal.getByRole("textbox").fill(options.argumentsPayload);
  }

  const debugResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/mcp/${mcpId}/tool/`) &&
      response.url().includes("/debug"),
    { timeout: 120_000 },
  );

  await modal.getByRole("button", { name: /调\s*试|^Debug$/i }).click();
  const response = await debugResponse;
  expect(response.ok()).toBeTruthy();
  await expect(modal.getByText(/调试结果|Debug Result/i)).toBeVisible();
  return response;
}

export async function debugMcpToolFromDetailPage(
  page: Page,
  mcpId: string,
  mcpName: string,
  toolName: string,
  options?: { argumentsPayload?: string; fromToolList?: boolean },
) {
  await gotoMcpDetailPage(page, mcpId, mcpName);
  await openMcpToolDebugModal(page, toolName, { fromToolList: options?.fromToolList });
  return runMcpToolDebugFromModal(page, mcpId, {
    argumentsPayload: options?.argumentsPayload,
  });
}

export async function registerLocalMcpViaUi(
  page: Page,
  options: { name: string; sseUrl: string },
) {
  const drawer = await openAddCapabilityWizard(page, "mcp");
  await drawer.getByLabel(/MCP 名称|MCP name|^Name$/i).fill(options.name);
  await drawer.getByLabel(/服务地址|Service URL/i).fill(options.sseUrl);

  const parseResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/mcp/parse/sse"),
    { timeout: 60_000 },
  );
  await drawer.getByRole("button", { name: /解析 SSE|Parse SSE/i }).click();
  const parseResponse = await parseResponsePromise;
  expect(parseResponse.ok()).toBeTruthy();
  await expectAppToast(page, /解析成功|Parsed .* successfully/i);

  const registerResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/v1/mcp") &&
      !response.url().includes("/parse/"),
    { timeout: 120_000 },
  );
  await Promise.all([
    registerResponsePromise,
    drawer.getByRole("button", { name: /确\s*定|^Confirm$/i }).click(),
  ]);
  const registerResponse = await registerResponsePromise;

  await expectAppToast(page, /成功|success/i);
  await gotoUnitsTab(page, "mcp");
  await expect(executionUnitCard(page, options.name)).toBeVisible({ timeout: 30_000 });

  if (registerResponse.ok()) {
    const body = (await registerResponse.json()) as { mcp_id?: string | number };
    if (body.mcp_id) {
      return { mcpId: String(body.mcp_id) };
    }
  }

  return { mcpId: "" };
}

export async function importBackupFileViaUi(
  page: Page,
  tab: "operator" | "toolbox" | "mcp",
  filePath: string,
  options?: { mode?: "create" | "upsert" },
) {
  await gotoUnitsTab(page, tab);
  const importDialog = await openImportModal(page);
  const panel = await openImportBackupTab(importDialog);
  if (options?.mode === "upsert") {
    await panel.getByRole("radio", { name: /新建或更新|New or update/i }).check();
  } else {
    await panel.getByRole("radio", { name: /^新建$|^New$/ }).check();
  }
  await panel.locator('input[type="file"]').setInputFiles(filePath);
  await expect(panel.locator(".ant-upload-list-item").first()).toBeVisible({
    timeout: 10_000,
  });
  return submitImportModal(page, importDialog, tab);
}

/** 卡片菜单导出：以 API 响应 + toast 为准（blob 程序化下载不一定触发 download 事件） */
export async function exportFromCardMenu(
  page: Page,
  name: string,
  type: "operator" | "toolbox" | "mcp",
) {
  const card = await searchExecutionUnitByName(page, name);
  await card.getByRole("button", { name: /更多操作|More/i }).click();
  const menu = page.getByRole("menu").last();
  await expect(menu).toBeVisible();
  const exportResponsePromise = waitForImpexExportResponse(page, type);
  await menu.getByRole("menuitem", { name: /导出|Export/i }).click();
  const response = await exportResponsePromise;
  expect(response.ok()).toBeTruthy();
  await expectAppToast(page, /导出成功|Export completed/i);
}

export async function triggerImpexExport(
  page: Page,
  type: "operator" | "toolbox" | "mcp",
  clickExport: () => Promise<void>,
) {
  const exportResponsePromise = waitForImpexExportResponse(page, type);
  await clickExport();
  const response = await exportResponsePromise;
  expect(response.ok()).toBeTruthy();
  await expectAppToast(page, /导出成功|Export completed/i);
}

export async function clickVisibleImpexExportButton(page: Page) {
  const exportButton = page.getByRole("button", { name: /导出|Export/i }).first();
  await expect(exportButton).toBeVisible({ timeout: 60_000 });
  await exportButton.click();
}
