/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";
import { RequirePermission } from "@/framework/permission/RequirePermission";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";
import { ObjectAuthorizationCreatePage } from "@/modules/system-admin/pages/ObjectAuthorizationCreatePage";

const UserManagementPage = lazy(async () => {
  const module = await import("@/modules/system-admin/pages/UserManagementPage");
  return { default: module.UserManagementPage };
});

const RoleManagementPage = lazy(async () => {
  const module = await import("@/modules/system-admin/pages/RoleManagementPage");
  return { default: module.RoleManagementPage };
});

const AuditLogPage = lazy(async () => {
  const module = await import("@/modules/system-admin/pages/AuditLogPage");
  return { default: module.AuditLogPage };
});

const ObjectAuthorizationPage = lazy(async () => {
  const module = await import("@/modules/system-admin/pages/ObjectAuthorizationPage");
  return { default: module.ObjectAuthorizationPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

// 路由级守卫:无权限直接渲染 403,被守卫页面不 mount(因而不触发其拉数据副作用)。
function guarded(permissions: readonly string[], element: ReactNode) {
  return (
    <RequirePermission permissions={[...permissions]}>
      {withRouteLoading(element)}
    </RequirePermission>
  );
}

export const systemAdminRoutes: RouteObject[] = [
  {
    path: "system/users",
    handle: {
      console: {
        descriptionKey: "systemAdmin.users.description",
        menuKey: "user-management",
        titleKey: "systemAdmin.users.title",
      },
    },
    element: guarded(systemAdminPermissions.users, <UserManagementPage />),
  },
  {
    path: "system/roles",
    handle: {
      console: {
        descriptionKey: "systemAdmin.roles.description",
        menuKey: "role-management",
        titleKey: "systemAdmin.roles.title",
      },
    },
    element: guarded(systemAdminPermissions.roles, <RoleManagementPage />),
  },
  {
    path: "system/authorizations",
    handle: {
      console: {
        descriptionKey: "systemAdmin.objectGrants.description",
        menuKey: "authorization-management",
        titleKey: "systemAdmin.objectGrants.title",
      },
    },
    element: guarded(systemAdminPermissions.authorizations, <ObjectAuthorizationPage />),
  },
  {
    path: "system/authorizations/new",
    handle: {
      console: {
        menuKey: "authorization-management",
        titleKey: "systemAdmin.objectGrants.createPageTitle",
      },
    },
    element: guarded(systemAdminPermissions.authorizations, <ObjectAuthorizationCreatePage />),
  },
  {
    path: "system/audit",
    handle: {
      console: {
        descriptionKey: "systemAdmin.audit.description",
        menuKey: "log-management",
        titleKey: "systemAdmin.audit.title",
      },
    },
    element: guarded(systemAdminPermissions.audit, <AuditLogPage />),
  },
];

export const systemAdminRouteContribution: AppRouteContribution = {
  moduleId: "system-admin",
  routes: systemAdminRoutes,
};
