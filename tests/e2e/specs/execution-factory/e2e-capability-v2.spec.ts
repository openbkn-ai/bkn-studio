/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  BACKUP_FILE_TAB_LABEL,
  expectOpenApiOperationsIoPreview,
  expectOperatorAdvancedBanner,
  fillOpenApiSpecPaste,
  openAddCapabilityWizard,
  openAdvancedOperatorTab,
  openImportModal,
  openImportOpenApiPanel,
  gotoE2ePage,
  gotoUnitsTab,
} from "../../helpers/execution-unit-ui";
import { buildMinimalOpenApiSpec } from "../../helpers/operator";

test.describe("Execution Factory — Capability UX v2", () => {
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

  test("CAP-V2-01: management page defaults to toolsets tab", async ({ page }) => {
    await gotoE2ePage(page, "/execution-factory/units");
    await expect(page.getByText(/能力管理|Capability Management|执行能力管理|Execution Capabilities/i).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /工具集|Toolsets/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("CAP-V2-02: toolbox add capability opens API configure directly", async ({ page }) => {
    const drawer = await openAddCapabilityWizard(page, "toolbox");
    await expect(page.getByRole("dialog", { name: /添加 API|Add API/i })).toBeVisible();
    await expect(drawer.getByText(/粘贴 cURL|Paste cURL/i).first()).toBeVisible();
    await expect(drawer.getByText(/MCP 服务|MCP service/i)).toHaveCount(0);
    await expect(drawer.getByText(/Skill 包|Skill pack/i)).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("CAP-V2-03: mcp tab add capability skips unrelated modes", async ({ page }) => {
    const drawer = await openAddCapabilityWizard(page, "mcp");
    await expect(drawer.getByText(/MCP 名称|MCP Name/i).first()).toBeVisible();
    await expect(drawer.getByText(/粘贴 cURL|Paste cURL/i)).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("CAP-V2-04: operator tab reachable via deep link", async ({ page }) => {
    await openAdvancedOperatorTab(page);
    await expectOperatorAdvancedBanner(page);
    await expect(page.getByRole("button", { name: /新建算子|New Operator/i })).toBeVisible();
  });

  test("CAP-V2-06: toolbox wizard exposes operator sync checkbox", async ({ page }) => {
    const drawer = await openAddCapabilityWizard(page, "toolbox");
    await expect(drawer.getByText(/同步发布为算子|Sync publish as operator/i).first()).toBeVisible();
    await drawer.getByRole("checkbox", { name: /同步发布为算子|Sync publish as operator/i }).check();
    await expect(drawer.getByText(/算子名称|Operator name/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("CAP-V2-07: import modal exposes backup file tab on toolbox", async ({ page }) => {
    await gotoUnitsTab(page, "toolbox");
    const dialog = await openImportModal(page);
    await expect(dialog.getByRole("tab", { name: /OpenAPI/i })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: BACKUP_FILE_TAB_LABEL })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("CAP-V2-05: catalog still lists toolsets", async ({ page }) => {
    await gotoE2ePage(page, "/execution-factory/catalog?activeTab=toolbox");
    await expect(page.getByText(/能力市场|Capability Market|全部执行单元|All Execution Units/i).first()).toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("CAP-V2-08: import OpenAPI modal shows per-endpoint IO preview", async ({ page }) => {
    await gotoUnitsTab(page, "toolbox");
    const dialog = await openImportModal(page);
    const panel = await openImportOpenApiPanel(dialog);
    const spec = JSON.stringify(buildMinimalOpenApiSpec(`import_preview_${Date.now()}`), null, 2);
    await fillOpenApiSpecPaste(page, spec, panel);
    await expectOpenApiOperationsIoPreview(panel, { containsText: /input|Input/i });
    await page.keyboard.press("Escape");
  });

  test("CAP-V2-09: operator import OpenAPI modal shows per-endpoint IO preview", async ({ page }) => {
    await openAdvancedOperatorTab(page);
    const dialog = await openImportModal(page);
    const panel = await openImportOpenApiPanel(dialog);
    const spec = JSON.stringify(buildMinimalOpenApiSpec(`operator_import_${Date.now()}`), null, 2);
    await fillOpenApiSpecPaste(page, spec, panel);
    await expectOpenApiOperationsIoPreview(panel, { containsText: /input|Input/i });
    await page.keyboard.press("Escape");
  });
});
