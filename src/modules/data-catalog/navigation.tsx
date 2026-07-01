/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, ThunderboltOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const dataCatalogNavigation: ConsoleNavContribution = {
  parentKey: "general-business-knowledge-network",
  items: [
    {
      key: "data-catalog",
      labelKey: "shell.items.dataCatalog",
      icon: <DatabaseOutlined />,
      path: "/data-catalog",
    },
    {
      key: "index-build",
      labelKey: "shell.items.indexBuild",
      icon: <ThunderboltOutlined />,
      path: "/index-builds",
    },
  ],
};
