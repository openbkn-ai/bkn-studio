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

const ApiKeyListPage = lazy(async () => {
  const module = await import("@/modules/api-keys/pages/ApiKeyListPage");
  return { default: module.ApiKeyListPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const apiKeysRoutes: RouteObject[] = [
  {
    path: "api-keys",
    handle: {
      console: {
        descriptionKey: "apiKeys.description",
        menuKey: "api-keys",
        titleKey: "apiKeys.title",
      },
    },
    element: withRouteLoading(<ApiKeyListPage />),
  },
];

export const apiKeysRouteContribution: AppRouteContribution = {
  moduleId: "api-keys",
  routes: apiKeysRoutes,
};
