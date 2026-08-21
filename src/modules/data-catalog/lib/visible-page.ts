/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Paging over a list the backend filters *after* fetching the page.
 *
 * Vega decides task visibility on the catalog each task belongs to, and applies that filter to the
 * page it just read rather than inside the query (openbkn-ai/bkn-foundry#977). Two consequences,
 * neither of which reports itself:
 *
 *   - `total` counts rows the caller may not see. An account with no catalog grant is answered
 *     `total = 300` with an empty first page.
 *   - A page can come back short, or empty, while later pages still hold visible rows. Stopping on
 *     an empty page loses every row behind it.
 *
 * So the cursor advances by the *requested* limit, not by the rows that survived the filter, and
 * paging ends only when the raw space is exhausted. Queries naming a `resource_id` or `catalog_id`
 * are judged before the query runs and come back exact, but they go through this path too — it
 * costs one request either way.
 */

export type RawPage<T> = { items: T[]; total: number };

export type VisiblePage<T> = {
  /** Rows the caller may see, at most `pageSize` of them. */
  items: T[];
  /** Raw offset the next page starts from. */
  nextOffset: number;
  /** The raw space ran out: there is no page after this one. */
  exhausted: boolean;
  /** Unfiltered row count the backend reported. Not the number of visible rows. */
  rawTotal: number;
  /** The scan stopped at its request budget with rows still unread. */
  budgetSpent: boolean;
};

/**
 * How many requests one page may cost. A page of 10 over 300 invisible rows would otherwise issue
 * 30 requests before returning nothing; the budget stops at a fraction of that and reports back,
 * so the caller can still offer "next page" instead of claiming the list ended.
 */
export const VISIBLE_PAGE_REQUEST_BUDGET = 8;

export async function collectVisiblePage<T>(
  fetchRaw: (offset: number, limit: number) => Promise<RawPage<T>>,
  options: { pageSize: number; startOffset?: number; requestBudget?: number },
): Promise<VisiblePage<T>> {
  const { pageSize } = options;
  const budget = options.requestBudget ?? VISIBLE_PAGE_REQUEST_BUDGET;
  let offset = options.startOffset ?? 0;
  const items: T[] = [];
  let rawTotal = 0;
  let exhausted = false;
  let requests = 0;

  while (items.length < pageSize) {
    if (requests >= budget) {
      return { budgetSpent: true, exhausted: false, items, nextOffset: offset, rawTotal };
    }
    const limit = pageSize - items.length;
    const raw = await fetchRaw(offset, limit);
    requests += 1;
    rawTotal = raw.total;
    items.push(...raw.items.slice(0, limit));
    offset += limit;

    if (offset >= raw.total) {
      exhausted = true;
      break;
    }
  }

  return { budgetSpent: false, exhausted, items, nextOffset: offset, rawTotal };
}

/**
 * A total for the pager. The real one is unknowable without reading every page, so this reports
 * what has been seen and leaves one more page reachable while the scan has not ended.
 */
export function pagerTotal(options: {
  page: number;
  pageSize: number;
  loaded: number;
  hasMore: boolean;
}): number {
  const before = (options.page - 1) * options.pageSize;
  return before + options.loaded + (options.hasMore ? options.pageSize : 0);
}
