/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import { TopBar } from "@/app/shell/TopBar";

type KnowledgeNetworkResourceConfigStandalonePageProps = {
  children: ReactNode;
  immersive?: boolean;
};

export function KnowledgeNetworkResourceConfigStandalonePage({
  children,
  immersive = false,
}: KnowledgeNetworkResourceConfigStandalonePageProps) {
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
        <div className="knowledge-workspace-scene-host">{children}</div>
      </main>
    </div>
  );
}
