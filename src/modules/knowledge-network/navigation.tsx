/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, DeploymentUnitOutlined, FolderOpenOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const knowledgeNetworkNavigation: ConsoleNavContribution = {
  items: [
    {
      key: "domain-knowledge-network",
      labelKey: "shell.items.domainKnowledgeNetwork",
      icon: <DeploymentUnitOutlined />,
      children: [
        {
          key: "domain-knowledge-network-management",
          labelKey: "shell.items.knowledgeNetworkManagement",
          icon: <FolderOpenOutlined />,
          path: "/knowledge-network",
        },
        {
          key: "domain-knowledge-network-integration",
          labelKey: "shell.items.knowledgeNetworkIntegration",
          icon: <ApiOutlined />,
          path: "/knowledge-network/integration",
        },
      ],
    },
  ],
};
