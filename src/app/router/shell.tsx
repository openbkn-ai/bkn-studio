/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

import { SideNav } from "@/app/shell/SideNav";
import { TopBar } from "@/app/shell/TopBar";
import { WorkspaceLayout } from "@/app/shell/WorkspaceLayout";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { LicenseStateBanner } from "@/framework/entitlement/LicenseStateBanner";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";

const SIDENAV_COLLAPSED_STORAGE_KEY = "bkn-studio:sidenav-collapsed";

export function AppShell() {
  const runtimeConfig = useRuntimeConfig();
  const [sidenavCollapsed, setSidenavCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SIDENAV_COLLAPSED_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(
      SIDENAV_COLLAPSED_STORAGE_KEY,
      sidenavCollapsed ? "true" : "false",
    );
  }, [sidenavCollapsed]);

  return (
    <div className="console-shell">
      <TopBar />
      <div className={sidenavCollapsed ? "console-body is-sidenav-collapsed" : "console-body"}>
        <SideNav
          collapsed={sidenavCollapsed}
          onToggleCollapsed={() => {
            setSidenavCollapsed((current) => !current);
          }}
        />
        <main className="console-main">
          <AntdProviders runtimeConfig={runtimeConfig}>
            {/* 只给管得了授权的人看:普通用户既处理不了,「去处理」也只会撞 403。 */}
            <PermissionGate mode="any" permissions={systemAdminPermissions.license}>
              <LicenseStateBanner />
            </PermissionGate>
            <WorkspaceLayout>
              <Outlet />
            </WorkspaceLayout>
          </AntdProviders>
        </main>
      </div>
    </div>
  );
}
