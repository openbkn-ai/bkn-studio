/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const dataCatalogNavigation: ConsoleNavContribution = {
  parentKey: "general-business-knowledge-network",
  items: [
    {
      key: "data-catalog",
      labelKey: "shell.items.dataResource",
      icon: <DatabaseOutlined />,
      path: "/data-directory",
    },
  ],
};
