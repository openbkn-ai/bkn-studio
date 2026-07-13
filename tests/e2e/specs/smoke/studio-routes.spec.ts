/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test, type Page } from "@playwright/test";

const criticalRoutes = [
  { name: "home", path: "/studio/" },
  { name: "knowledge network", path: "/studio/knowledge-network" },
  { name: "data directory", path: "/studio/data-directory" },
  { name: "execution factory", path: "/studio/execution-factory/units" },
];

async function expectConsoleShell(page: Page) {
  await expect(page.locator(".console-shell")).toBeVisible();
  await expect(page.locator(".console-main")).toBeVisible();
  await expect(page.locator(".console-main")).not.toContainText(/Not Found|Error|Failed/);
}

test.describe("studio route smoke", () => {
  for (const route of criticalRoutes) {
    test(`${route.name} renders without a client crash`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });

      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expectConsoleShell(page);
      await page.waitForLoadState("networkidle");

      expect(pageErrors).toEqual([]);
    });
  }
});
