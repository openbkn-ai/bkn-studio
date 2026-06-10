import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";

const ModelListPage = lazy(async () => {
  const module = await import("@/modules/model-resources/pages/ModelListPage");
  return { default: module.ModelListPage };
});

const QuotaListPage = lazy(async () => {
  const module = await import("@/modules/model-resources/pages/QuotaListPage");
  return { default: module.QuotaListPage };
});

const DefaultModelPage = lazy(async () => {
  const module = await import("@/modules/model-resources/pages/DefaultModelPage");
  return { default: module.DefaultModelPage };
});

const ModelStatisticsPage = lazy(async () => {
  const module = await import("@/modules/model-resources/pages/ModelStatisticsPage");
  return { default: module.ModelStatisticsPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const modelResourcesRoutes: RouteObject[] = [
  {
    path: "model-resources/models",
    handle: {
      console: {
        descriptionKey: "modelResources.models.description",
        menuKey: "model-resource-management",
        titleKey: "modelResources.models.title",
      },
    },
    element: withRouteLoading(<ModelListPage />),
  },
  {
    path: "model-resources/quotas",
    handle: {
      console: {
        descriptionKey: "modelResources.quotas.description",
        menuKey: "quota-management",
        titleKey: "modelResources.quotas.title",
      },
    },
    element: withRouteLoading(<QuotaListPage />),
  },
  {
    path: "model-resources/default-model",
    handle: {
      console: {
        descriptionKey: "modelResources.defaultModel.description",
        menuKey: "default-model",
        titleKey: "modelResources.defaultModel.title",
      },
    },
    element: withRouteLoading(<DefaultModelPage />),
  },
  {
    path: "model-resources/statistics",
    handle: {
      console: {
        descriptionKey: "modelResources.statistics.description",
        menuKey: "model-statistics",
        titleKey: "modelResources.statistics.title",
      },
    },
    element: withRouteLoading(<ModelStatisticsPage />),
  },
];

export const modelResourcesRouteContribution: AppRouteContribution = {
  moduleId: "model-resources",
  routes: modelResourcesRoutes,
};
