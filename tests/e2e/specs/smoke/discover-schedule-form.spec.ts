/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true).
for (const locale of ["en-US", "zh-CN"]) {
  for (const width of [1280, 720, 600]) {
    for (const mode of ["create", "edit"]) {
      test(`discover schedule ${mode} labels fit at ${width}px (${locale})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.addInitScript((value) => {
          localStorage.setItem("bkn-studio:locale", value);
        }, locale);
        await page.goto("/studio/data-connect/cat-001/discover?tab=schedules");

        const english = locale === "en-US";
        if (mode === "create") {
          await page
            .getByRole("button", {
              name: english ? "New Discovery Plan" : "新建探查计划",
              exact: true,
            })
            .first()
            .click();
        } else {
          await page
            .getByRole("button", { name: english ? "More actions" : "更多操作", exact: true })
            .first()
            .click();
          await page
            .getByRole("menuitem", { name: english ? "Edit" : "编辑", exact: true })
            .first()
            .click();
          await expect(page.getByRole("menu")).not.toBeVisible();
        }
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const labels = dialog.locator("label[for]");
        await expect(labels).toHaveCount(mode === "create" ? 7 : 6);
        // Include the rendered text and required marks: the old label boxes
        // stayed inside the modal while their text overflowed to the left.
        const geometry = await labels.evaluateAll((elements) =>
          elements.map((label) => {
            const field = label.parentElement!;
            const fieldBounds = field.getBoundingClientRect();
            const bodyBounds = field.lastElementChild!.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(label);
            return {
              text: label.textContent,
              field: { left: fieldBounds.left, right: fieldBounds.right },
              bodyTop: bodyBounds.top,
              rects: Array.from(range.getClientRects(), (rect) => ({
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom,
              })),
            };
          }),
        );
        for (const item of geometry) {
          for (const rect of item.rects) {
            expect(rect.left, item.text ?? "").toBeGreaterThanOrEqual(item.field.left - 1);
            expect(rect.right, item.text ?? "").toBeLessThanOrEqual(item.field.right + 1);
            expect(rect.bottom, item.text ?? "").toBeLessThanOrEqual(item.bodyTop + 1);
          }
        }
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
        expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width);

        const name = dialog.locator('input[id="name"]');
        await name.fill("Layout regression");
        await expect(name).toHaveValue("Layout regression");
        await expect(dialog.locator('[id="catalogId"]')).toBeDisabled();
        await dialog
          .locator(".ant-select")
          .filter({ has: page.locator('[id="strategy"]') })
          .click();
        await expect(
          page.locator(".ant-select-dropdown:visible .ant-select-item-option").first(),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await dialog
          .getByRole("button", { name: english ? "Cancel" : /^取\s*消$/, exact: true })
          .click();
        await expect(dialog).not.toBeVisible();
      });
    }
  }
}
