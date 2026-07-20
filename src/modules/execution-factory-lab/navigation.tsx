/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AppstoreOutlined, CloudServerOutlined, ExperimentOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";

// 各项均声明所需权限：无权限的用户不该在侧边栏看到点进去只有一张空页的入口。
// 沙箱运行时限超管，与后端 #339 的门禁同口径。
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
      permission: executionFactoryLabPermissions.sandboxRuntimeView,
    },
  ],
};
