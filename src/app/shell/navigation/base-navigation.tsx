/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  ClusterOutlined,
  CrownOutlined,
  ExperimentOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";

export const baseConsoleNavigation: ConsoleNavItem[] = [
  {
    key: "execution-factory",
    labelKey: "shell.items.executionFactory",
    icon: <ClusterOutlined />,
  },
  {
    key: "general-business-knowledge-network",
    labelKey: "shell.items.generalBusinessKnowledgeNetwork",
    icon: <AppstoreOutlined />,
  },
  {
    key: "model-resources",
    labelKey: "shell.items.modelResources",
    icon: <ExperimentOutlined />,
  },
  {
    key: "system-management",
    labelKey: "shell.items.systemManagement",
    icon: <SettingOutlined />,
    children: [
      {
        key: "user-management",
        labelKey: "shell.items.userManagement",
        icon: <TeamOutlined />,
        path: "/system/users",
        permission: systemAdminPermissions.users,
      },
      {
        key: "role-management",
        labelKey: "shell.items.roleManagement",
        icon: <SafetyCertificateOutlined />,
        path: "/system/roles",
        permission: systemAdminPermissions.roles,
      },
      {
        key: "authorization-management",
        labelKey: "shell.items.authorizationManagement",
        icon: <KeyOutlined />,
        path: "/system/authorizations",
        permission: systemAdminPermissions.authorizations,
      },
      {
        key: "license-management",
        labelKey: "shell.items.licenseManagement",
        icon: <FileProtectOutlined />,
        path: "/system/license",
        permission: systemAdminPermissions.license,
      },
      {
        key: "log-management",
        labelKey: "shell.items.logManagement",
        path: "/system/audit",
        icon: <FileTextOutlined />,
        permission: systemAdminPermissions.audit,
      },
      {
        // 页面本身对所有登录用户开放(顶栏档位芯片、锁定入口的升级引导都指向它),菜单
        // 条目却要授权管理权限:把一个人人可见的条目塞进「系统管理」,会让这个分组对每个
        // 普通用户显形,而它今天的含义是「你管得着系统」。
        key: "subscription",
        labelKey: "shell.items.subscription",
        path: "/system/subscription",
        icon: <CrownOutlined />,
        permission: systemAdminPermissions.license,
        permissionMode: "any",
      },
    ],
  },
];
