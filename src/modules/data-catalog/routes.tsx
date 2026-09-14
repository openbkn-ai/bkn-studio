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

const DataCatalogPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/DataCatalogPage");
  return { default: module.DataCatalogPage };
});

const ResourceWorkspacePage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/ResourceWorkspacePage");
  return { default: module.ResourceWorkspacePage };
});

const TaskManagementPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/TaskManagementPage");
  return { default: module.TaskManagementPage };
});

const dataCatalogConsole = {
  descriptionKey: "dataCatalog.description",
  menuKey: "data-catalog",
  titleKey: "dataCatalog.title",
};

function withRouteLoading(permissions: string | string[], element: ReactNode) {
  return (
    <RequirePermission mode="any" permissions={permissions}>
      <Suspense fallback={<RouteLoading />}>{element}</Suspense>
    </RequirePermission>
  );
}

export const dataCatalogRoutes: RouteObject[] = [
  {
    path: "data-catalog",
    handle: {
      console: dataCatalogConsole,
    },
    element: withRouteLoading(["catalog:view_detail", "resource:view_detail"], <DataCatalogPage />),
    children: [
      {
        element: <></>,
        handle: { console: dataCatalogConsole },
        index: true,
      },
      {
        element: <></>,
        path: "catalog/:catalogId",
        handle: {
          console: {
            descriptionKey: "dataCatalog.description",
            menuKey: "data-catalog",
            titleKey: "dataCatalog.catalogDetailTitle",
          },
        },
      },
    ],
  },
  {
    path: "data-catalog/resource/:resourceId",
    handle: {
      console: {
        descriptionKey: "dataCatalog.description",
        menuKey: "data-catalog",
        titleKey: "dataCatalog.resourceDetailTitle",
      },
    },
    element: withRouteLoading(["catalog:view_detail", "resource:view_detail"], <ResourceWorkspacePage />),
  },
  {
    path: "task-management",
    handle: {
      console: {
        descriptionKey: "dataCatalog.indexBuildDescription",
        menuKey: "task-management",
        titleKey: "dataCatalog.indexBuildTitle",
      },
    },
    element: withRouteLoading("catalog:task_manage", <TaskManagementPage />),
  },
];

export const dataCatalogRouteContribution: AppRouteContribution = {
  moduleId: "data-catalog",
  routes: dataCatalogRoutes,
};
