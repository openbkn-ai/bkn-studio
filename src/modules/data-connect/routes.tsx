/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";

const DataConnectListPage = lazy(async () => {
  const module = await import("@/modules/data-connect/pages/DataConnectListPage");
  return { default: module.DataConnectListPage };
});

const DataConnectFormPage = lazy(async () => {
  const module = await import("@/modules/data-connect/pages/DataConnectFormPage");
  return { default: module.DataConnectFormPage };
});

const DataConnectDiscoverPage = lazy(async () => {
  const module = await import("@/modules/data-connect/pages/DataConnectDiscoverPage");
  return { default: module.DataConnectDiscoverPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const dataConnectRoutes: RouteObject[] = [
  {
    path: "data-connect",
    handle: {
      console: {
        descriptionKey: "dataConnect.description",
        menuKey: "data-connection",
        titleKey: "dataConnect.title",
      },
    },
    element: withRouteLoading(<DataConnectListPage />),
  },
  {
    path: "data-connect/new",
    handle: {
      console: {
        descriptionKey: "dataConnect.createDescription",
        menuKey: "data-connection",
        titleKey: "dataConnect.createTitle",
      },
    },
    element: withRouteLoading(<DataConnectFormPage mode="create" />),
  },
  {
    path: "data-connect/:recordId/edit",
    handle: {
      console: {
        descriptionKey: "dataConnect.editDescription",
        menuKey: "data-connection",
        titleKey: "dataConnect.editTitle",
      },
    },
    element: withRouteLoading(<DataConnectFormPage mode="edit" />),
  },
  {
    path: "data-connect/discover",
    handle: {
      console: {
        descriptionKey: "dataConnect.discoverDescription",
        menuKey: "data-connection",
        titleKey: "dataConnect.discoverTitle",
      },
    },
    element: withRouteLoading(<DataConnectDiscoverPage />),
  },
];

export const dataConnectRouteContribution: AppRouteContribution = {
  moduleId: "data-connect",
  routes: dataConnectRoutes,
};
