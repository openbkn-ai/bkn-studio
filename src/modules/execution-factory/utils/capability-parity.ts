/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

/** Tabs that share the operator-integration category taxonomy in list filters. */
export function supportsCategoryFilter(tab: ExecutionUnitTab): boolean {
  return tab === "operator" || tab === "toolbox" || tab === "mcp" || tab === "skill";
}
