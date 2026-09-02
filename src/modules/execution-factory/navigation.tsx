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
import { executionFactoryViewPermissions } from "@/modules/execution-factory/permissions";

// Every item declares required permissions so unauthorized users do not see sidebar entries that open to empty pages.
// Execution Unit Management hosts functions, toolboxes, MCPs, and Skills, so any corresponding
// view permission allows entry.
// Sandbox runtime follows the same entry rule as execution-unit management.
export const executionFactoryNavigation: ConsoleNavContribution = {
  parentKey: "execution-factory",
  items: [
    {
      key: "execution-unit-management",
      labelKey: "shell.items.executionUnitManagement",
      icon: <ToolOutlined />,
      path: "/execution-factory/units",
      permission: executionFactoryViewPermissions,
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
      permission: executionFactoryViewPermissions,
      permissionMode: "any",
    },
  ],
};
