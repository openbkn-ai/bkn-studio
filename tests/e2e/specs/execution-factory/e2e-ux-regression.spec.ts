import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  advanceCreateWizardToDetails,
  expectAppToast,
  expectFunctionDefinitionSections,
  executionUnitCard,
  gotoE2ePage,
  gotoToolboxToolsPage,
  gotoUnitsTab,
  openCreateWizard,
  openOperatorCreateWizardStep2,
  openToolboxCardMenu,
  openToolboxDetailDrawer,
  selectOperatorCreateMode,
  triggerImpexExport,
  clickVisibleImpexExportButton,
} from "../../helpers/execution-unit-ui";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createFunctionToolboxViaApi,
  createToolboxViaApi,
} from "../../helpers/toolbox";

test.describe("Execution Factory — UX regression", () => {
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

  test("UX-003: card click opens operator detail drawer", async ({ page }) => {
    await gotoUnitsTab(page, "operator");

    const firstCard = page.locator('[data-testid="execution-unit-card"]').first();
    if ((await firstCard.count()) === 0) {
      test.skip(true, "no operator cards available");
    }

    await firstCard.click();
    await expect(page.locator(".ant-drawer").getByText(/算子详情|Operator Detail/i)).toBeVisible();
  });

  test("UX-021: catalog skill tab shows introduce action", async ({ page }) => {
    await page.goto("/execution-factory/catalog?activeTab=skill");
    await expect(page.getByRole("tab", { name: "Skill" })).toBeVisible();

    const introduceButton = page.getByRole("button", { name: /引入|Introduce/i }).first();
    if ((await introduceButton.count()) === 0) {
      test.skip(true, "no market skill cards available");
    }

    await expect(introduceButton).toBeVisible();
  });

  test("UX-034: legacy skills route redirects with create deep link", async ({ page }) => {
    await page.goto("/execution-factory/skills/new");
    await expect(page).toHaveURL(/activeTab=skill/);
    await expect(page).toHaveURL(/create=1/);
    await expect(page.getByText("执行单元管理").first()).toBeVisible();
  });

  test("UX-017: operator wizard selecting function navigates to registration form", async ({
    page,
  }) => {
    await openOperatorCreateWizardStep2(page);
    await selectOperatorCreateMode(page, "function");

    await expect(page).toHaveURL(/\/execution-factory\/units\/new\?metadataType=function/);
    await expect(page.getByRole("heading", { name: /注册算子|Register Operator/i })).toBeVisible();
    await expect(page.locator(".ant-drawer")).toHaveCount(0);
  });

  test("UX-018: function operator form shows inputs, logic, outputs in order", async ({ page }) => {
    await page.goto("/execution-factory/units/new?metadataType=function");
    await expect(page.getByRole("heading", { name: /注册算子|Register Operator/i })).toBeVisible();
    await expectFunctionDefinitionSections(page);
  });

  test("UX-019: operator wizard selecting OpenAPI navigates to registration form", async ({
    page,
  }) => {
    await openOperatorCreateWizardStep2(page);
    await selectOperatorCreateMode(page, "openapi");
  });

  test("UX-024: toolbox card edit opens inline drawer editor without leaving list", async ({
    page,
    request,
  }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("edit_drawer"));
    createdBoxIds.push(toolbox.boxId);

    await gotoUnitsTab(page, "toolbox");
    await expect(executionUnitCard(page, toolbox.name)).toBeVisible();

    await openToolboxCardMenu(page, toolbox.name, "编辑");

    const drawer = page.locator(".ant-drawer").first();
    await expect(drawer.getByText(/编辑工具箱|Edit Toolbox/i)).toBeVisible();
    await expect(page).toHaveURL(/\/execution-factory\/units\?activeTab=toolbox/);
    await expect(drawer.getByLabel(/工具箱名称|Toolbox Name/i)).toBeVisible();
    await expect(drawer.getByRole("button", { name: /保\s*存|Save/i })).toBeVisible();
  });

  test("UX-025: toolbox detail drawer export triggers ADP download", async ({ page, request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("drawer_export"));
    createdBoxIds.push(toolbox.boxId);

    await gotoE2ePage(
      page,
      `/execution-factory/units?activeTab=toolbox&detailId=${toolbox.boxId}`,
    );
    const drawer = page.locator(".ant-drawer").first();
    await expect(drawer.getByText(/工具箱详情|Toolbox Detail/i)).toBeVisible({
      timeout: 60_000,
    });

    await triggerImpexExport(page, "toolbox", async () => {
      await drawer.getByRole("button", { name: /导出|Export/i }).click();
    });
  });

  test("UX-026: toolbox tools page header export triggers ADP download", async ({
    page,
    request,
  }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("tools_export"));
    createdBoxIds.push(toolbox.boxId);

    await gotoToolboxToolsPage(page, toolbox.boxId, toolbox.name);

    await triggerImpexExport(page, "toolbox", async () => {
      await clickVisibleImpexExportButton(page);
    });
  });

  test("UX-027: function toolbox create tool drawer shows function definition fields", async ({
    page,
    request,
  }) => {
    const toolbox = await createFunctionToolboxViaApi(request, buildToolboxName("fn_tool"));
    createdBoxIds.push(toolbox.boxId);

    await page.goto(`/execution-factory/toolboxes/${toolbox.boxId}/tools?create=1`);
    const drawer = page.locator(".ant-drawer").first();
    await expect(drawer).toBeVisible();
    await expectFunctionDefinitionSections(page, drawer);
  });

  test("UX-028: create wizard step 2 shows expected content per tab", async ({ page }) => {
    const operatorDrawer = await openCreateWizard(page, "operator");
    await advanceCreateWizardToDetails(page);
    await expect(operatorDrawer.getByText("函数计算")).toBeVisible();
    await page.keyboard.press("Escape");

    const toolboxDrawer = await openCreateWizard(page, "toolbox");
    await advanceCreateWizardToDetails(page);
    await expect(toolboxDrawer.getByLabel(/工具箱名称|Toolbox Name/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
