import type { ReactNode } from "react";

import { TopBar } from "@/app/shell/TopBar";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";

type KnowledgeNetworkResourceConfigStandalonePageProps = {
  children: ReactNode;
  immersive?: boolean;
};

export function KnowledgeNetworkResourceConfigStandalonePage({
  children,
  immersive = false,
}: KnowledgeNetworkResourceConfigStandalonePageProps) {
  const runtimeConfig = useRuntimeConfig();

  return (
    <div
      className={
        immersive
          ? "knowledge-workspace-shell knowledge-workspace-shell-immersive"
          : "knowledge-workspace-shell"
      }
    >
      {/* 与控制台同款顶栏，保持全站一致 */}
      {immersive ? null : <TopBar />}

      <main className="knowledge-workspace-main">
        <AntdProviders runtimeConfig={runtimeConfig}>
          <div className="knowledge-workspace-scene-host">{children}</div>
        </AntdProviders>
      </main>
    </div>
  );
}
