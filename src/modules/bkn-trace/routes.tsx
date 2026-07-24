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

const BknTraceExplorerPage = lazy(async () => {
  const module = await import("@/modules/bkn-trace/pages/BknTraceExplorerPage");
  return { default: module.BknTraceExplorerPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const bknTraceRoutes: RouteObject[] = [
  {
    path: "bkn-trace",
    handle: {
      console: {
        descriptionKey: "bknTrace.description",
        menuKey: "bkn-trace",
        titleKey: "bknTrace.title",
      },
    },
    element: withRouteLoading(<BknTraceExplorerPage />),
  },
];

export const bknTraceRouteContribution: AppRouteContribution = {
  moduleId: "bkn-trace",
  routes: bknTraceRoutes,
};
