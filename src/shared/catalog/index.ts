/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type {
  CatalogListQuery,
  CatalogListResult,
  CatalogRecord,
} from "@/shared/catalog/catalog.service";

export {
  catalogListAllQuery,
  catalogListPhysicalQuery,
  createLogicalCatalog,
  deleteCatalog,
  getCatalog,
  listCatalogs,
} from "@/shared/catalog/catalog.service";
