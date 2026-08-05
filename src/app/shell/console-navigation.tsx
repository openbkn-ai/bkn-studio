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
import { atLeast } from "@/framework/entitlement/edition";
import { isCommunityBuild, type Entitlement } from "@/framework/entitlement/types";
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
 * 按集群授权档位过滤导航。档位不够时分两种下场,判据是 `extensions[]`:
 *
 * - **社区镜像**(插座一个都没填)→ 隐藏。付费实现物理不在这个二进制里,画一个
 *   点开只能看到升级引导的入口是噪音;而且社区升商业要换镜像,不是换证书能解决的。
 * - **企业镜像、档位不够** → 保留并标记 `locked`。换一张证就能用,这个入口正是
 *   升级引导该出现的地方。
 *
 * 这里没有强制力,强制力在服务端每个受控调用点。菜单只是别让用户点进必然被拒的页。
 */
export function filterNavByEdition(
  items: ConsoleNavItem[],
  snapshot: Entitlement | null,
): ConsoleNavItem[] {
  // 快照没到:按档位门控的入口一律先不显示,也不画锁——此刻分不清这是社区镜像还是
  // 企业镜像,而对着社区客户画一个换证书解不开的锁是更糟的那种错。
  const communityBuild = !snapshot || isCommunityBuild(snapshot);
  const visible: ConsoleNavItem[] = [];

  for (const item of items) {
    const gated = item.minEdition && (!snapshot || !atLeast(snapshot.edition, item.minEdition));

    if (gated && communityBuild) {
      continue;
    }

    const locked = Boolean(gated);

    if (item.children?.length) {
      const children = filterNavByEdition(item.children, snapshot);

      // 子项全被档位挡掉且父项本身不可点 → 整组隐藏,不留一个空壳分组。
      if (children.length === 0 && !item.path) {
        continue;
      }

      visible.push({ ...item, children, locked });
    } else {
      visible.push(locked ? { ...item, locked } : item);
    }
  }

  return visible;
}

/**
 * 按能力过滤导航:能力不可用 → 隐藏;子项全被过滤且本身不可点 → 整组隐藏。
 *
 * 判据是 isCapabilityAvailable,所以「未知」(快照还没到 / 拉失败)一律隐藏。首屏那一瞬
 * 付费入口不在,拿到快照后出现;反过来先显示再撤掉才是更糟的闪动。
 *
 * 与 filterNavByEdition 并存,分工是:登记过 capability key 的入口走这里(后端算好的
 * 结果),还没登记的付费面退到档位判定。两个函数刻意分开,合成一个迟早有人把两种 key
 * 混着传。
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
