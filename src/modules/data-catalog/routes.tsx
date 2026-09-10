/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, useLocation, useParams, type RouteObject } from "react-router-dom";

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

function withRouteLoading(permissions: string | string[], element: ReactNode) {
  return (
    <RequirePermission mode="any" permissions={permissions}>
      <Suspense fallback={<RouteLoading />}>{element}</Suspense>
    </RequirePermission>
  );
}

function withPublicRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

function LegacyDataCatalogRootRedirect() {
  return <Navigate replace to="/data-catalog" />;
}

function LegacyDataCatalogCatalogRedirect() {
  const { catalogId } = useParams();
  return <Navigate replace to={`/data-catalog/catalog/${catalogId ?? ""}`} />;
}

function LegacyDataCatalogResourceRedirect() {
  const { resourceId } = useParams();
  const location = useLocation();
  return (
    <Navigate
      replace
      to={`/data-catalog/resource/${resourceId ?? ""}${location.search}`}
    />
  );
}

function LegacyTaskManagementRedirect() {
  const location = useLocation();
  return <Navigate replace to={`/task-management${location.search}`} />;
}

export const dataCatalogRoutes: RouteObject[] = [
  {
    path: "data-catalog",
    handle: {
      console: {
        descriptionKey: "dataCatalog.description",
        menuKey: "data-catalog",
        titleKey: "dataCatalog.title",
      },
    },
    element: withPublicRouteLoading(<DataCatalogPage />),
    children: [
      { element: <></>, index: true },
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
    path: "data-directory",
    element: <LegacyDataCatalogRootRedirect />,
  },
  {
    path: "data-directory/catalog/:catalogId",
    element: <LegacyDataCatalogCatalogRedirect />,
  },
  {
    path: "data-directory/resource/:resourceId",
    element: <LegacyDataCatalogResourceRedirect />,
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
    element: withPublicRouteLoading(<TaskManagementPage />),
  },
  {
    path: "index-builds",
    element: <LegacyTaskManagementRedirect />,
  },
];

export const dataCatalogRouteContribution: AppRouteContribution = {
  moduleId: "data-catalog",
  routes: dataCatalogRoutes,
};
