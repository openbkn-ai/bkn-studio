import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { NotFoundPage } from "@/app/router/NotFoundPage";
import { RouteErrorPage } from "@/app/router/RouteErrorPage";
import { RouteLoading } from "@/app/router/RouteLoading";
import { dataConnectRoutes } from "@/modules/data-connect/routes";
import { starterRoutes } from "@/modules/starter/routes";

const AppShell = lazy(async () => {
  const module = await import("@/app/router/shell");
  return { default: module.AppShell };
});

export function createAppRouter(basename?: string) {
  return createBrowserRouter(
    [
      {
        path: "/",
        errorElement: <RouteErrorPage />,
        element: (
          <Suspense fallback={<RouteLoading />}>
            <AppShell />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: <Navigate replace to="/starter" />,
          },
          ...dataConnectRoutes,
          ...starterRoutes,
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
