/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RequirePermission } from "@/framework/permission/RequirePermission";
import { RouteLoading } from "@/app/router/RouteLoading";

const ModelListPage = lazy(async () => {
  const module = await import("@/modules/model-resources/pages/ModelListPage");
  return { default: module.ModelListPage };
});

const QuotaListPage = lazy(async () => {
  const module = await import("@/modules/model-resources/pages/QuotaListPage");
  return { default: module.QuotaListPage };
});

const ModelStatisticsPage = lazy(async () => {
  const module = await import("@/modules/model-resources/pages/ModelStatisticsPage");
  return { default: module.ModelStatisticsPage };
});

function withRouteLoading(permissions: string | string[], element: ReactNode) {
  return (
    <RequirePermission mode="any" permissions={permissions}>
      <Suspense fallback={<RouteLoading />}>{element}</Suspense>
    </RequirePermission>
  );
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
    element: withRouteLoading(
      ["model-resources:large-model:view", "model-resources:small-model:view"],
      <ModelListPage />,
    ),
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
    element: withRouteLoading(
      [
        "model-resources:large-model:view",
        "model-resources:small-model:view",
        "model-resources:quota:view",
        "model-resources:quota:edit",
      ],
      <QuotaListPage />,
    ),
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
    element: withRouteLoading(
      "model-resources:statistics:view",
      <ModelStatisticsPage />,
    ),
  },
];

export const modelResourcesRouteContribution: AppRouteContribution = {
  moduleId: "model-resources",
  routes: modelResourcesRoutes,
};
