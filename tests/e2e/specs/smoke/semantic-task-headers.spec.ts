/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true).
for (const width of [720, 1280, 1920]) {
  test(`semantic task headers keep English words intact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => localStorage.setItem("bkn-studio:locale", "en-US"));
    await page.goto("/studio/task-management?tab=semantic-understanding");
    const table = page.locator(".ant-table-content");
    await expect(table.locator("tbody tr[data-row-key]").first()).toBeVisible();
    for (const name of ["Confidence", "Application Status"]) {
      const header = table.getByRole("columnheader", { name: new RegExp(name) });
      await header.scrollIntoViewIfNeeded();
      const words = await header.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const bounds = element.getBoundingClientRect();
        const result: { word: string; lines: number; fits: boolean }[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const match of (node.textContent ?? "").matchAll(/[A-Za-z]+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const rects = Array.from(range.getClientRects());
            result.push({
              word: match[0],
              lines: rects.length,
              fits: rects.every((rect) => rect.left >= bounds.left && rect.right <= bounds.right),
            });
          }
        }
        return result;
      });
      expect(words.length).toBeGreaterThan(0);
      for (const word of words) {
        expect(word.lines, word.word).toBe(1);
        expect(word.fits, word.word).toBe(true);
      }
    }
    const trigger = table
      .getByRole("columnheader", { name: /Application Status/ })
      .locator(".ant-table-filter-trigger");
    await trigger.click();
    await expect(page.locator(".ant-table-filter-dropdown:visible")).toBeVisible();
    await page.keyboard.press("Escape");
    const fixed = table.locator("th.ant-table-cell-fix-right").last();
    const before = await fixed.boundingBox();
    await table.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const after = await fixed.boundingBox();
    expect(after!.x).toBeCloseTo(before!.x, 0);
  });
}
