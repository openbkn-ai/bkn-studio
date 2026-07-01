/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { TopBar } from "@/app/shell/TopBar";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import type { KnowledgeNetworkWorkspaceSection } from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";

type KnowledgeNetworkWorkspaceStandalonePageProps = {
  section: KnowledgeNetworkWorkspaceSection;
};

export function KnowledgeNetworkWorkspaceStandalonePage({
  section,
}: KnowledgeNetworkWorkspaceStandalonePageProps) {
  const runtimeConfig = useRuntimeConfig();

  return (
    <div className="knowledge-workspace-shell">
      {/* 与控制台同款顶栏，保持全站一致（品牌 + 面包屑 + 工作区/独立运行 + 用户角色） */}
      <TopBar />
      <main className="knowledge-workspace-main">
        <AntdProviders runtimeConfig={runtimeConfig}>
          <div className="knowledge-workspace-scene-host">
            <KnowledgeNetworkWorkspaceScene section={section} />
          </div>
        </AntdProviders>
      </main>
    </div>
  );
}
