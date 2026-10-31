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

const ProjectWorkspacePage = lazy(async () => {
  const module = await import("@/modules/bkn-project/pages/ProjectWorkspacePage");
  return { default: module.ProjectWorkspacePage };
});

const ProjectObjectTypeEditPage = lazy(async () => {
  const module = await import("@/modules/bkn-project/pages/ProjectObjectTypeEditPage");
  return { default: module.ProjectObjectTypeEditPage };
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

const workspaceConsole = {
  descriptionKey: "bknProject.workspace.description",
  menuKey: "bkn-project",
  titleKey: "bknProject.workspace.title",
};

// A project workspace replaces the console navigation with its own, so it lives outside the shell.
export const bknProjectStandaloneRoutes: RouteObject[] = [
  {
    path: "/bkn-project/:projectId",
    handle: { console: workspaceConsole },
    element: withRouteLoading(<ProjectWorkspacePage />),
  },
  {
    path: "/bkn-project/:projectId/:section",
    handle: { console: workspaceConsole },
    element: withRouteLoading(<ProjectWorkspacePage />),
  },
  {
    path: "/bkn-project/:projectId/model/object-types/:itemId",
    handle: { console: workspaceConsole },
    element: withRouteLoading(<ProjectObjectTypeEditPage />),
  },
];

export const bknProjectRouteContribution: AppRouteContribution = {
  moduleId: "bkn-project",
  routes: bknProjectRoutes,
  standaloneRoutes: bknProjectStandaloneRoutes,
};
