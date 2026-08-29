/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  BranchesOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  SettingOutlined,
} from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";

export const bknTraceNavigation: ConsoleNavContribution = {
  afterKey: "model-resources",
  items: [
    {
      key: "observability",
      labelKey: "shell.items.observability",
      icon: <BranchesOutlined />,
      requiresBusinessPermission: true,
      children: [
        {
          key: "business-provenance",
          labelKey: "shell.items.businessProvenance",
          // 只标不挡:业务溯源由 bkn-trace 实现,不在 bkn-safe 的装配表里,
          // /api/safe/v1/capabilities 永远不报这个 key(ee-design.md §6「A 答不了 B」)。
          // 拿它做 capability 门控会让这一项永久隐藏。
          paidCapability: CAPABILITIES.BUSINESS_PROVENANCE,
          paidEdition: "enterprise",
          icon: <FileSearchOutlined />,
          path: "/observability/business-provenance",
        },
        {
          key: "trace-analysis",
          labelKey: "shell.items.traceAnalysis",
          icon: <BranchesOutlined />,
          path: "/observability/traces",
        },
        {
          key: "observability-logs",
          labelKey: "shell.items.observabilityLogs",
          icon: <FileTextOutlined />,
          path: "/observability/logs",
        },
        {
          key: "observability-settings",
          labelKey: "shell.items.observabilitySettings",
          icon: <SettingOutlined />,
          path: "/observability/settings",
        },
      ],
    },
  ],
};
