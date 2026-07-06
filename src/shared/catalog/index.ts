/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type {
  CatalogHealthStatus,
  CatalogListQuery,
  CatalogListResult,
  CatalogRecord,
  CatalogRecordStatus,
} from "@/shared/catalog/types";

export { catalogListAllQuery, catalogListPhysicalQuery } from "@/shared/catalog/catalog-queries";

export {
  appendMockPhysicalCatalog,
  createLogicalCatalog,
  createPhysicalCatalog,
  deleteCatalog,
  getCatalog,
  listCatalogs,
  setCatalogEnabled,
  testCatalogConnection,
  updateCatalog,
  updateMockCatalogRecord,
} from "@/shared/catalog/catalog.service";

export {
  catalogBlastRadius,
  resourceBlastRadius,
  type CatalogBlastRadius,
} from "@/shared/catalog/blast-radius";

export { inferConnectorCategory } from "@/shared/catalog/catalog-mapper";

export {
  postCatalogDiscover,
  type CatalogDiscoverStrategy,
} from "@/shared/catalog/catalog-discover";
