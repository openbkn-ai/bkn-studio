import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  advanceCreateWizardToDetails,
  expectFunctionDefinitionSections,
  openCreateWizard,
} from "../../helpers/execution-unit-ui";

const TABS = [
  { key: "operator", label: "算子", createPattern: /新建算子|New Operator/i, step2Pattern: /函数计算|Function/i },
  { key: "toolbox", label: "工具", createPattern: /新建工具箱|New Toolbox/i, step2Pattern: /工具箱名称|Toolbox Name/i },
  { key: "mcp", label: "MCP", createPattern: /新建 MCP|New MCP/i, step2Pattern: /MCP 名称|MCP Name/i },
  { key: "skill", label: "Skill", createPattern: /导入 Skill|Import Skill/i, step2Pattern: /Skill 包|Skill Package/i },
] as const;

async function expectUnitsPageLoaded(page: import("@playwright/test").Page) {
  await expect(page.getByText("执行单元管理").first()).toBeVisible();
  await expect(page.getByRole("tablist")).toBeVisible();
}

test.describe("Execution Factory — UI tab navigation", () => {
  let backendReady = false;

  test.beforeAll(async ({ request }) => {
    try {
      await assertBackendReady(request);
      backendReady = true;
    } catch (error) {
      backendReady = false;
      console.warn(String(error));
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  for (const tab of TABS) {
    test(`UI-${tab.key}: ${tab.label} tab loads and create wizard reaches step 2`, async ({ page }) => {
      await page.goto(`/execution-factory/units?activeTab=${tab.key}`);
      await expectUnitsPageLoaded(page);
      await page.getByRole("tab", { name: tab.label }).click();

      const createButton = page
        .locator("button.ant-btn-primary")
        .filter({ hasText: tab.createPattern })
        .first();
      await expect(createButton).toBeVisible();
      await createButton.click();

      const overlay = page.locator(".ant-drawer").first();
      await expect(overlay).toBeVisible();
      await advanceCreateWizardToDetails(page);
      await expect(overlay.getByText(tab.step2Pattern).first()).toBeVisible();
      await page.keyboard.press("Escape");
    });
  }

  test("UI-catalog: catalog page loads with install actions", async ({ page }) => {
    await page.goto("/execution-factory/catalog?activeTab=toolbox");
    await expect(page.getByText("全部执行单元").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "工具" })).toBeVisible();
  });

  test("UI-operator-form: function create form shows definition sections", async ({ page }) => {
    await page.goto("/execution-factory/units/new?metadataType=function");
    await expect(page.getByRole("heading", { name: /注册算子|Register Operator/i })).toBeVisible();
    await expect(page.getByLabel(/算子名称|Operator Name/i)).toBeVisible();
    await expectFunctionDefinitionSections(page);
  });

  test("UI-operator-wizard: create overlay opens with type selection step", async ({ page }) => {
    const drawer = await openCreateWizard(page, "operator");
    await expect(drawer.getByText(/选择类型|Select type/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
