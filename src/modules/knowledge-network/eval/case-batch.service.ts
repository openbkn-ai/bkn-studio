/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License. See LICENSE for the full text.
 */

import axios from "axios";
import { removeEvalCase, setEvalCaseEnabled } from "./m0-run.service";

export type CaseBatchAction = "enable" | "delete";
export type CaseBatchResult = {
  id: string;
  title: string;
  success: boolean;
  error?: string;
};

function failureKey(cause: unknown): string {
  if (axios.isAxiosError(cause)) {
    switch (cause.response?.status) {
      case 400:
        return "incomplete";
      case 401:
        return "login";
      case 403:
        return "forbidden";
      case 404:
        return "notFound";
      case 409:
        return "conflict";
      case 429:
        return "busy";
    }
  }
  return "unavailable";
}

// Reuse the ordinary endpoints so every item retains server-side permission,
// definition and concurrency checks. Bound requests instead of flooding the API.
export async function applyEvalCaseBatch(
  networkId: string,
  entries: { id: string; title: string; enabled?: boolean }[],
  action: CaseBatchAction,
): Promise<CaseBatchResult[]> {
  const items = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  const results = new Array<CaseBatchResult>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        const item = items[index];
        try {
          if (action === "delete") {
            await removeEvalCase(networkId, item.id, "delete");
          } else {
            await setEvalCaseEnabled(networkId, item.id, true);
          }
          results[index] = { ...item, success: true };
        } catch (cause) {
          results[index] = { ...item, success: false, error: failureKey(cause) };
        }
      }
    }),
  );
  return results;
}
