/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true).
for (const path of [
  "/studio/data-connect/cat-001/discover?tab=tasks",
  "/studio/task-management?tab=discover",
]) {
  for (const locale of ["en-US", "zh-CN"]) {
    for (const width of [720, 1280, 1920]) {
      test(`discover task filter hit targets: ${path}, ${locale}, ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.addInitScript(
          (value) => localStorage.setItem("bkn-studio:locale", value),
          locale,
        );
        await page.goto(path);
        const table = page.locator(".ant-table-content").first();
        await expect(table.locator("tbody tr[data-row-key]").first()).toBeVisible();
        const headers = table
          .locator("th")
          .filter({ has: page.locator(".ant-table-filter-trigger") });
        const english = locale === "en-US";
        const priorityHeader = table.getByRole("columnheader", {
          name: english ? "Queue Priority" : "队列优先级",
          exact: true,
        });
        const priorityGeometry = await priorityHeader.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return {
            left: bounds.left,
            right: bounds.right,
            lines: Array.from(range.getClientRects(), (rect) => ({
              left: rect.left,
              right: rect.right,
            })),
          };
        });
        for (const line of priorityGeometry.lines) {
          expect(line.left).toBeGreaterThanOrEqual(priorityGeometry.left - 1);
          expect(line.right).toBeLessThanOrEqual(priorityGeometry.right + 1);
        }

        for (const index of [0, 1]) {
          const header = headers.nth(index);
          const trigger = header.locator(".ant-table-filter-trigger");
          await trigger.scrollIntoViewIfNeeded();
          const title = header.locator(".ant-table-column-title");
          const geometry = await title.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const filter = element
              .parentElement!.querySelector(".ant-table-filter-trigger")!
              .getBoundingClientRect();
            return {
              filterLeft: filter.left,
              rights: Array.from(range.getClientRects(), (rect) => rect.right),
            };
          });
          for (const right of geometry.rights)
            expect(right).toBeLessThanOrEqual(geometry.filterLeft + 1);
          // A normal pointer click must hit the filter, without forced events.
          await trigger.click();
          const dropdown = page.locator(".ant-table-filter-dropdown:visible");
          await expect(dropdown).toBeVisible();
          const options = dropdown.locator(".ant-dropdown-menu-item");
          await (index === 0 ? options.last() : options.first()).click();
          await dropdown.getByRole("button", { name: english ? "OK" : /^确\s*定$/ }).click();
          await expect(dropdown).not.toBeVisible();
          await expect(trigger).toHaveClass(/active/);
          if (index === 0) {
            await expect(table.locator("tbody tr[data-row-key]")).toHaveCount(0);
            await expect(table.locator(".ant-table-placeholder")).toBeVisible();
          }
          await trigger.click();
          await dropdown.getByRole("button", { name: english ? "Reset" : /^重\s*置$/ }).click();
          await dropdown.getByRole("button", { name: english ? "OK" : /^确\s*定$/ }).click();
          await expect(dropdown).not.toBeVisible();
          await expect(trigger).not.toHaveClass(/active/);
          await expect(table.locator("tbody tr[data-row-key]").first()).toBeVisible();
        }
        const fixed = table.locator("th.ant-table-cell-fix-right").last();
        const before = await fixed.boundingBox();
        await table.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
        });
        const after = await fixed.boundingBox();
        expect(after!.x).toBeCloseTo(before!.x, 0);
      });
    }
  }
}
