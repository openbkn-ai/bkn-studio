/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

export type CatalogDiscoverStrategy = "cleanup_only" | "create_only" | "full_sync";

type CatalogDiscoverOptions = {
  strategy?: CatalogDiscoverStrategy;
  wait?: boolean;
};

/** Triggers catalog discovery consistently. data-catalog and data-connect share the same HTTP contract. */
export async function postCatalogDiscover(
  catalogId: string,
  options: CatalogDiscoverOptions = {},
): Promise<{ id: string } | void> {
  const { strategy, wait = false } = options;
  const response = await http.post<{ id: string }>(
    `/vega-backend/v1/catalogs/${catalogId}/discover`,
    strategy ? { strategy } : undefined,
    { params: { wait } },
  );
  return response.data;
}
