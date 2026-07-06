/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogListQuery } from "@/shared/catalog/types";

/** 数据目录/索引任务等需要 physical + logical catalog 的场景 */
export function catalogListAllQuery(
  overrides: Partial<CatalogListQuery> = {},
): CatalogListQuery {
  return { keyword: "", page: 1, pageSize: 200, type: "all", ...overrides };
}

/** 扫描/连接管理等仅需物理连接的场景 */
export function catalogListPhysicalQuery(
  overrides: Partial<CatalogListQuery> = {},
): CatalogListQuery {
  return { keyword: "", page: 1, pageSize: 200, type: "physical", ...overrides };
}
