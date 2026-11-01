/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ProjectOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const bknProjectNavigation: ConsoleNavContribution = {
  items: [
    {
      key: "bkn-project",
      labelKey: "shell.items.bknProject",
      icon: <ProjectOutlined />,
      path: "/bkn-project",
      // Project management is still taking shape.
      stage: "beta",
    },
  ],
};
