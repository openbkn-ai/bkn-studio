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

const ProjectListPage = lazy(async () => {
  const module = await import("@/modules/bkn-project/pages/ProjectListPage");
  return { default: module.ProjectListPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const bknProjectRoutes: RouteObject[] = [
  {
    path: "bkn-project",
    handle: {
      console: {
        descriptionKey: "bknProject.description",
        menuKey: "bkn-project",
        titleKey: "bknProject.title",
      },
    },
    element: withRouteLoading(<ProjectListPage />),
  },
];

export const bknProjectRouteContribution: AppRouteContribution = {
  moduleId: "bkn-project",
  routes: bknProjectRoutes,
};
