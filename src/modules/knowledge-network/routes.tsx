/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import {
  KnowledgeNetworkIntegrationPage,
  KnowledgeNetworkListPage,
} from "@/modules/knowledge-network/routes/lazy-pages";
import { createKnowledgeNetworkRoute } from "@/modules/knowledge-network/routes/route-factory";
import { knowledgeNetworkStandaloneRoutes } from "@/modules/knowledge-network/routes/standalone-routes";

export const knowledgeNetworkRoutes: RouteObject[] = [
  createKnowledgeNetworkRoute(
    "knowledge-network/integration",
    {
      descriptionKey: "knowledgeNetwork.integrationDescription",
      menuKey: "domain-knowledge-network-integration",
      titleKey: "knowledgeNetwork.integrationTitle",
    },
    <KnowledgeNetworkIntegrationPage />,
  ),
  createKnowledgeNetworkRoute(
    "knowledge-network",
    {
      descriptionKey: "knowledgeNetwork.description",
      titleKey: "knowledgeNetwork.title",
    },
    <KnowledgeNetworkListPage />,
  ),
];

export { knowledgeNetworkStandaloneRoutes };

export const knowledgeNetworkRouteContribution: AppRouteContribution = {
  moduleId: "knowledge-network",
  routes: knowledgeNetworkRoutes,
  standaloneRoutes: knowledgeNetworkStandaloneRoutes,
};
