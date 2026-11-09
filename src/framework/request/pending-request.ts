/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";

/** Shares concurrent reads only; settled results are never cached. */
export function createPendingRequest<T>() {
  const pending = new Map<string, Promise<T>>();
  let scope = "";

  return (key: string, read: () => Promise<T>): Promise<T> => {
    const config = getRuntimeConfig();
    // Keep credentials private and prevent reuse across sessions or locales.
    const nextScope = JSON.stringify([
      config.apiBaseUrl,
      config.locale,
      config.auth.tokenManager.getAccessToken(),
    ]);
    if (scope !== nextScope) {
      pending.clear();
      scope = nextScope;
    }
    const existing = pending.get(key);
    if (existing) return existing;

    const request = Promise.resolve()
      .then(read)
      .finally(() => {
        if (pending.get(key) === request) pending.delete(key);
      });
    pending.set(key, request);
    return request;
  };
}
