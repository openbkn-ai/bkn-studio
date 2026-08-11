/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";
import type { AppRouteContribution } from "@/app/router/types";

const HomePage = lazy(async () => {
  const module = await import("@/modules/home/pages/HomePage");
  return { default: module.HomePage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const homeRoutes: RouteObject[] = [
  {
    path: "home",
    handle: {
      console: {
        descriptionKey: "home.description",
        menuKey: "home",
        titleKey: "home.title",
      },
    },
    element: withRouteLoading(<HomePage />),
  },
];

/**
 * Workbench uses a real path rather than an index route. create-router continues to redirect the
 * root, and homepage rollback only changes defaultEntryPath without modifying the application-shell route table.
 */
export const homeRouteContribution: AppRouteContribution = {
  defaultEntryPath: "/home",
  moduleId: "home",
  routes: homeRoutes,
};
