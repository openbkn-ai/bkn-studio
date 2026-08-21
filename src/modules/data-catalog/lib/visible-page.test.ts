/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { collectVisiblePage, pagerTotal } from "@/modules/data-catalog/lib/visible-page";

/** A backend page: `total` counts every row, `visible` says which of them survive the filter. */
function backend(total: number, visible: (index: number) => boolean) {
  return vi.fn((offset: number, limit: number) =>
    Promise.resolve({
      items: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => offset + i)
        .filter((index) => visible(index))
        .map((index) => `row-${index}`),
      total,
    }),
  );
}

describe("collectVisiblePage", () => {
  it("fills a page from rows scattered behind invisible ones", async () => {
    const fetchRaw = backend(100, (index) => index % 10 === 0);

    const page = await collectVisiblePage(fetchRaw, { pageSize: 5, requestBudget: 50 });

    expect(page.items).toEqual(["row-0", "row-10", "row-20", "row-30", "row-40"]);
    expect(page.exhausted).toBe(false);
    expect(page.rawTotal).toBe(100);
  });

  it("keeps reading past an empty page instead of calling the list finished", async () => {
    // Nothing visible until row 25: stopping on the first empty page would lose every row.
    const fetchRaw = backend(40, (index) => index >= 25);

    const page = await collectVisiblePage(fetchRaw, { pageSize: 10, requestBudget: 50 });

    expect(page.items).toEqual([
      "row-25", "row-26", "row-27", "row-28", "row-29",
      "row-30", "row-31", "row-32", "row-33", "row-34",
    ]);
    expect(page.exhausted).toBe(false);
  });

  it("ends only when the raw space runs out, not when the total is reached", async () => {
    const fetchRaw = backend(12, (index) => index === 11);

    const page = await collectVisiblePage(fetchRaw, { pageSize: 10, requestBudget: 50 });

    expect(page.items).toEqual(["row-11"]);
    expect(page.exhausted).toBe(true);
    expect(page.rawTotal).toBe(12);
  });

  it("reports an account that may see nothing without claiming more pages", async () => {
    const fetchRaw = backend(30, () => false);

    const page = await collectVisiblePage(fetchRaw, { pageSize: 10, requestBudget: 50 });

    expect(page.items).toEqual([]);
    expect(page.exhausted).toBe(true);
    expect(page.rawTotal).toBe(30);
  });

  it("stops at its request budget with the scan still open", async () => {
    const fetchRaw = backend(1000, () => false);

    const page = await collectVisiblePage(fetchRaw, { pageSize: 10, requestBudget: 3 });

    expect(fetchRaw).toHaveBeenCalledTimes(3);
    expect(page.budgetSpent).toBe(true);
    expect(page.exhausted).toBe(false);
    expect(page.nextOffset).toBe(30);
  });

  it("resumes where the previous page stopped", async () => {
    const fetchRaw = backend(60, (index) => index % 3 === 0);

    const first = await collectVisiblePage(fetchRaw, { pageSize: 4, requestBudget: 50 });
    const second = await collectVisiblePage(fetchRaw, {
      pageSize: 4,
      requestBudget: 50,
      startOffset: first.nextOffset,
    });

    expect(first.items).toEqual(["row-0", "row-3", "row-6", "row-9"]);
    expect(second.items[0]).toBe("row-12");
  });
});

describe("pagerTotal", () => {
  it("leaves one more page reachable while the scan is open", () => {
    expect(pagerTotal({ hasMore: true, loaded: 10, page: 2, pageSize: 10 })).toBe(30);
  });

  it("keeps the next page clickable after a page that came back empty", () => {
    // A spent request budget looks like this: nothing visible yet, more raw rows behind.
    const total = pagerTotal({ hasMore: true, loaded: 0, page: 1, pageSize: 10 });

    expect(total).toBeGreaterThan(10);
    expect(Math.ceil(total / 10)).toBeGreaterThan(1);
  });

  it("settles on what was actually seen once the list ends", () => {
    expect(pagerTotal({ hasMore: false, loaded: 3, page: 2, pageSize: 10 })).toBe(13);
  });
});
