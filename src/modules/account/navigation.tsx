/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AuditOutlined, KeyOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";

import type { ConsoleNavItem } from "@/app/shell/navigation/types";

export const accountSideNavigation: ConsoleNavItem[] = [
  {
    key: "account-profile",
    labelKey: "account.sections.profile.title",
    icon: <UserOutlined />,
    path: "/account/profile",
  },
  {
    key: "account-security",
    labelKey: "account.sections.security.title",
    icon: <LockOutlined />,
    path: "/account/security",
  },
  {
    key: "account-api-keys",
    labelKey: "account.sections.apiKeys.title",
    icon: <KeyOutlined />,
    path: "/account/api-keys",
  },
  { key: "account-permission-requests", labelKey: "account.sections.permissionRequests.title", icon: <AuditOutlined />, path: "/account/permission-requests" },
];
