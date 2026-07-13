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
import { RouteLoading } from "@/app/router/RouteLoading";

const DataCatalogPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/DataCatalogPage");
  return { default: module.DataCatalogPage };
});

const ResourceWorkspacePage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/ResourceWorkspacePage");
  return { default: module.ResourceWorkspacePage };
});

const IndexBuildPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/IndexBuildPage");
  return { default: module.IndexBuildPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

function LegacyDataCatalogRootRedirect() {
  return <Navigate replace to="/data-directory" />;
}

function LegacyDataCatalogCatalogRedirect() {
  const { catalogId } = useParams();
  return <Navigate replace to={`/data-directory/catalog/${catalogId ?? ""}`} />;
}

function LegacyDataCatalogResourceRedirect() {
  const { resourceId } = useParams();
  const location = useLocation();
  return (
    <Navigate
      replace
      to={`/data-directory/resource/${resourceId ?? ""}${location.search}`}
    />
  );
}

export const dataCatalogRoutes: RouteObject[] = [
  {
    path: "data-directory",
    handle: {
      console: {
        descriptionKey: "dataCatalog.description",
        menuKey: "data-catalog",
        titleKey: "dataCatalog.title",
      },
    },
    element: withRouteLoading(<DataCatalogPage />),
  },
  {
    path: "data-directory/catalog/:catalogId",
    handle: {
      console: {
        descriptionKey: "dataCatalog.description",
        menuKey: "data-catalog",
        titleKey: "dataCatalog.catalogDetailTitle",
      },
    },
    element: withRouteLoading(<DataCatalogPage selectionType="catalog" />),
  },
  {
    path: "data-directory/resource/:resourceId",
    handle: {
      console: {
        descriptionKey: "dataCatalog.description",
        menuKey: "data-catalog",
        titleKey: "dataCatalog.resourceDetailTitle",
      },
    },
    element: withRouteLoading(<ResourceWorkspacePage />),
  },
  {
    path: "data-catalog",
    element: <LegacyDataCatalogRootRedirect />,
  },
  {
    path: "data-catalog/catalog/:catalogId",
    element: <LegacyDataCatalogCatalogRedirect />,
  },
  {
    path: "data-catalog/resource/:resourceId",
    element: <LegacyDataCatalogResourceRedirect />,
  },
  {
    path: "index-builds",
    handle: {
      console: {
        descriptionKey: "dataCatalog.indexBuildDescription",
        menuKey: "index-builds",
        titleKey: "dataCatalog.indexBuildTitle",
      },
    },
    element: withRouteLoading(<IndexBuildPage />),
  },
];

export const dataCatalogRouteContribution: AppRouteContribution = {
  moduleId: "data-catalog",
  routes: dataCatalogRoutes,
};
