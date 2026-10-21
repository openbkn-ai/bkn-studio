/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true).
for (const locale of ["en-US", "zh-CN"]) {
  test(`schedule actions use a dropdown (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript((value) => localStorage.setItem("bkn-studio:locale", value), locale);
    await page.goto("/studio/data-connect/cat-001/discover?tab=schedules");
    const row = page.locator("tbody tr[data-row-key]").first();
    const actions = row.locator("td.ant-table-cell-fix-right");
    const table = page.locator(".ant-table-content");
    for (const index of [4, 5, 6]) {
      const lines = await row
        .locator("td")
        .nth(index)
        .evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        });
      expect(lines).toBe(1);
    }
    const fixedHeader = table.locator("th.ant-table-cell-fix-right");
    const beforeScroll = await fixedHeader.boundingBox();
    const scrollLeft = await table.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return element.scrollLeft;
    });
    expect(scrollLeft).toBeGreaterThan(0);
    const afterScroll = await fixedHeader.boundingBox();
    expect(afterScroll!.x).toBeCloseTo(beforeScroll!.x, 0);

    await expect(actions.locator("button")).toHaveCount(1);
    const trigger = actions.getByRole("button", {
      name: locale === "en-US" ? "More actions" : "更多操作",
    });
    for (const name of locale === "en-US" ? ["Run Now", "Delete"] : ["立即执行", "删除"]) {
      await trigger.click();
      await expect(page.getByRole("menuitem")).toHaveCount(4);
      await expect(page.locator(".ant-dropdown-menu-item-danger:visible")).toBeVisible();
      await page.getByRole("menuitem", { name, exact: true }).click();
      const confirmation = page.getByRole("dialog");
      await expect(confirmation).toBeVisible();
      await confirmation
        .getByRole("button", { name: locale === "en-US" ? "Cancel" : /^取\s*消$/ })
        .click();
      await expect(confirmation).not.toBeVisible();
    }
    await trigger.click();
    await page
      .getByRole("menuitem", { name: locale === "en-US" ? "View Tasks" : "查看任务", exact: true })
      .click();
    await expect(page).toHaveURL(/tab=tasks/);
  });
}
