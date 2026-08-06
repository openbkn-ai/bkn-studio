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
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireCapability } from "@/framework/entitlement/RequireCapability";
import { RequirePermission } from "@/framework/permission/RequirePermission";
import { authzPoints, systemAdminPermissions } from "@/modules/system-admin/permissions";
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

const LicenseManagementPage = lazy(async () => {
  const module = await import("@/modules/system-admin/pages/LicenseManagementPage");
  return { default: module.LicenseManagementPage };
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

/**
 * 档位 + 权限双守卫,**能力包在权限外层**:集群没买的东西,不该因为某个管理员权限齐全
 * 就点得进去。服务端也是这个顺序——档位不够时路由伪装成不存在,authz 根本不跑
 * (ee-design.md §7.5)。
 *
 * 三种不可用各渲染各的:没装 → 404(与服务端应答同义)、装了没买 → 升级引导、
 * 快照未到 → 骨架。
 */
function gatedByCapability(
  capability: string,
  permissions: readonly string[],
  element: ReactNode,
) {
  return <RequireCapability capability={capability}>{guarded(permissions, element)}</RequireCapability>;
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
    element: gatedByCapability(
      CAPABILITIES.PERM_OBJECT_LEVEL,
      systemAdminPermissions.authorizations,
      <ObjectAuthorizationPage />,
    ),
  },
  {
    path: "system/authorizations/new",
    handle: {
      console: {
        menuKey: "authorization-management",
        titleKey: "systemAdmin.objectGrants.createPageTitle",
      },
    },
    // 新建授权页只有一件事可做:发对象授权。列表页放行只读审查者(admin-authz:view),
    // 这里不放——进来也只能看着一个被 PermissionGate 隐掉的提交按钮。
    element: gatedByCapability(
      CAPABILITIES.PERM_OBJECT_LEVEL,
      [authzPoints.grant],
      <ObjectAuthorizationCreatePage />,
    ),
  },
  {
    path: "system/license",
    handle: {
      console: {
        descriptionKey: "systemAdmin.license.description",
        menuKey: "license-management",
        titleKey: "systemAdmin.license.title",
      },
    },
    element: guarded(systemAdminPermissions.license, <LicenseManagementPage />),
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
    element: gatedByCapability(CAPABILITIES.AUDIT, systemAdminPermissions.audit, <AuditLogPage />),
  },
];

export const systemAdminRouteContribution: AppRouteContribution = {
  moduleId: "system-admin",
  routes: systemAdminRoutes,
};
