import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";

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
    element: withRouteLoading(<UserManagementPage />),
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
    element: withRouteLoading(<RoleManagementPage />),
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
    element: withRouteLoading(<ObjectAuthorizationPage />),
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
    element: withRouteLoading(<AuditLogPage />),
  },
];

export const systemAdminRouteContribution: AppRouteContribution = {
  moduleId: "system-admin",
  routes: systemAdminRoutes,
};
