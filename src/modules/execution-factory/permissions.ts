/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

/** Read grants that allow a user to enter execution-unit management. */
export const executionFactoryViewPermissions = [
  "execution-factory:operator:view",
  "execution-factory:toolbox:view",
  "execution-factory:mcp:view",
  "execution-factory:skill:view",
] as const;

export const executionFactoryViewPermissionByTab: Record<ExecutionUnitTab, string> = {
  operator: "execution-factory:operator:view",
  toolbox: "execution-factory:toolbox:view",
  mcp: "execution-factory:mcp:view",
  skill: "execution-factory:skill:view",
};

/** Keep management tabs aligned with the resource types the user can actually list. */
export function filterAccessibleExecutionUnitTabs(
  tabs: ExecutionUnitTab[],
  currentPermissions: readonly string[],
): ExecutionUnitTab[] {
  return tabs.filter((tab) => currentPermissions.includes(executionFactoryViewPermissionByTab[tab]));
}
