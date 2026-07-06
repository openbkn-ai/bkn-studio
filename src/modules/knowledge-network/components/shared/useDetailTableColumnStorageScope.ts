/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo } from "react";

/** 详情表列配置 localStorage 作用域（按表格类型区分）。 */
export function useDetailTableColumnStorageScope(tableId: string) {
  return useMemo(() => `detail-table:${tableId}`, [tableId]);
}
