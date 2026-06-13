import { baseConsoleNavigation } from "@/app/shell/navigation/base-navigation";
import type {
  ConsoleNavContribution,
  ConsoleNavItem,
} from "@/app/shell/navigation/types";
import { dataCatalogNavigation } from "@/modules/data-catalog/navigation";
import { executionFactoryLabNavigation } from "@/modules/execution-factory-lab/navigation";
import { executionFactoryNavigation } from "@/modules/execution-factory/navigation";
import { knowledgeNetworkNavigation } from "@/modules/knowledge-network/navigation";
import { modelResourcesNavigation } from "@/modules/model-resources/navigation";

const navigationContributions: ConsoleNavContribution[] = [
  knowledgeNetworkNavigation,
  dataCatalogNavigation,
  executionFactoryNavigation,
  modelResourcesNavigation,
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
  },
): ConsoleNavItem[] {
  return items
    .filter((item) => !(options?.hideLegacyExecutionFactory && item.key === "execution-factory"))
    .map((item) => {
      if (!item.children?.length) {
        return item;
      }

      const children = item.children.filter(
        (child) => !(options?.hideCatalog && child.key === "execution-factory-lab-catalog"),
      );

      return {
        ...item,
        children,
      };
    });
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
