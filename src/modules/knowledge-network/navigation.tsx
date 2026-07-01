/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeploymentUnitOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const knowledgeNetworkNavigation: ConsoleNavContribution = {
  items: [
    {
      key: "domain-knowledge-network",
      labelKey: "shell.items.domainKnowledgeNetwork",
      icon: <DeploymentUnitOutlined />,
      path: "/knowledge-network",
    },
  ],
};
