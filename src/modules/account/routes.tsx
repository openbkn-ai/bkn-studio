import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

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
    handle: {
      console: {
        descriptionKey: "account.description",
        menuKey: "account",
        titleKey: "account.title",
      },
    },
    element: withRouteLoading(<AccountPage />),
  },
];

export const accountRouteContribution: AppRouteContribution = {
  moduleId: "account",
  routes: accountRoutes,
};
