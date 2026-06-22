import type { ReactNode } from "react";

import type { PermissionCheckMode } from "@/framework/permission/has-permissions";

export type ConsoleNavItem = {
  children?: ConsoleNavItem[];
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  labelKey: string;
  path?: string;
  /** 渲染该项所需权限(任一/全部由 permissionMode 决定)。不设则人人可见。 */
  permission?: string | string[];
  permissionMode?: PermissionCheckMode;
};

export type ConsoleNavContribution = {
  items: ConsoleNavItem[];
  parentKey?: string;
};
