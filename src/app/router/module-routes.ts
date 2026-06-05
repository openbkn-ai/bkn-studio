import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { dataConnectRouteContribution } from "@/modules/data-connect/routes";
import { executionFactoryRouteContribution } from "@/modules/execution-factory/routes";
import { starterRouteContribution } from "@/modules/starter/routes";

const routeContributions: AppRouteContribution[] = [
  starterRouteContribution,
  dataConnectRouteContribution,
  executionFactoryRouteContribution,
];

export const defaultModuleRoutePath =
  routeContributions.find((contribution) => contribution.defaultEntryPath)
    ?.defaultEntryPath ?? "/starter";

export const moduleRoutes: RouteObject[] = routeContributions.flatMap(
  (contribution) => contribution.routes,
);
