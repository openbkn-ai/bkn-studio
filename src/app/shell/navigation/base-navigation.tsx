/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  ClusterOutlined,
  ExperimentOutlined,
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
    key: "execution-factory-lab",
    labelKey: "shell.items.executionFactoryLab",
    icon: <ExperimentOutlined />,
  },
  {
    key: "general-business-knowledge-network",
    labelKey: "shell.items.generalBusinessKnowledgeNetwork",
    icon: <AppstoreOutlined />,
    children: [
      {
        key: "data-quality",
        labelKey: "shell.items.dataQuality",
        icon: <SafetyCertificateOutlined />,
        disabled: true,
      },
    ],
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
        key: "log-management",
        labelKey: "shell.items.logManagement",
        path: "/system/audit",
        icon: <FileTextOutlined />,
        permission: systemAdminPermissions.audit,
      },
    ],
  },
];
