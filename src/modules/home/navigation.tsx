/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { HomeOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const homeNavigation: ConsoleNavContribution = {
  items: [
    {
      key: "home",
      labelKey: "shell.items.home",
      icon: <HomeOutlined />,
      path: "/home",
    },
  ],
};
