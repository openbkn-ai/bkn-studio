import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { dataCatalogRouteContribution } from "@/modules/data-catalog/routes";
import { dataConnectRouteContribution } from "@/modules/data-connect/routes";
import { executionFactoryLabRouteContribution } from "@/modules/execution-factory-lab/routes";
import { executionFactoryRouteContribution } from "@/modules/execution-factory/routes";
import { knowledgeNetworkLabRouteContribution } from "@/modules/knowledge-network-lab/routes";
import { knowledgeNetworkRouteContribution } from "@/modules/knowledge-network/routes";
import { modelResourcesRouteContribution } from "@/modules/model-resources/routes";
import { systemAdminRouteContribution } from "@/modules/system-admin/routes";

const routeContributions: AppRouteContribution[] = [
  knowledgeNetworkRouteContribution,
  dataCatalogRouteContribution,
  dataConnectRouteContribution,
  executionFactoryRouteContribution,
  modelResourcesRouteContribution,
  executionFactoryLabRouteContribution,
  knowledgeNetworkLabRouteContribution,
  systemAdminRouteContribution,
];

export const defaultModuleRoutePath =
  routeContributions.find((contribution) => contribution.defaultEntryPath)
    ?.defaultEntryPath ?? "/knowledge-network";

export const moduleRoutes: RouteObject[] = routeContributions.flatMap(
  (contribution) => contribution.routes,
);

export const standaloneModuleRoutes: RouteObject[] = routeContributions.flatMap(
  (contribution) => contribution.standaloneRoutes ?? [],
);
