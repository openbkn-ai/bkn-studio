import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { dataConnectRouteContribution } from "@/modules/data-connect/routes";
import { executionFactoryLabRouteContribution } from "@/modules/execution-factory-lab/routes";
import { executionFactoryRouteContribution } from "@/modules/execution-factory/routes";
import { knowledgeNetworkRouteContribution } from "@/modules/knowledge-network/routes";
import { modelResourcesRouteContribution } from "@/modules/model-resources/routes";

const routeContributions: AppRouteContribution[] = [
  knowledgeNetworkRouteContribution,
  dataConnectRouteContribution,
  executionFactoryRouteContribution,
  modelResourcesRouteContribution,
  executionFactoryLabRouteContribution,
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
