/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AppstoreOutlined, CloudServerOutlined, ExperimentOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import { executionFactoryViewPermissions } from "@/modules/execution-factory/permissions";

// Every item declares required permissions so unauthorized users do not see sidebar entries opening to empty pages.
// Sandbox runtime follows the same entry rule as execution-unit management.
export const executionFactoryLabNavigation: ConsoleNavContribution = {
  parentKey: "execution-factory-lab",
  items: [
    {
      key: "execution-factory-lab-capabilities",
      labelKey: "shell.items.executionFactoryLabCapabilities",
      icon: <ExperimentOutlined />,
      path: "/execution-factory-lab/capabilities",
      permission: executionFactoryLabPermissions.capabilityView,
    },
    {
      key: "execution-factory-lab-catalog",
      labelKey: "shell.items.executionFactoryLabCatalog",
      icon: <AppstoreOutlined />,
      path: "/execution-factory-lab/catalog",
      permission: executionFactoryLabPermissions.catalogView,
    },
    {
      key: "execution-factory-lab-sandbox-runtime",
      labelKey: "shell.items.executionFactoryLabSandboxRuntime",
      icon: <CloudServerOutlined />,
      path: "/execution-factory-lab/sandbox-runtime",
      permission: executionFactoryViewPermissions,
      permissionMode: "any",
    },
  ],
};
