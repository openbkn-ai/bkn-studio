/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Live verification of the graph explorer against a real deployment.
 * Not part of CI: it needs a dev server whose VITE_DEV_ACCESS_TOKEN points at
 * a knowledge network with relation data. Configure through env:
 *   E2E_BASE_URL   dev server origin, e.g. http://localhost:8010
 *   GE_KN          knowledge network id
 *   GE_QUERY       semantic query that should hit at least one instance
 *   GE_OT          object type id for the filter tab (defaults to the found node's object type)
 *   GE_FIELD       property to filter on (defaults to the first primary key of the found node)
 *   GE_SHOTS       directory for screenshots
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const KN = process.env.GE_KN ?? "";
const QUERY = process.env.GE_QUERY ?? "";
const OT = process.env.GE_OT ?? "";
const SHOTS = process.env.GE_SHOTS ?? "/tmp/graph-explorer-shots";

type CachedNode = { id: string; otId: string; identity: Record<string, unknown>; display: string };
type Cache = { nodes: CachedNode[]; edges: { id: string }[]; positions: Record<string, { x: number; y: number }>; settings: { layout: string; shape: string } };

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

async function waitForCache(page: Page): Promise<Cache> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const cache = await readCache(page);
    if (cache && cache.nodes.length > 0) return cache;
    await page.waitForTimeout(250);
  }
  throw new Error("canvas cache never appeared");
}

async function readCache(page: Page): Promise<Cache | null> {
  return page.evaluate((kn) => {
    const raw = localStorage.getItem(`bkn-studio.graph-explorer.${kn}`);
    return raw ? (JSON.parse(raw) as Cache) : null;
  }, KN);
}

/** Viewport coordinates of a canvas node through the dev-only graph hook. */
async function nodeViewportPoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.evaluate((nodeId) => {
    const el = document.querySelector('[data-testid="graph-explorer-canvas"]') as (HTMLElement & { __g6Graph?: unknown }) | null;
    const graph = el?.__g6Graph as { getElementPosition(id: string): number[]; getViewportByCanvas(p: number[]): number[] } | undefined;
    if (!el || !graph) throw new Error("graph hook missing");
    const [cx, cy] = graph.getElementPosition(nodeId);
    const [vx, vy] = graph.getViewportByCanvas([cx, cy]);
    const rect = el.getBoundingClientRect();
    return { x: rect.left + vx, y: rect.top + vy };
  }, id);
}

async function contextMenu(page: Page, id: string, label: string) {
  const point = await nodeViewportPoint(page, id);
  await page.mouse.click(point.x, point.y, { button: "right" });
  const item = page.locator(".g6-contextmenu-li", { hasText: label }).first();
  await expect(item).toBeVisible({ timeout: 5_000 });
  await item.click();
}

async function stats(page: Page): Promise<{ nodes: number; edges: number }> {
  const text = await page.getByTestId("graph-explorer-stats").innerText();
  const numbers = text.match(/\d+/g) ?? [];
  return { nodes: Number(numbers[0] ?? 0), edges: Number(numbers[1] ?? 0) };
}

test.describe.configure({ mode: "serial" });

test.skip(!KN || !QUERY, "GE_KN and GE_QUERY are required");

