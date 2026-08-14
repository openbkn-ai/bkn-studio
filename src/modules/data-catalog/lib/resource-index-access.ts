/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

export function isResourceIndexReadOnly(catalog: CatalogRecord | null) {
  return Boolean(catalog?.internal);
}

export function canManageResourceBuildTasks(
  resource: CatalogResource,
  catalog: CatalogRecord | null,
) {
  return resource.category !== "dataset" && !isResourceIndexReadOnly(catalog);
}

export function canViewResourceIndexTasks(resource: CatalogResource) {
  return resource.category !== "dataset";
}
