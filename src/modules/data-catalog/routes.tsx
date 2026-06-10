import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";

const DataCatalogPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/DataCatalogPage");
  return { default: module.DataCatalogPage };
});

const IndexBuildPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/IndexBuildPage");
  return { default: module.IndexBuildPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
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
    element: withRouteLoading(<DataCatalogPage />),
  },
  {
    path: "data-catalog/catalog/:catalogId",
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
    path: "data-catalog/resource/:resourceId",
    handle: {
      console: {
        descriptionKey: "dataCatalog.description",
        menuKey: "data-catalog",
        titleKey: "dataCatalog.resourceDetailTitle",
      },
    },
    element: withRouteLoading(<DataCatalogPage selectionType="resource" />),
  },
  {
    path: "index-builds",
    handle: {
      console: {
        descriptionKey: "dataCatalog.indexBuildDescription",
        menuKey: "index-build",
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
