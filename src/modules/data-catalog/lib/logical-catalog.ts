/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogRecord } from "@/shared/catalog";

const BUILTIN_TAG_SET = new Set(["builtin", "built-in", "internal", "system"]);

/** 仅依据明确的系统标识判断内置逻辑 catalog，避免误伤用户新建项。 */
export function isBuiltinLogicalCatalog(catalog: CatalogRecord) {
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

  // 平台已知内置命名空间（名称精确/前缀匹配）
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
