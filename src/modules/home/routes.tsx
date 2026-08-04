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
 * 工作台走真实路径而不是 index 路由:根路径继续由 create-router 统一重定向,
 * 首页回滚只需要把 defaultEntryPath 改回模块路径,不必动应用壳层路由表。
 */
export const homeRouteContribution: AppRouteContribution = {
  defaultEntryPath: "/home",
  moduleId: "home",
  routes: homeRoutes,
};
