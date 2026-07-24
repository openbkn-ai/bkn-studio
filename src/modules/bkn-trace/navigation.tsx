/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { BranchesOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const bknTraceNavigation: ConsoleNavContribution = {
  parentKey: "system-management",
  items: [
    {
      key: "bkn-trace",
      labelKey: "shell.items.traceai",
      icon: <BranchesOutlined />,
      path: "/bkn-trace",
      permission: ["bkn-trace:view"],
    },
  ],
};
