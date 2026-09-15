/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

/** Grants that allow a user to enter a tab to view existing resources or create a new one. */
export const executionFactoryAccessPermissionsByTab: Record<
  ExecutionUnitTab,
  readonly string[]
> = {
  operator: ["execution-factory:operator:view", "execution-factory:operator:create"],
  toolbox: ["execution-factory:toolbox:view", "execution-factory:toolbox:create"],
  mcp: ["execution-factory:mcp:view", "execution-factory:mcp:create"],
  skill: ["execution-factory:skill:view", "execution-factory:skill:create"],
};

export const executionFactoryAccessPermissions = Object.values(
  executionFactoryAccessPermissionsByTab,
).flat();

/** Keep tabs available when the user can either list that resource type or create one. */
export function filterAccessibleExecutionUnitTabs(
  tabs: ExecutionUnitTab[],
  currentPermissions: readonly string[],
): ExecutionUnitTab[] {
  return tabs.filter((tab) =>
    executionFactoryAccessPermissionsByTab[tab].some((permission) =>
      currentPermissions.includes(permission),
    ),
  );
}

/**
 * The execution-unit entry remains visible to every signed-in user, but its list scene must not
 * mount without at least one readable resource type. Otherwise the scene has no resolvable tab
 * and would fall through to the Skill API with an undefined active tab.
 */
export function canAccessExecutionUnitManagement(
  currentPermissions: readonly string[],
): boolean {
  return executionFactoryAccessPermissions.some((permission) =>
    currentPermissions.includes(permission),
  );
}
