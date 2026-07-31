/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";
import type { AppRouteContribution } from "@/app/router/types";

const AccountPage = lazy(async () => {
  const module = await import("@/modules/account/pages/AccountPage");
  return { default: module.AccountPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const accountRoutes: RouteObject[] = [
  {
    path: "account",
    element: <Navigate replace to="/account/profile" />,
  },
  {
    path: "account/profile",
    handle: {
      console: {
        descriptionKey: "account.description",
        menuKey: "account",
        titleKey: "account.title",
      },
    },
    element: withRouteLoading(<AccountPage section="profile" />),
  },
  {
    path: "account/security",
    handle: {
      console: {
        descriptionKey: "account.description",
        menuKey: "account",
        titleKey: "account.title",
      },
    },
    element: withRouteLoading(<AccountPage section="security" />),
  },
  {
    path: "account/api-keys",
    handle: {
      console: {
        descriptionKey: "account.description",
        menuKey: "account",
        titleKey: "account.title",
      },
    },
    element: withRouteLoading(<AccountPage section="api-keys" />),
  },
];

export const accountRouteContribution: AppRouteContribution = {
  moduleId: "account",
  routes: accountRoutes,
};
