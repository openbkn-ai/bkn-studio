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

export const bknTraceNavigation: ConsoleNavContribution = {
  items: [
    {
      key: "observability",
      labelKey: "shell.items.observability",
      icon: <BranchesOutlined />,
      children: [
        {
          key: "business-provenance",
          labelKey: "shell.items.businessProvenance",
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
