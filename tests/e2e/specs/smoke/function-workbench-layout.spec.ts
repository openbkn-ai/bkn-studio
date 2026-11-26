/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

// Run against Studio with VITE_USE_MOCK=true and VITE_MOCK_EDITION=professional.
// The mock function toolbox has no functions: each case drafts one on the page.
//
// bkn-studio#1441: the Cypher editor kept the height of its text, so where the column was short it
// spilled over the console below it. The console's parameters and its regenerate link drew over
// the statement, the result showed only its foot, and the console's head covered the network and
// result-shape controls.

const WORKBENCH = "/studio/execution-factory/toolboxes/tb_functions/tools";
const STATEMENT = [
  "MATCH (o:order)-[:placed_by]->(c:customer)",
  "WHERE o.paid_at < $cutoff_time",
  "  AND o.status = 'paid'",
  "  AND NOT (o)-[:shipped_as]->(:shipment)",
  "WITH o, c",
  "ORDER BY o.paid_at",
  "RETURN o.order_id AS order_id,",
  "  o.paid_at AS paid_at,",
  "  c.name AS customer,",
  "  o.amount AS amount,",
  "  o.channel AS channel,",
  "  o.warehouse AS warehouse,",
  "  o.region AS region,",
  "  o.priority AS priority",
  "LIMIT 100",
].join("\n");

// 1920 × 975 is the reporter's 2880 × 1462 screenshot at 150% zoom; the rest are common laptops.
const VIEWPORTS = [
  { width: 1920, height: 975 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

type Box = { top: number; bottom: number; left: number; right: number };

function box(locator: Locator): Promise<Box> {
  return locator.evaluate((element) => {
    const { top, bottom, left, right } = element.getBoundingClientRect();
    return { top, bottom, left, right };
  });
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

async function draft(page: Page, viewport: { width: number; height: number }, kind: string) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => localStorage.setItem("bkn-studio:locale", "zh-CN"));
  await page.goto(WORKBENCH);
  await page.getByRole("button", { name: "新建函数" }).click();
  await page.getByRole("menuitem", { name: kind }).click();
  await expect(page.getByTestId("function-editor-surface")).toBeVisible();
}

async function writeStatement(page: Page) {
  await page.getByTestId("cypher-editor").locator(".view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(STATEMENT);
}

/** The editor stays inside its surface, the surface above the console, and both reachable. */
async function expectApart(page: Page, viewportHeight: number, editor: Locator) {
  const surface = page.getByTestId("function-editor-surface");
  const console = page.getByTestId("function-console");
  const editorBox = await box(editor);
  const surfaceBox = await box(surface);
  const consoleBox = await box(console);
  expect(surfaceBox.bottom - surfaceBox.top).toBeGreaterThanOrEqual(159);
  expect(editorBox.bottom).toBeLessThanOrEqual(surfaceBox.bottom + 1);
  expect(editorBox.bottom).toBeLessThanOrEqual(consoleBox.top + 1);

  // Where the column is too short, it scrolls to the whole console and its result.
  await page.getByTestId("function-work-area").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const scrolled = await box(console);
  const result = await box(console.locator("pre").last());
  expect(scrolled.bottom).toBeLessThanOrEqual(viewportHeight + 1);
  expect(result.bottom).toBeLessThanOrEqual(scrolled.bottom + 1);
  expect(result.bottom - result.top).toBeGreaterThanOrEqual(100);
  expect((await box(editor)).bottom).toBeLessThanOrEqual(scrolled.top + 1);
}

for (const viewport of VIEWPORTS) {
  test(`Cypher workbench keeps editor, settings and console apart: ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await draft(page, viewport, "Cypher 函数");
    const picker = page.getByRole("combobox", { name: "知识网络" });
    await picker.click();
    await page.locator(".ant-select-item-option").first().click();
    await writeStatement(page);
    await page.locator(".ant-segmented-item", { hasText: "表格" }).click();

    const network = await box(page.locator(".ant-select", { has: picker }));
    const shape = await box(page.locator(".ant-segmented"));
    expect(overlaps(network, shape)).toBe(false);
    const consoleHead = await box(page.getByTestId("function-console").getByText("在线调试"));
    expect(overlaps(consoleHead, shape)).toBe(false);
    expect(overlaps(consoleHead, network)).toBe(false);

    await expectApart(page, viewport.height, page.getByTestId("cypher-editor"));

    // Folding the console gives its room to the editor.
    await page.getByTestId("function-work-area").evaluate((element) => {
      element.scrollTop = 0;
    });
    const before = await box(page.getByTestId("function-editor-surface"));
    await page.getByTestId("function-console").getByText("在线调试").click();
    await expect(page.getByTestId("function-console").locator("pre")).toHaveCount(0);
    const after = await box(page.getByTestId("function-editor-surface"));
    const editor = await box(page.getByTestId("cypher-editor"));
    expect(after.bottom - after.top).toBeGreaterThanOrEqual(before.bottom - before.top);
    expect(Math.abs(editor.bottom - after.bottom)).toBeLessThanOrEqual(1);
  });
}

test("Cypher workbench with its network notice keeps the console apart", async ({ page }) => {
  const viewport = { width: 1366, height: 768 };
  await draft(page, viewport, "Cypher 函数");
  await expect(page.locator(".ant-alert").first()).toBeVisible();
  await writeStatement(page);
  await expectApart(page, viewport.height, page.getByTestId("cypher-editor"));
});

test("Python workbench keeps the console apart", async ({ page }) => {
  const viewport = { width: 1366, height: 768 };
  await draft(page, viewport, "Python 函数");
  const editor = page.getByTestId("function-editor-surface").locator(":scope > *").first();
  await expectApart(page, viewport.height, editor);
});
