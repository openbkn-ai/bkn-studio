/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test, type Page } from "@playwright/test";

async function expectConsoleShell(page: Page) {
  await expect(page.locator(".console-shell")).toBeVisible();
  await expect(page.locator(".console-main")).toBeVisible();
  await expect(page.locator(".console-main")).not.toContainText(/Not Found|Error|Failed/);
}

test.describe("system-admin license management", () => {
  test("renders license summary and keeps permission management naming separate", async ({ page }) => {
    await page.goto("/studio/system/license", { waitUntil: "domcontentloaded" });
    await expectConsoleShell(page);

    const main = page.locator(".console-main");
    await expect(main.getByText("授权管理", { exact: true })).toBeVisible();
    await expect(main.getByText("设备指纹", { exact: true })).toBeVisible();
    await expect(main.getByText("激活方式")).toBeVisible();
    await expect(main.getByRole("heading", { name: "授权范围" })).toBeVisible();

    await expect(page.getByRole("button", { name: /权限管理/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /授权管理/ })).toBeVisible();
  });
});
