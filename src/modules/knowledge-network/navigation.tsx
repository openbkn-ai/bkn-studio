/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, DeploymentUnitOutlined, ShareAltOutlined } from "@ant-design/icons";

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
          icon: <ShareAltOutlined />,
          path: "/knowledge-network",
          permission: [
            "knowledge-network:create",
            "knowledge-network:edit",
            "knowledge-network:delete",
            "knowledge-network:import",
            "knowledge-network:export",
            "knowledge-network:preview",
            "knowledge-network:concept-group:view",
            "knowledge-network:metric:view",
            "knowledge-network:metric:create",
            "knowledge-network:metric:edit",
            "knowledge-network:metric:delete",
            "knowledge-network:metric:query",
          ],
          permissionMode: "any",
        },
        {
          key: "domain-knowledge-network-integration",
          labelKey: "shell.items.knowledgeNetworkIntegration",
          icon: <ApiOutlined />,
          path: "/knowledge-network/integration",
          permission: [
            "knowledge-network:create",
            "knowledge-network:edit",
            "knowledge-network:delete",
            "knowledge-network:import",
            "knowledge-network:export",
            "knowledge-network:preview",
            "knowledge-network:concept-group:view",
            "knowledge-network:metric:view",
            "knowledge-network:metric:create",
            "knowledge-network:metric:edit",
            "knowledge-network:metric:delete",
            "knowledge-network:metric:query",
          ],
          permissionMode: "any",
        },
      ],
    },
  ],
};
