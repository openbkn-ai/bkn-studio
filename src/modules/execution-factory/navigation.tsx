/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  CloudServerOutlined,
  ToolOutlined,
} from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

// 各项均声明所需权限：无权限的用户不该在侧边栏看到点进去只有一张空页的入口。
// 执行单元管理页同时承载算子与工具箱，任一可见即放行。
// 沙箱运行时限超管，与后端 #339 的门禁同口径。
export const executionFactoryNavigation: ConsoleNavContribution = {
  parentKey: "execution-factory",
  items: [
    {
      key: "execution-unit-management",
      labelKey: "shell.items.executionUnitManagement",
      icon: <ToolOutlined />,
      path: "/execution-factory/units",
      permission: ["execution-factory:operator:view", "execution-factory:toolbox:view"],
      permissionMode: "any",
    },
    {
      key: "all-execution-units",
      labelKey: "shell.items.allExecutionUnits",
      icon: <AppstoreOutlined />,
      path: "/execution-factory/catalog",
      permission: "execution-factory:catalog:view",
    },
    {
      key: "execution-factory-sandbox-runtime",
      labelKey: "shell.items.executionFactorySandboxRuntime",
      icon: <CloudServerOutlined />,
      path: "/execution-factory/sandbox-runtime",
      permission: "execution-factory-lab:sandbox-runtime:view",
    },
  ],
};
