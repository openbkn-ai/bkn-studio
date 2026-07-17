/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  BarChartOutlined,
} from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const modelResourcesNavigation: ConsoleNavContribution = {
  parentKey: "model-resources",
  items: [
    {
      key: "model-resource-management",
      labelKey: "shell.items.modelManagement",
      icon: <AppstoreOutlined />,
      path: "/model-resources/models",
    },
    {
      key: "model-statistics",
      labelKey: "shell.items.modelStatistics",
      icon: <BarChartOutlined />,
      path: "/model-resources/statistics",
    },
  ],
};
