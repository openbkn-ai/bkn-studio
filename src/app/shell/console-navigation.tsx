import { baseConsoleNavigation } from "@/app/shell/navigation/base-navigation";
import type {
  ConsoleNavContribution,
  ConsoleNavItem,
} from "@/app/shell/navigation/types";
import { dataConnectNavigation } from "@/modules/data-connect/navigation";
import { executionFactoryNavigation } from "@/modules/execution-factory/navigation";
import { knowledgeNetworkNavigation } from "@/modules/knowledge-network/navigation";

const navigationContributions: ConsoleNavContribution[] = [
  knowledgeNetworkNavigation,
  dataConnectNavigation,
  executionFactoryNavigation,
];

export type { ConsoleNavItem } from "@/app/shell/navigation/types";

export const consoleNavigation: ConsoleNavItem[] = buildConsoleNavigation(
  baseConsoleNavigation,
  navigationContributions,
);

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
