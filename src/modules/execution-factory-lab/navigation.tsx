/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AppstoreOutlined, ExperimentOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const executionFactoryLabNavigation: ConsoleNavContribution = {
  parentKey: "execution-factory-lab",
  items: [
    {
      key: "execution-factory-lab-capabilities",
      labelKey: "shell.items.executionFactoryLabCapabilities",
      icon: <ExperimentOutlined />,
      path: "/execution-factory-lab/capabilities",
    },
    {
      key: "execution-factory-lab-catalog",
      labelKey: "shell.items.executionFactoryLabCatalog",
      icon: <AppstoreOutlined />,
      path: "/execution-factory-lab/catalog",
    },
  ],
};
