/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true).
for (const locale of ["en-US", "zh-CN"]) {
  for (const width of [720, 1280, 1920]) {
    test(`resource status columns stay readable: ${locale}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((value) => {
        localStorage.setItem("bkn-studio:locale", value);
        localStorage.setItem("data-catalog.treeCollapsed", "0");
      }, locale);
      await page.goto("/studio/data-catalog/catalog/cat-001");
      const table = page.locator(".ant-table-content");
      await expect(table.locator("tbody tr[data-row-key]").first()).toBeVisible();
      const names =
        locale === "en-US"
          ? ["Resource Status", "Discovery Status", "Local Index Status"]
          : ["资源状态", "探查状态", "本地索引状态"];
      for (const name of names) {
        const header = table.getByRole("columnheader", { name, exact: true });
        await header.scrollIntoViewIfNeeded();
        const geometry = await header.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
            rects: Array.from(range.getClientRects(), (rect) => ({
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            })),
          };
        });
        for (const rect of geometry.rects) {
          expect(rect.left).toBeGreaterThanOrEqual(geometry.left - 1);
          expect(rect.right).toBeLessThanOrEqual(geometry.right + 1);
          expect(rect.top).toBeGreaterThanOrEqual(geometry.top - 1);
          expect(rect.bottom).toBeLessThanOrEqual(geometry.bottom + 1);
        }
      }
      // Status tags must fit their cell content box, including margins;
      // otherwise table ellipsis can appear beside an already complete label.
      const statusTags = await table.locator("tbody tr[data-row-key]").evaluateAll((rows) =>
        rows.flatMap((row) =>
          [3, 4, 5, 6].flatMap((index) => {
            const cell = row.children[index];
            const cellStyle = getComputedStyle(cell);
            const available =
              cell.clientWidth -
              parseFloat(cellStyle.paddingLeft) -
              parseFloat(cellStyle.paddingRight);
            return Array.from(cell.querySelectorAll(".ant-tag"), (tag) => {
              const style = getComputedStyle(tag);
              return {
                text: tag.textContent,
                width:
                  tag.getBoundingClientRect().width +
                  parseFloat(style.marginLeft) +
                  parseFloat(style.marginRight),
                available,
              };
            });
          }),
        ),
      );
      expect(statusTags.length).toBeGreaterThan(0);
      for (const tag of statusTags)
        expect(tag.width, tag.text ?? "").toBeLessThanOrEqual(tag.available + 1);
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
