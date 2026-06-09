import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { KnowledgeNetworkListPage } from "@/modules/knowledge-network/routes/lazy-pages";
import { createKnowledgeNetworkRoute } from "@/modules/knowledge-network/routes/route-factory";
import { knowledgeNetworkStandaloneRoutes } from "@/modules/knowledge-network/routes/standalone-routes";

export const knowledgeNetworkRoutes: RouteObject[] = [
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
  defaultEntryPath: "/knowledge-network",
  moduleId: "knowledge-network",
  routes: knowledgeNetworkRoutes,
  standaloneRoutes: knowledgeNetworkStandaloneRoutes,
};
