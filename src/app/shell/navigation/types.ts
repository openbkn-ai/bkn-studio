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
  /**
   * 渲染该项所需的付费能力(后端装配表里的 key)。不设则不受档位影响(社区能力,绝大
   * 多数如此)。
   *
   * 与 permission 正交:permission 问「这个人能不能」,capability 问「这套部署买没买」。
   * 两者都不满足时都是隐藏,但原因不同——档位不够时集群里**谁都**看不到。
   *
   * 只用于整项由付费能力提供的入口。像角色管理这种「列表社区版就有、只有写操作收费」
   * 的,菜单要照常显示,收费的是页面里的按钮(用 CapabilityGate)。菜单藏了用户连看都
   * 看不到,那是把社区能力也一并收了。
   *
   * 与 minEdition 二选一:有 key 就用 key(后端算好的),没登记才退到档位。
   */
  capability?: string;
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
