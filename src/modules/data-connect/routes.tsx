/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";

const DataConnectFormPage = lazy(async () => {
  const module = await import("@/modules/data-connect/pages/DataConnectFormPage");
  return { default: module.DataConnectFormPage };
});

const DataConnectScanPage = lazy(async () => {
  const module = await import("@/modules/data-connect/pages/DataConnectScanPage");
  return { default: module.DataConnectScanPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const dataConnectRoutes: RouteObject[] = [
  {
    // 旧入口:数据连接列表已并入「数据目录」树形页
    path: "data-connect",
    element: <Navigate replace to="/data-catalog" />,
  },
  {
    path: "data-connect/new",
    handle: {
      console: {
        descriptionKey: "dataConnect.createDescription",
        menuKey: "data-catalog",
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
        menuKey: "data-catalog",
        titleKey: "dataConnect.editTitle",
      },
    },
    element: withRouteLoading(<DataConnectFormPage mode="edit" />),
  },
  {
    path: "data-connect/scans",
    handle: {
      console: {
        descriptionKey: "dataConnect.scanDescription",
        menuKey: "data-catalog",
        titleKey: "dataConnect.scanTitle",
      },
    },
    element: withRouteLoading(<DataConnectScanPage />),
  },
];

export const dataConnectRouteContribution: AppRouteContribution = {
  moduleId: "data-connect",
  routes: dataConnectRoutes,
};
