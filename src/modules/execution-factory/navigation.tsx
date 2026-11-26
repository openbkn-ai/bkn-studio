/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AppstoreOutlined, CloudServerOutlined, ToolOutlined } from "@ant-design/icons";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const executionFactoryNavigation: ConsoleNavContribution = {
  parentKey: "execution-factory",
  items: [
    {
      key: "execution-unit-management",
      labelKey: "shell.items.executionUnitManagement",
      icon: <ToolOutlined />,
      paidCapability: CAPABILITIES.EXECUTION_FACTORY,
      paidEdition: "professional",
      path: "/execution-factory/units",
    },
    {
      key: "all-execution-units",
      labelKey: "shell.items.allExecutionUnits",
      icon: <AppstoreOutlined />,
      paidCapability: CAPABILITIES.EXECUTION_FACTORY,
      paidEdition: "professional",
      path: "/execution-factory/catalog",
      permission: "execution-factory:catalog:view",
    },
    {
      key: "execution-factory-sandbox-runtime",
      labelKey: "shell.items.executionFactorySandboxRuntime",
      icon: <CloudServerOutlined />,
      paidCapability: CAPABILITIES.EXECUTION_FACTORY,
      paidEdition: "professional",
      path: "/execution-factory/sandbox-runtime",
      permission: "execution-factory-lab:sandbox-runtime:view",
    },
  ],
};
