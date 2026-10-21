/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Queries run on the OpenCypher page, newest first, kept in this browser per network. The editor
 * steps through them with Ctrl/⌘ + ↑ / ↓, like Neo4j Browser.
 */

export const MAX_HISTORY = 50;

function storageKey(knId: string): string {
  return `bkn-studio.cypher-history.${knId}`;
}

export function loadHistory(knId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(knId)) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_HISTORY)
      : [];
  } catch {
    return [];
  }
}

/** Puts a query first, without repeating it further down. */
export function rememberQuery(history: readonly string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [...history];
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, MAX_HISTORY);
}

export function saveHistory(knId: string, history: readonly string[]): void {
  try {
    localStorage.setItem(storageKey(knId), JSON.stringify(history));
  } catch {
    /* Private mode or exhausted quota: history lasts for this visit. */
  }
}

/**
 * The next position when stepping through history: -1 is the draft being typed, 0 the newest
 * query. `older` moves back in time.
 */
export function stepHistory(position: number, length: number, older: boolean): number {
  if (length === 0) return -1;
  return older ? Math.min(position + 1, length - 1) : Math.max(position - 1, -1);
}
