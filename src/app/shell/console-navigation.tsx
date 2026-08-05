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
import { isCapabilityAvailable } from "@/framework/entitlement/capability-state";
import type { Entitlement } from "@/framework/entitlement/types";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { bknTraceNavigation } from "@/modules/bkn-trace/navigation";
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
  executionFactoryLabNavigation,
  bknTraceNavigation,
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
 * 按能力过滤导航:能力不可用 → 隐藏;子项全被过滤且本身不可点 → 整组隐藏。
 *
 * 判据是 isCapabilityAvailable,所以「未知」(快照还没到 / 拉失败)一律隐藏。首屏那一瞬
 * 付费入口不在,拿到快照后出现;反过来先显示再撤掉才是更糟的闪动。
 *
 * **这是前端唯一的档位相关判据。** `capabilities[]` 已经是服务端用 `AtLeast(MinEdition)`
 * 从装配表算好的结果,前端不再自己比档位(ee-design.md §3.2「不让客户端自己推」)。
 * 与 filterNavByPermission 刻意分开:一个集群态、一个用户态,合成一个函数迟早有人把两种
 * 字符串混着传。
 */
export function filterNavByCapability(
  items: ConsoleNavItem[],
  snapshot: Entitlement | null,
): ConsoleNavItem[] {
  const visible: ConsoleNavItem[] = [];

  for (const item of items) {
    if (item.capability && !isCapabilityAvailable(item.capability, snapshot)) {
      continue;
    }

    if (item.children?.length) {
      const children = filterNavByCapability(item.children, snapshot);

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

// 按当前用户权限过滤导航:自身权限不满足 → 隐藏;子项全被过滤且本身不可点 → 整组隐藏。
export function filterNavByPermission(
  items: ConsoleNavItem[],
  permissions: string[],
): ConsoleNavItem[] {
  const visible: ConsoleNavItem[] = [];
  for (const item of items) {
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
      const children = filterNavByPermission(item.children, permissions);
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
  const topLevelItems = contributions.flatMap((contribution) =>
    contribution.parentKey ? [] : contribution.items,
  );
  const groupedItems = new Map<string, ConsoleNavItem[]>();

  for (const contribution of contributions) {
    if (!contribution.parentKey) {
      continue;
    }

    groupedItems.set(contribution.parentKey, [
      ...(groupedItems.get(contribution.parentKey) ?? []),
      ...contribution.items,
    ]);
  }

  return [
    ...topLevelItems,
    ...baseItems.map((item) => {
      const extraChildren = groupedItems.get(item.key) ?? [];

      if (extraChildren.length === 0) {
        return item;
      }

      return {
        ...item,
        children: [...extraChildren, ...(item.children ?? [])],
      };
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
