/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogListQuery } from "@/shared/catalog/types";

/** Views such as data catalogs and index tasks that need physical and logical catalogs. */
export function catalogListAllQuery(
  overrides: Partial<CatalogListQuery> = {},
): CatalogListQuery {
  return { keyword: "", page: 1, pageSize: 200, type: "all", ...overrides };
}

/** Views such as discovery and connection management that need only physical connections. */
export function catalogListPhysicalQuery(
  overrides: Partial<CatalogListQuery> = {},
): CatalogListQuery {
  return { keyword: "", page: 1, pageSize: 200, type: "physical", ...overrides };
}
