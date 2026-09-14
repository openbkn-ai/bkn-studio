/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogRecord } from "@/shared/catalog/types";

/**
 * Whether the current account holds one bkn-safe operation on THIS catalog.
 *
 * Vega answers the per-object question the global permission set cannot: `catalog:*` in
 * /me/permissions says nothing about which catalog, while `operations` on the record is the
 * effective set for this instance — the object grant a creator receives included. Screens that gate
 * on an object action must ask here, not at the permission points.
 *
 * `*` is honored because the super administrator's policy is a wildcard on both object and action.
 */
export function hasCatalogOperation(
  catalog: Pick<CatalogRecord, "operations"> | null | undefined,
  operation: string,
) {
  if (!catalog) {
    return false;
  }
  return catalog.operations?.includes("*") || catalog.operations?.includes(operation) || false;
}
