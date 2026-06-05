import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { defaultModuleRoutePath, moduleRoutes } from "@/app/router/module-routes";
import { NotFoundPage } from "@/app/router/NotFoundPage";
import { RouteErrorPage } from "@/app/router/RouteErrorPage";
import { RouteLoading } from "@/app/router/RouteLoading";

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
            element: <Navigate replace to={defaultModuleRoutePath} />,
          },
          ...moduleRoutes,
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
