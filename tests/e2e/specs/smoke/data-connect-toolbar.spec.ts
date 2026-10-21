/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true).
for (const locale of ["en-US", "zh-CN"]) {
  for (const width of [768, 1199, 1200, 1201, 1280, 1440, 1920]) {
    test(`data connection toolbar stays usable at ${width}px (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((value) => {
        localStorage.setItem("bkn-studio:locale", value);
      }, locale);
      await page.goto("/studio/data-connect");

      const toolbar = page.locator('[class*="operationBar"]').first();
      const controls = toolbar.locator(
        '[class*="toolbarActions"] button, .ant-input-affix-wrapper, .ant-select',
      );
      await expect(controls).toHaveCount(6);
      await expect(toolbar.locator("button").first()).toBeEnabled();
      const bounds = await controls.evaluateAll((elements) =>
        elements.map((element) => {
          const { left, right, top, bottom } = element.getBoundingClientRect();
          return { left, right, top, bottom };
        }),
      );
      const container = await toolbar.boundingBox();
      expect(container).not.toBeNull();
      for (let index = 0; index < bounds.length; index += 1) {
        const current = bounds[index];
        expect(current.left).toBeGreaterThanOrEqual(container!.x - 1);
        expect(current.right).toBeLessThanOrEqual(container!.x + container!.width + 1);
        for (const other of bounds.slice(index + 1)) {
          const overlapX =
            Math.min(current.right, other.right) - Math.max(current.left, other.left);
          const overlapY =
            Math.min(current.bottom, other.bottom) - Math.max(current.top, other.top);
          expect(overlapX > 0 && overlapY > 0).toBe(false);
        }
      }
      for (const control of await controls.all()) {
        await control.click({ trial: true });
      }

      const search = toolbar.locator("input").first();
      await search.click();
      await expect(search).toBeFocused();

      // Keep the existing table overflow and sticky Actions column behavior.
      const table = page.locator(".ant-table-content");
      await expect(table).toBeVisible();
      if (width === 1280) {
        const fixedAction = table.locator("th.ant-table-cell-fix-right").last();
        await expect(fixedAction).toBeVisible();
        const before = await fixedAction.boundingBox();
        const scrollLeft = await table.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
          return element.scrollLeft;
        });
        expect(scrollLeft).toBeGreaterThan(0);
        const after = await fixedAction.boundingBox();
        expect(after!.x).toBeCloseTo(before!.x, 0);
      }
    });
  }
}
