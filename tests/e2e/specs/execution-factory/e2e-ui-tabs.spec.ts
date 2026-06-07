import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";

const TABS = [
  { key: "operator", label: "算子", createPattern: /新建算子|New Operator/i },
  { key: "toolbox", label: "工具", createPattern: /新建工具箱|New Toolbox/i },
  { key: "mcp", label: "MCP", createPattern: /新建 MCP|New MCP/i },
  { key: "skill", label: "Skill", createPattern: /导入 Skill|Import Skill/i },
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
    test(`UI-${tab.key}: ${tab.label} tab loads and opens create overlay`, async ({ page }) => {
      await page.goto(`/execution-factory/units?activeTab=${tab.key}`);
      await expectUnitsPageLoaded(page);
      await page.getByRole("tab", { name: tab.label }).click();

      const createButton = page
        .locator("button.ant-btn-primary")
        .filter({ hasText: tab.createPattern })
        .first();
      await expect(createButton).toBeVisible();
      await createButton.click();

      const overlay = page.locator(".ant-modal, .ant-drawer").first();
      await expect(overlay).toBeVisible();
      await page.keyboard.press("Escape");
    });
  }

  test("UI-catalog: catalog page loads with install actions", async ({ page }) => {
    await page.goto("/execution-factory/catalog?activeTab=toolbox");
    await expect(page.getByText("全部执行单元").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "工具" })).toBeVisible();
  });

  test("UI-operator-form: function create form opens", async ({ page }) => {
    await page.goto("/execution-factory/units/new?metadataType=function");
    await expect(page.getByRole("heading", { name: "注册算子" })).toBeVisible();
    await expect(page.getByLabel("算子名称")).toBeVisible();
  });
});
