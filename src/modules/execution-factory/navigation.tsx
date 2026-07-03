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

export const executionFactoryNavigation: ConsoleNavContribution = {
  parentKey: "execution-factory",
  items: [
    {
      key: "execution-unit-management",
      labelKey: "shell.items.executionUnitManagement",
      icon: <ToolOutlined />,
      path: "/execution-factory/units",
    },
    {
      key: "all-execution-units",
      labelKey: "shell.items.allExecutionUnits",
      icon: <AppstoreOutlined />,
      path: "/execution-factory/catalog",
    },
    {
      key: "execution-factory-sandbox-runtime",
      labelKey: "shell.items.executionFactorySandboxRuntime",
      icon: <CloudServerOutlined />,
      path: "/execution-factory/sandbox-runtime",
    },
  ],
};
