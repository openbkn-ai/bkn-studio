/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

export type ResourceQueryBlockReason =
  | "disabled"
  | "metadata_unavailable"
  | "missing"
  | "stale";

export function resourceQueryBlockReason(
  resource: CatalogResource,
  fieldCount: number | null = resource.schema.length,
): ResourceQueryBlockReason | null {
  if (resource.status === "disabled") {
    return "disabled";
  }
  if (resource.status === "stale") {
    return "stale";
  }
  if (resource.lastDiscoverStatus === "missing") {
    return "missing";
  }
  if (fieldCount === 0) {
    return "metadata_unavailable";
  }
  return null;
}
