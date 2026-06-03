import { Outlet } from "react-router-dom";

import { SideNav } from "@/app/shell/SideNav";
import { TopBar } from "@/app/shell/TopBar";
import { WorkspaceLayout } from "@/app/shell/WorkspaceLayout";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";

export function AppShell() {
  const runtimeConfig = useRuntimeConfig();

  return (
    <div className="console-shell">
      <TopBar />
      <div className="console-body">
        <SideNav />
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
