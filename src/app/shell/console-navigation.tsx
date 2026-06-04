import type { ReactNode } from "react";

import {
  ApiOutlined,
  AppstoreOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";

export type ConsoleNavItem = {
  children?: ConsoleNavItem[];
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  labelKey: string;
  path?: string;
};

export const consoleNavigation: ConsoleNavItem[] = [
  {
    key: "domain-knowledge-network",
    labelKey: "shell.items.domainKnowledgeNetwork",
    icon: <DeploymentUnitOutlined />,
    path: "/starter",
  },
  {
    key: "general-business-knowledge-network",
    labelKey: "shell.items.generalBusinessKnowledgeNetwork",
    icon: <AppstoreOutlined />,
    children: [
      {
        key: "data-connection",
        labelKey: "shell.items.dataConnection",
        icon: <ApiOutlined />,
        path: "/data-connect",
      },
      {
        key: "data-resource",
        labelKey: "shell.items.dataResource",
        icon: <DatabaseOutlined />,
        disabled: true,
      },
      {
        key: "data-quality",
        labelKey: "shell.items.dataQuality",
        icon: <SafetyCertificateOutlined />,
        disabled: true,
      },
      {
        key: "dataflow",
        labelKey: "shell.items.dataflow",
        icon: <ClusterOutlined />,
        disabled: true,
      },
    ],
  },
  {
    key: "system-config",
    labelKey: "shell.items.systemConfig",
    icon: <SettingOutlined />,
    children: [
      {
        key: "user-management",
        labelKey: "shell.items.userManagement",
        icon: <TeamOutlined />,
        disabled: true,
      },
      {
        key: "role-management",
        labelKey: "shell.items.roleManagement",
        icon: <SafetyCertificateOutlined />,
        disabled: true,
      },
      {
        key: "log-management",
        labelKey: "shell.items.logManagement",
        icon: <FileTextOutlined />,
        disabled: true,
      },
      {
        key: "model-management",
        labelKey: "shell.items.modelManagement",
        icon: <AppstoreOutlined />,
        disabled: true,
      },
    ],
  },
];

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
