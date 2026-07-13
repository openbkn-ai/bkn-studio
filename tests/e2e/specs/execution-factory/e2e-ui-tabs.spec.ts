/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  advanceCreateWizardToDetails,
  ensureLegacyE2eRuntime,
  expectCapabilityManagementPage,
  expectFunctionDefinitionSections,
  gotoE2ePage,
  gotoLegacyE2ePage,
  openAddCapabilityWizard,
  openAdvancedOperatorTab,
  openCreateWizard,
} from "../../helpers/execution-unit-ui";

const PRIMARY_TABS = [
  {
    key: "toolbox" as const,
    label: /工具集|Toolsets|工具|Tools/i,
    configurePattern: /粘贴 cURL|Paste cURL|添加 API|Add API/i,
  },
  {
    key: "mcp" as const,
    label: /MCP 服务|MCP Services|MCP/i,
    configurePattern: /MCP 名称|MCP Name|MCP 服务|MCP service/i,
  },
  {
    key: "skill" as const,
    label: /Skill 包|Skill Packs|Skill/i,
    configurePattern: /Skill 包|Skill pack|导入技能包|Import skill pack|SKILL\.md/i,
  },
];

async function expectUnitsPageLoaded(page: import("@playwright/test").Page) {
  await expectCapabilityManagementPage(page);
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

  for (const tab of PRIMARY_TABS) {
    test(`UI-${tab.key}: primary tab loads and add capability opens configure step`, async ({
      page,
    }) => {
      await gotoE2ePage(page, `/execution-factory/units?activeTab=${tab.key}`);
      await expectUnitsPageLoaded(page);

      const drawer = await openAddCapabilityWizard(page, tab.key);
      await expect(drawer.getByText(tab.configurePattern).first()).toBeVisible();
      await page.keyboard.press("Escape");
    });
  }

  test("UI-operator-advanced: advanced operator tab and legacy wizard", async ({ page }) => {
    await openAdvancedOperatorTab(page);
    await page
      .locator("button.ant-btn-primary")
      .filter({ hasText: /新建算子|New Operator/i })
      .first()
      .click();
    const overlay = page.locator(".ant-drawer").first();
    await expect(overlay).toBeVisible();
    await advanceCreateWizardToDetails(page);
    await expect(overlay.getByText(/函数计算|Function/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("UI-catalog: catalog page loads with install actions", async ({ page }) => {
    await gotoE2ePage(page, "/execution-factory/catalog?activeTab=toolbox");
    await expect(page.getByText(/能力市场|全部执行单元/).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /工具|Tools|工具集|Toolsets/i })).toBeVisible();
  });

  test("UI-operator-form: function create form shows definition sections", async ({ page }) => {
    await gotoE2ePage(page, "/execution-factory/units/new?metadataType=function");
    await expect(page.getByRole("heading", { name: /注册算子|Register Operator/i })).toBeVisible();
    await expect(page.getByLabel(/算子名称|Operator Name/i)).toBeVisible();
    await expectFunctionDefinitionSections(page);
  });

  test("UI-operator-wizard: create overlay opens with type selection step", async ({ page }) => {
    const drawer = await openCreateWizard(page, "operator");
    await expect(drawer.getByText(/选择类型|Select type|选择方式|Choose method/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test.describe("legacy UX", () => {
    test.beforeEach(async ({ page }) => {
      await ensureLegacyE2eRuntime(page);
    });

    test("UI-legacy-toolbox: legacy create toolbox button", async ({ page }) => {
      await gotoLegacyE2ePage(page, "/execution-factory/units?activeTab=toolbox");
      await expect(page.getByText(/能力管理|执行单元管理/).first()).toBeVisible();
      await page
        .locator("button.ant-btn-primary")
        .filter({ hasText: /新建工具箱|New Toolbox/i })
        .first()
        .click();
      const overlay = page.locator(".ant-drawer").first();
      await expect(overlay.getByText(/选择类型|Select type/i).first()).toBeVisible();
      await overlay.getByRole("button", { name: /下一步|Next/i }).click();
      await expect(overlay.getByLabel(/工具箱名称|Toolbox Name/i)).toBeVisible();
      await page.keyboard.press("Escape");
    });
  });
});
