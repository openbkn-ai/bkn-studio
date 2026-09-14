/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogRecord } from "@/shared/catalog";

const BUILTIN_TAG_SET = new Set(["builtin", "built-in", "internal", "system"]);

/** Identify built-in logical catalogs only by explicit system markers to avoid affecting user-created items. */
export function isBuiltinLogicalCatalog(catalog: CatalogRecord) {
  if (catalog.internal) {
    return true;
  }

  if (catalog.type !== "logical") {
    return false;
  }

  const metadata = catalog.metadata ?? {};
  if (
    metadata.builtin === true ||
    metadata.built_in === true ||
    metadata.system === true
  ) {
    return true;
  }

  if (catalog.tags.some((tag) => BUILTIN_TAG_SET.has(tag.trim().toLowerCase()))) {
    return true;
  }

  // Known platform namespaces, matched by exact name or prefix.
  const name = catalog.name.trim().toLowerCase();
  if (
    name === "adp_bkn_catalog" ||
    name.startsWith("adp_bkn_") ||
    name.startsWith("openbkn_")
  ) {
    return true;
  }

  return false;
}
