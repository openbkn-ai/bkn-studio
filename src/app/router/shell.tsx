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
import { AntdProviders } from "@/framework/ui/AntdProviders";

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
            <WorkspaceLayout>
              <Outlet />
            </WorkspaceLayout>
          </AntdProviders>
        </main>
      </div>
    </div>
  );
}
