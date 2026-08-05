/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import type { Edition } from "@/framework/entitlement/edition";
import type { PermissionCheckMode } from "@/framework/permission/has-permissions";

export type ConsoleNavItem = {
  children?: ConsoleNavItem[];
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  labelKey: string;
  /**
   * 档位不够但可通过换证解锁时由 filterNavByEdition 打上,菜单据此渲染锁标记。
   * 声明时不要手写——它是过滤的产物,不是配置项。
   */
  locked?: boolean;
  /**
   * 该入口所属能力的最低档位。不设 = 社区能力,人人可见。
   *
   * 判定只看档位,不看证里的 `features[]`(bkn-docs `shared/licensing` 决策 4/5)。
   * 这张表是产品自带的:产品知道自己哪些页面是付费的,不从 license-server 拉。
   */
  minEdition?: Edition;
  path?: string;
  /** 渲染该项所需权限(任一/全部由 permissionMode 决定)。不设则人人可见。 */
  permission?: string | string[];
  permissionMode?: PermissionCheckMode;
};

export type ConsoleNavContribution = {
  items: ConsoleNavItem[];
  parentKey?: string;
};
