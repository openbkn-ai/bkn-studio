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

test.describe("system-admin role system", () => {
  test("renders the default Studio role set", async ({ page }) => {
    await page.goto("/studio/system/roles", { waitUntil: "domcontentloaded" });
    await expectConsoleShell(page);

    const main = page.locator(".console-main");
    await expect(main.getByRole("button", { name: "super_admin", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "admin", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "security", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "audit", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "network_builder", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "normal_user", exact: true })).toBeVisible();
    await expect(main).not.toContainText("viewer");
  });

  test("warns when a user is assigned multiple three-admin roles", async ({ page }) => {
    await page.goto("/studio/system/users", { waitUntil: "domcontentloaded" });
    await expectConsoleShell(page);

    const userRow = page.getByRole("row").filter({ hasText: "chen.yanqiu" });
    await expect(userRow).toBeVisible();
    await userRow.getByRole("button", { name: "角色" }).click();

    const drawer = page.getByRole("dialog", { name: /配置角色/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: /super_admin/ })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: /normal_user/ })).toBeVisible();

    await drawer.getByRole("button", { name: /admin/ }).click();
    await drawer.getByRole("button", { name: /security/ }).click();

    await expect(drawer.getByText("存在三员职责冲突")).toBeVisible();
    await expect(drawer.getByText("同一普通账号不建议同时拥有多个三员角色")).toBeVisible();
  });
});