test("graph explorer end to end", async ({ page, context }) => {
  test.setTimeout(240_000);

  // 1. Overview button opens the explorer in a new tab.
  await page.goto(`/studio/knowledge-network/workspace/${KN}/overview`);
  const openButton = page.getByTestId("open-graph-explorer");
  await expect(openButton).toBeVisible({ timeout: 60_000 });
  const [explorer] = await Promise.all([context.waitForEvent("page"), openButton.click()]);
  await explorer.waitForLoadState("domcontentloaded");
  expect(explorer.url()).toContain(`/knowledge-network/workspace/${KN}/graph-explorer`);
  await explorer.evaluate((kn) => localStorage.removeItem(`bkn-studio.graph-explorer.${kn}`), KN);
  await explorer.reload();
  await expect(explorer.getByTestId("graph-explorer-search-input")).toBeVisible({ timeout: 60_000 });
  await shot(explorer, "01-open");

  // 2. Semantic search → add first hit.
  await explorer.getByTestId("graph-explorer-search-input").locator("input").fill(QUERY);
  await explorer.getByTestId("graph-explorer-search-input").locator("input").press("Enter");
  const firstResult = explorer.getByTestId("graph-explorer-result").first();
  await expect(firstResult).toBeVisible({ timeout: 90_000 });
  await firstResult.getByTestId("graph-explorer-add").click();
  await expect.poll(async () => (await stats(explorer)).nodes, { timeout: 20_000 }).toBe(1);
  await shot(explorer, "02-search-added");
  const cache1 = await waitForCache(explorer);
  const seed = cache1.nodes[0];
  expect(seed.id).toBeTruthy();
  const seedField = process.env.GE_FIELD ?? Object.keys(seed.identity)[0];
  const seedValue = String(seed.identity[seedField]);

  // 3. Filter query for the same instance → id converges, stays 1 node.
  await explorer.getByRole("tab", { name: /条件查询|Filter query/ }).click();
  await explorer.getByTestId("graph-explorer-ot-select").click();
  await explorer.getByTestId("graph-explorer-ot-select").locator("input").fill(OT || seed.otId);
  await explorer.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  await explorer.getByTestId("graph-explorer-cond-field").click();
  await explorer.getByTestId("graph-explorer-cond-field").locator("input").fill(seedField);
  await explorer.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  await explorer.getByTestId("graph-explorer-cond-value").fill(seedValue);
  await explorer.getByTestId("graph-explorer-query").click();
  await expect(explorer.getByTestId("graph-explorer-on-canvas").first()).toBeVisible({ timeout: 60_000 });
  expect((await stats(explorer)).nodes).toBe(1);
  await shot(explorer, "03-filter-converged");

  // 4. Expand outgoing, then incoming, then both.
  await contextMenu(explorer, seed.id, "展开出边");
  await expect.poll(async () => (await stats(explorer)).nodes, { timeout: 60_000 }).toBeGreaterThan(1);
  const afterOut = await stats(explorer);
  await shot(explorer, "04-expand-out");
  await contextMenu(explorer, seed.id, "展开入边");
  await explorer.waitForTimeout(4_000);
  const afterIn = await stats(explorer);
  await shot(explorer, "05-expand-in");
  await contextMenu(explorer, seed.id, "双向展开");
  await explorer.waitForTimeout(4_000);
  const afterBoth = await stats(explorer);
  await shot(explorer, "06-expand-both");
  expect(afterBoth.nodes).toBeGreaterThanOrEqual(Math.max(afterOut.nodes, afterIn.nodes));

  // 5. Path between the seed and a neighbour; then between the seed and itself is impossible, so pick a far node.
  const cache2 = (await readCache(explorer))!;
  const neighbour = cache2.nodes.find((node) => node.id !== seed.id)!;
  await contextMenu(explorer, seed.id, "设为路径起点");
  await contextMenu(explorer, neighbour.id, "设为路径终点");
  await explorer.getByTestId("graph-explorer-find-path").click();
  await expect(explorer.locator(".ant-message-notice", { hasText: /跳路径|不连通|hop|Not connected/ })).toBeVisible({ timeout: 60_000 });
  await shot(explorer, "07-path");

  // 6. Layout and shape switches, then reload restores.
  await explorer.getByTestId("graph-explorer-layout").click();
  await explorer.locator(".ant-select-dropdown:visible .ant-select-item-option", { hasText: /层次|Hierarchical/ }).click();
  await explorer.waitForTimeout(1_500);
  await explorer.getByTestId("graph-explorer-shape").click();
  await explorer.locator(".ant-select-dropdown:visible .ant-select-item-option", { hasText: /矩形|Rectangle/ }).click();
  await explorer.waitForTimeout(1_500);
  await shot(explorer, "08-layout-shape");
  const before = await stats(explorer);
  await explorer.reload();
  await expect(explorer.getByTestId("graph-explorer-stats")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await stats(explorer)).nodes, { timeout: 20_000 }).toBe(before.nodes);
  const cache3 = (await readCache(explorer))!;
  expect(cache3.settings.layout).toBe("dagre");
  expect(cache3.settings.shape).toBe("rect");
  await shot(explorer, "09-restored");

  // 7. Clear cache.
  await explorer.getByRole("button", { name: /清除缓存|Clear cache/ }).click();
  await explorer.locator(".ant-popconfirm:visible .ant-btn-primary").click();
  await expect.poll(() => readCache(explorer), { timeout: 10_000 }).toBeNull();
  await shot(explorer, "10-cache-cleared");
});
