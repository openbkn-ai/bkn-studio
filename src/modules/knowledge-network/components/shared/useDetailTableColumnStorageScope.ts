/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo } from "react";

/** localStorage scope for detail-table column configuration, separated by table type. */
export function useDetailTableColumnStorageScope(tableId: string) {
  return useMemo(() => `detail-table:${tableId}`, [tableId]);
}
