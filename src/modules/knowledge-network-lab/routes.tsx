import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { DomainNetworkLabDebugPage } from "@/modules/knowledge-network-lab/pages/DomainNetworkLabDebugPage";
import { DomainNetworkLabDetailPage } from "@/modules/knowledge-network-lab/pages/DomainNetworkLabDetailPage";
import { DomainNetworkLabListPage } from "@/modules/knowledge-network-lab/pages/DomainNetworkLabListPage";

const MENU_KEY = "domain-knowledge-network-lab";

export const knowledgeNetworkLabRoutes: RouteObject[] = [
  {
    path: "knowledge-network-lab",
    handle: {
      console: {
        descriptionKey: "knowledgeNetworkLab.list.subtitle",
        menuKey: MENU_KEY,
        titleKey: "knowledgeNetworkLab.list.title",
      },
    },
    element: <DomainNetworkLabListPage />,
  },
  {
    path: "knowledge-network-lab/:networkId",
    handle: {
      console: {
        descriptionKey: "knowledgeNetworkLab.detail.description",
        menuKey: MENU_KEY,
        titleKey: "knowledgeNetworkLab.detail.title",
      },
    },
    element: <DomainNetworkLabDetailPage />,
  },
  {
    path: "knowledge-network-lab/:networkId/debug",
    handle: {
      console: {
        descriptionKey: "knowledgeNetworkLab.sandbox.subtitle",
        menuKey: MENU_KEY,
        titleKey: "knowledgeNetworkLab.sandbox.title",
      },
    },
    element: <DomainNetworkLabDebugPage />,
  },
];

export const knowledgeNetworkLabRouteContribution: AppRouteContribution = {
  moduleId: "knowledge-network-lab",
  routes: knowledgeNetworkLabRoutes,
};
