/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true).
for (const locale of ["en-US", "zh-CN"]) {
  for (const tab of ["small-model", "llm"]) {
    for (const width of [647, 768, 1280, 1920]) {
      test(`model toolbar remains clickable: ${tab}, ${locale}, ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 871 });
        await page.addInitScript((value) => {
          localStorage.setItem("bkn-studio:locale", value);
        }, locale);
        await page.goto(`/studio/model-resources/models?tab=${tab}`);

        const toolbar = page.locator('[class*="toolbarLeft"]').locator("..");
        const create = toolbar.getByRole("button", {
          name: locale === "en-US" ? /Create$/ : /新建$/,
        });
        await expect(create).toBeVisible();
        // Wait for the asynchronously loaded role permissions and model list.
        await expect(toolbar.locator('[class*="iconButton"]').last()).toBeEnabled();
        const controls = toolbar.locator(
          '[class*="toolbarLeft"] button, .ant-input-group-wrapper, [class*="filterGroup"], [class*="iconButton"]',
        );
        await expect(controls).toHaveCount(6);
        const container = await toolbar.boundingBox();
        expect(container).not.toBeNull();
        const bounds = await controls.evaluateAll((elements) =>
          elements.map((element) => {
            const { left, right, top, bottom } = element.getBoundingClientRect();
            return { left, right, top, bottom };
          }),
        );
        for (let index = 0; index < bounds.length; index += 1) {
          const current = bounds[index];
          expect(current.left).toBeGreaterThanOrEqual(container!.x - 1);
          expect(current.right).toBeLessThanOrEqual(container!.x + container!.width + 1);
          expect(current.top).toBeGreaterThanOrEqual(container!.y - 1);
          expect(current.bottom).toBeLessThanOrEqual(container!.y + container!.height + 1);
          for (const other of bounds.slice(index + 1)) {
            const overlapX =
              Math.min(current.right, other.right) - Math.max(current.left, other.left);
            const overlapY =
              Math.min(current.bottom, other.bottom) - Math.max(current.top, other.top);
            expect(overlapX > 1 && overlapY > 1).toBe(false);
          }
        }
        if (width >= 1280) {
          for (const current of bounds) expect(current.top).toBeCloseTo(bounds[0].top, 0);
        }

        // A DOM click can bypass an overlay. Check hit testing and use a real
        // mouse click at the button center to reproduce the original failure.
        await create.scrollIntoViewIfNeeded();
        await expect(
          create.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            return button.contains(
              document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
            );
          }),
        ).resolves.toBe(true);
        const button = await create.boundingBox();
        expect(button).not.toBeNull();
        await page.mouse.click(button!.x + button!.width / 2, button!.y + button!.height / 2);
        await expect(page.getByRole("dialog")).toBeVisible();
      });
    }
  }
}
