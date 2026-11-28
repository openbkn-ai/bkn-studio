/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { ProjectListPreview } from "@/app/router/ProjectListPreview";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { isExtensionInstalled } from "@/framework/extension/registry";
import { RequirePermission } from "@/framework/permission/RequirePermission";
import { RouteLoading } from "@/app/router/RouteLoading";
import { catalogDetailPermissions, dataCatalogResourceManagePermission } from "./permissions";

const DataCatalogPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/DataCatalogPage");
  return { default: module.DataCatalogPage };
});

const ResourceWorkspacePage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/ResourceWorkspacePage");
  return { default: module.ResourceWorkspacePage };
});

const ApiResourcePage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/ApiResourcePage");
  return { default: module.ApiResourcePage };
});

const ViewEditorPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/ViewEditorPage");
  return { default: module.ViewEditorPage };
});

const TaskManagementPage = lazy(async () => {
  const module = await import("@/modules/data-catalog/pages/TaskManagementPage");
  return { default: module.TaskManagementPage };
});

const dataCatalogConsole = {
  descriptionKey: "dataCatalog.description",
  menuKey: "data-catalog",
  titleKey: "dataCatalog.title",
};

function withRouteLoading(permissions: string | string[], element: ReactNode) {
  return (
    <RequirePermission mode="any" permissions={permissions}>
      <Suspense fallback={<RouteLoading />}>{element}</Suspense>
    </RequirePermission>
  );
}

function withPublicRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const dataCatalogRoutes: RouteObject[] = [
  {
    path: "data-catalog/catalog/:catalogId/api/new",
    handle: { console: dataCatalogConsole },
    element: withRouteLoading(dataCatalogResourceManagePermission, <ApiResourcePage />),
  },
  {
    path: "data-catalog/api-resource/:resourceId/edit",
    handle: { console: dataCatalogConsole },
    element: withRouteLoading(catalogDetailPermissions, <ApiResourcePage edit />),
  },
  {
    path: "data-catalog/api-resource/:resourceId",
    handle: { console: dataCatalogConsole },
    element: withRouteLoading(catalogDetailPermissions, <ApiResourcePage />),
  },
  {
    path: "data-catalog",
    handle: {
      console: dataCatalogConsole,
    },
    element: withPublicRouteLoading(<DataCatalogPage />),
    children: [
      {
        element: <></>,
        handle: { console: dataCatalogConsole },
        index: true,
      },
      {
        element: <></>,
        path: "catalog/:catalogId",
        handle: {
          console: {
            descriptionKey: "dataCatalog.description",
            menuKey: "data-catalog",
            titleKey: "dataCatalog.catalogDetailTitle",
          },
        },
      },
    ],
  },
  {
    path: "data-catalog/catalog/:catalogId/views/new",
    handle: { console: dataCatalogConsole },
    element: withRouteLoading("catalog:resource_manage", <ViewEditorPage />),
  },
  {
    path: "data-catalog/resource/:resourceId/edit",
    handle: { console: dataCatalogConsole },
    element: withRouteLoading("catalog:resource_manage", <ViewEditorPage />),
  },
  {
    path: "data-catalog/resource/:resourceId",
    handle: {
      console: {
        descriptionKey: "dataCatalog.description",
        menuKey: "data-catalog",
        titleKey: "dataCatalog.resourceDetailTitle",
      },
    },
    element: withRouteLoading(
      ["catalog:view_detail", "resource:view_detail"],
      <ResourceWorkspacePage />,
    ),
  },
  {
    path: "task-management",
    handle: {
      console: {
        descriptionKey: "dataCatalog.indexBuildDescription",
        menuKey: "task-management",
        titleKey: "dataCatalog.indexBuildTitle",
      },
    },
    element: withPublicRouteLoading(<TaskManagementPage />),
  },
];

export const dataCatalogRouteContribution: AppRouteContribution = {
  moduleId: "data-catalog",
  routes: dataCatalogRoutes,
};

/**
 * The knowledge base ships in the enterprise image. Without it every knowledge-base path, the list
 * and a deep link alike, shows the preview under the same upgrade card as project management
 * (bkn-project-license-routes). Resolve after extension registration so the real page is never
 * shadowed.
 */
export function knowledgeBaseLicenseRoutes(): RouteObject[] {
  return isExtensionInstalled(CAPABILITIES.KNOWLEDGE_BASE)
    ? []
    : [
        {
          path: "knowledge-base/*",
          handle: { console: { menuKey: "knowledge-base", titleKey: "shell.items.knowledgeBase" } },
          element: (
            <RequireEdition capability={CAPABILITIES.KNOWLEDGE_BASE} minEdition="professional">
              <ProjectListPreview titleKey="shell.items.knowledgeBase" />
            </RequireEdition>
          ),
        },
      ];
}
