import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";

const StarterListPage = lazy(async () => {
  const module = await import("@/modules/starter/pages/StarterListPage");
  return { default: module.StarterListPage };
});

const StarterFormPage = lazy(async () => {
  const module = await import("@/modules/starter/pages/StarterFormPage");
  return { default: module.StarterFormPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const starterRoutes: RouteObject[] = [
  {
    path: "starter",
    element: withRouteLoading(<StarterListPage />),
  },
  {
    path: "starter/new",
    element: withRouteLoading(<StarterFormPage mode="create" />),
  },
  {
    path: "starter/:recordId/edit",
    element: withRouteLoading(<StarterFormPage mode="edit" />),
  },
];
