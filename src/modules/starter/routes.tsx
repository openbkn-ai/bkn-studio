import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
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
    handle: {
      console: {
        descriptionKey: "starter.description",
        menuKey: "domain-knowledge-network",
        titleKey: "starter.title",
      },
    },
    element: withRouteLoading(<StarterListPage />),
  },
  {
    path: "starter/new",
    handle: {
      console: {
        descriptionKey: "starter.createDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "starter.createTitle",
      },
    },
    element: withRouteLoading(<StarterFormPage mode="create" />),
  },
  {
    path: "starter/:recordId/edit",
    handle: {
      console: {
        descriptionKey: "starter.editDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "starter.editTitle",
      },
    },
    element: withRouteLoading(<StarterFormPage mode="edit" />),
  },
];

export const starterRouteContribution: AppRouteContribution = {
  defaultEntryPath: "/starter",
  moduleId: "starter",
  routes: starterRoutes,
};
