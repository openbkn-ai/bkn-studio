/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OverviewData, OverviewLimits } from "./overview-loader";
import type { OverviewRelation } from "./overview-queries";

/*
 * The last overview of each network, kept in this browser. Ten thousand points and
 * their lines run to megabytes, past what localStorage holds, so it lives in IndexedDB. Every
 * failure reads as "no cache": the page then simply loads again.
 */

const DB_NAME = "bkn-studio.graph-overview";
const STORE = "snapshots";
/** Bumped whenever the loader picks points differently, so an old sample is not shown as current. */
const SAMPLER_VERSION = 6;

export type CachedOverview = { signature: string; data: OverviewData };

/**
 * What the cached result depends on: the network's types and relations, the names in effect and
 * the budgets. A different signature means the copy answers another question and is not shown.
 */
export function overviewSignature(input: {
  objectTypeIds: string[];
  relations: OverviewRelation[];
  labels: Record<string, string>;
  limits: OverviewLimits;
}): string {
  return JSON.stringify({
    v: SAMPLER_VERSION,
    ot: [...input.objectTypeIds].sort(),
    rel: input.relations.map((rel) => `${rel.id}:${rel.sourceOtId}>${rel.targetOtId}`).sort(),
    labels: Object.entries(input.labels).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    limits: [input.limits.nodes, input.limits.edges],
  });
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function isCached(value: unknown): value is CachedOverview {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  return (
    typeof record.signature === "string" &&
    typeof data === "object" &&
    data !== null &&
    Array.isArray(data.nodes) &&
    Array.isArray(data.edges)
  );
}

export async function readOverviewCache(knId: string): Promise<CachedOverview | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(knId);
      request.onsuccess = () => {
        db.close();
        resolve(isCached(request.result) ? request.result : null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function writeOverviewCache(knId: string, value: CachedOverview): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, knId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
