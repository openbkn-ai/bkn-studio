import { expect, type Locator, type Page } from "@playwright/test";

/** 强制 UI 请求走 Vite 同源代理，避免 localhost/127.0.0.1 跨域导致 impex 无响应 */
export async function ensureE2eRuntime(page: Page) {
  await page.addInitScript(() => {
    window.__BKN_STUDIO_RUNTIME__ = {
      ...(window.__BKN_STUDIO_RUNTIME__ ?? {}),
      apiBaseUrl: "/api",
      currentUser: {
        businessDomainId: "bd_public",
        ...(window.__BKN_STUDIO_RUNTIME__?.currentUser ?? {}),
      },
    };
  });
}

export async function gotoE2ePage(page: Page, url: string) {
  await ensureE2eRuntime(page);
  await page.goto(url);
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
          /\/(operator\/info\/list|tool-box\/list|tool-box\/market|mcp\/market\/list|skill\/market\/list)/.test(
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

export async function gotoUnitsTab(page: Page, tab: "operator" | "toolbox" | "mcp" | "skill") {
  await gotoE2ePage(page, `/execution-factory/units?activeTab=${tab}`);
  await expect(page.getByText("执行单元管理").first()).toBeVisible();
  await retryListLoadIfNeeded(page);
}

export async function gotoToolboxToolsPage(page: Page, boxId: string, toolboxName: string) {
  const title = () => page.getByRole("heading", { level: 3, name: toolboxName });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoE2ePage(page, `/execution-factory/toolboxes/${boxId}/tools`);
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

export async function openCreateWizard(page: Page, tab: "operator" | "toolbox" | "mcp" | "skill") {
  const createPatterns: Record<typeof tab, RegExp> = {
    operator: /新建算子|New Operator/i,
    toolbox: /新建工具箱|New Toolbox/i,
    mcp: /新建 MCP|New MCP/i,
    skill: /导入 Skill|Import Skill/i,
  };

  await gotoUnitsTab(page, tab);
  await page
    .locator("button.ant-btn-primary")
    .filter({ hasText: createPatterns[tab] })
    .first()
    .click();

  const drawer = page.locator(".ant-drawer").first();
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function advanceCreateWizardToDetails(page: Page) {
  await page.getByRole("button", { name: /下一步|Next/i }).click();
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
  const scope = drawer ?? page.locator(".ant-drawer").first();
  if (mode === "openapi") {
    await scope.getByText(/^OpenAPI$/).click();
  } else {
    await scope.getByText(/函数计算|Function/i).click();
  }

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

export async function fillOpenApiSpecPaste(page: Page, spec: string) {
  const pastePanel = page.getByRole("tabpanel", { name: /粘贴|Paste/i });
  await expect(pastePanel.getByRole("textbox")).toBeVisible();
  await pastePanel.getByRole("textbox").fill(spec);
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
  await page
    .locator('[class*="toolbarActions"], [class*="toolbarRow"]')
    .getByRole("button", { name: /导入|Import/i })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog");
}

export async function selectWizardResourceType(
  drawer: import("@playwright/test").Locator,
  tab: "operator" | "toolbox" | "mcp" | "skill",
) {
  const labelPatterns: Record<typeof tab, RegExp> = {
    operator: /算子|Operators/i,
    toolbox: /工具|Tools/i,
    mcp: /^MCP$/,
    skill: /^Skill$/,
  };
  await drawer.getByText(labelPatterns[tab]).click();
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

export async function uploadAdpPackageInImportDialog(
  importDialog: Locator,
  filePath: string,
) {
  await expect(importDialog.getByLabel(/分类|Category/i)).toBeVisible({ timeout: 30_000 });
  await importDialog.locator(".ant-tabs-tab").filter({ hasText: /ADP 包|ADP Package/i }).click();
  const panel = importDialog.locator(".ant-tabs-tabpane-active");
  await expect(panel.getByText(/上传从其他环境导出|Upload an exported ADP/i)).toBeVisible();
  await panel.getByRole("radio", { name: /^新建$|^New$/ }).check();
  await panel.locator('input[type="file"]').setInputFiles(filePath);
  await expect(panel.locator(".ant-upload-list-item").first()).toBeVisible({
    timeout: 10_000,
  });
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
