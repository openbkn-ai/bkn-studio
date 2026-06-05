import type { RouteObject } from "react-router-dom";

export type AppRouteContribution = {
  defaultEntryPath?: string;
  moduleId: string;
  routes: RouteObject[];
};
