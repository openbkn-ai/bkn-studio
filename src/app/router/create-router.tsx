/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import {
  defaultModuleRoutePath,
  moduleRoutes,
  standaloneModuleRoutes,
} from "@/app/router/module-routes";
import { DEFAULT_APP_ENTRY_PATH } from "@/app/router/app-paths";
import { NotFoundPage } from "@/app/router/NotFoundPage";
import { RouteErrorPage } from "@/app/router/RouteErrorPage";
import { RouteLoading } from "@/app/router/RouteLoading";
import { extensionRoutes, extensionStandaloneRoutes } from "@/framework/extension/registry";

const AppShell = lazy(async () => {
  const module = await import("@/app/router/shell");
  return { default: module.AppShell };
});

export function createAppRouter(basename?: string) {
  return createBrowserRouter(
    [
      ...[...standaloneModuleRoutes, ...extensionStandaloneRoutes()].map((route) => ({
        ...route,
        errorElement: <RouteErrorPage />,
      })),
      {
        path: DEFAULT_APP_ENTRY_PATH,
        errorElement: <RouteErrorPage />,
        element: (
          <Suspense fallback={<RouteLoading />}>
            <AppShell />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: <Navigate replace to={defaultModuleRoutePath} />,
          },
          ...moduleRoutes,
          ...extensionRoutes(),
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
    { basename },
  );
}
