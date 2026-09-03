/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { baseConsoleNavigation } from "@/app/shell/navigation/base-navigation";
import type {
  ConsoleNavContribution,
  ConsoleNavItem,
} from "@/app/shell/navigation/types";
import { capabilityState } from "@/framework/entitlement/capability-state";
import type { EntitlementView } from "@/framework/entitlement/types";
import { isSuperAdmin } from "@/framework/auth/super-admin";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { bknTraceNavigation } from "@/modules/bkn-trace/navigation";
import { capabilityMinEdition } from "@/modules/subscription/capability-catalog";
import { dataCatalogNavigation } from "@/modules/data-catalog/navigation";
import { dataConnectNavigation } from "@/modules/data-connect/navigation";
import { executionFactoryLabNavigation } from "@/modules/execution-factory-lab/navigation";
import { executionFactoryNavigation } from "@/modules/execution-factory/navigation";
import { homeNavigation } from "@/modules/home/navigation";
import { knowledgeNetworkNavigation } from "@/modules/knowledge-network/navigation";
import { modelResourcesNavigation } from "@/modules/model-resources/navigation";

const navigationContributions: ConsoleNavContribution[] = [
  homeNavigation,
  knowledgeNetworkNavigation,
  dataConnectNavigation,
  dataCatalogNavigation,
  executionFactoryNavigation,
  modelResourcesNavigation,
  bknTraceNavigation,
  executionFactoryLabNavigation,
];

export type { ConsoleNavItem } from "@/app/shell/navigation/types";

export const consoleNavigation: ConsoleNavItem[] = buildConsoleNavigation(
  baseConsoleNavigation,
  navigationContributions,
);

export function filterConsoleNavigation(
  items: ConsoleNavItem[],
  options?: {
    hideLegacyExecutionFactory?: boolean;
    hideCatalog?: boolean;
    hideMarketCatalog?: boolean;
  },
): ConsoleNavItem[] {
  return items
    .filter((item) => !(options?.hideLegacyExecutionFactory && item.key === "execution-factory"))
    .map((item) => {
      if (!item.children?.length) {
        return item;
      }

      const children = item.children.filter(
        (child) =>
          !(options?.hideCatalog && child.key === "execution-factory-lab-catalog") &&
          !(options?.hideMarketCatalog && child.key === "all-execution-units"),
      );

      return {
        ...item,
        children,
      };
    });
}

/**
 * Filter navigation by capability state derived on the server from capabilities and extensions.
 *
 * - Available items remain visible.
 * - Installed but unlicensed items remain visible and locked so users can see an upgrade path.
 * - Uninstalled items are hidden because their implementation is absent from the binary.
 *
 * A missing snapshot is distinct from an uninstalled capability. Return unchanged navigation in
 * that case so RequireCapability can explain the unknown entitlement state.
 *
 * Keep this separate from user permission filtering. Permission filtering runs first so an
 * unauthorized item never advertises an upgrade path.
 */
export function filterNavByCapability(
  items: ConsoleNavItem[],
  snapshot: EntitlementView | null,
): ConsoleNavItem[] {
  if (!snapshot) {
    return items;
  }

  const visible: ConsoleNavItem[] = [];

  for (const item of items) {
    const state = item.capability ? capabilityState(item.capability, snapshot) : "available";

    if (state === "not-installed" || state === "unknown") {
      continue;
    }

    const locked = state === "not-licensed";
    const lockedEdition = locked && item.capability ? capabilityMinEdition(item.capability) : null;

    if (item.children?.length) {
      const children = filterNavByCapability(item.children, snapshot);

      if (children.length === 0 && !item.path) {
        continue;
      }

      visible.push({ ...item, children, locked, ...(lockedEdition ? { lockedEdition } : {}) });
    } else {
      visible.push(
        locked ? { ...item, locked, ...(lockedEdition ? { lockedEdition } : {}) } : item,
      );
    }
  }

  return visible;
}

// Filter navigation by the current user's permissions. Hide an unauthorized item and hide a
// group when all children are filtered and the group itself is not navigable.
export function filterNavByPermission(
  items: ConsoleNavItem[],
  permissions: string[],
  roles: string[] = [],
): ConsoleNavItem[] {
  const visible: ConsoleNavItem[] = [];
  for (const item of items) {
    if (item.requiresBusinessPermission && !permissions.some(isBusinessPermission)) {
      continue;
    }
    if (item.requiresSuperAdmin && !isSuperAdmin(roles)) {
      continue;
    }
    if (
      item.permission &&
      !hasPermissions({
        currentPermissions: permissions,
        mode: item.permissionMode ?? "any",
        requiredPermissions: item.permission,
      })
    ) {
      continue;
    }
    if (item.children?.length) {
      const children = filterNavByPermission(item.children, permissions, roles);
      if (children.length === 0 && !item.path) {
        continue;
      }
      visible.push({ ...item, children });
    } else {
      visible.push(item);
    }
  }
  return visible;
}

function isBusinessPermission(permission: string) {
  return !permission.startsWith("admin-");
}

type ConsoleNavTrailItem = {
  key: string;
  labelKey: string;
  path?: string;
};

function flattenItems(items: ConsoleNavItem[]): ConsoleNavItem[] {
  return items.flatMap((item) =>
    item.children ? [item, ...flattenItems(item.children)] : [item],
  );
}

const consoleNavItems = flattenItems(consoleNavigation);

function buildConsoleNavigation(
  baseItems: ConsoleNavItem[],
  contributions: ConsoleNavContribution[],
) {
  const topLevelItems: ConsoleNavItem[] = [];
  const anchoredItems = new Map<string, ConsoleNavItem[]>();
  const groupedItems = new Map<string, ConsoleNavItem[]>();

  for (const contribution of contributions) {
    if (contribution.parentKey) {
      groupedItems.set(contribution.parentKey, [
        ...(groupedItems.get(contribution.parentKey) ?? []),
        ...contribution.items,
      ]);
      continue;
    }

    if (contribution.afterKey) {
      anchoredItems.set(contribution.afterKey, [
        ...(anchoredItems.get(contribution.afterKey) ?? []),
        ...contribution.items,
      ]);
      continue;
    }

    topLevelItems.push(...contribution.items);
  }

  return [
    ...topLevelItems,
    ...baseItems.flatMap((item) => {
      const extraChildren = groupedItems.get(item.key) ?? [];

      const baseItem = extraChildren.length === 0
        ? item
        : { ...item, children: [...extraChildren, ...(item.children ?? [])] };

      return [baseItem, ...(anchoredItems.get(item.key) ?? [])];
    }),
  ];
}

export function findConsoleNavItemByPath(pathname: string) {
  return consoleNavItems
    .filter((item) => item.path && pathname.startsWith(item.path))
    .sort((left, right) => (right.path?.length ?? 0) - (left.path?.length ?? 0))[0];
}

export function getConsoleNavTrail(menuKey?: string): ConsoleNavTrailItem[] {
  if (!menuKey) {
    return [];
  }

  for (const item of consoleNavigation) {
    if (item.key === menuKey) {
      return [{ key: item.key, labelKey: item.labelKey, path: item.path }];
    }

    const matchedChild = item.children?.find((child) => child.key === menuKey);

    if (matchedChild) {
      return [
        { key: item.key, labelKey: item.labelKey, path: item.path },
        {
          key: matchedChild.key,
          labelKey: matchedChild.labelKey,
          path: matchedChild.path,
        },
      ];
    }
  }

  return [];
}
