/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate, useParams } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";
import { TopBar } from "@/app/shell/TopBar";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { ProjectWorkspaceScene } from "@/modules/bkn-project/scenes/ProjectWorkspaceScene";
import {
  isProjectSection,
  KNOWLEDGE_BASE_SECTIONS,
  projectSectionPath,
} from "@/modules/bkn-project/types/workspace";

/**
 * A project workspace stands outside the console shell: the console's navigation gives way to the
 * project's own, under the same top bar. It reuses the knowledge-network workspace shell classes.
 */
export function ProjectWorkspacePage() {
  const { projectId = "", section } = useParams<{ projectId: string; section?: string }>();
  const kbMode = useBknProjectKbMode();
  const { loading: entitlementLoading } = useEntitlementContext();

  if (!isProjectSection(section)) {
    return <Navigate replace to={projectSectionPath(projectId, "overview")} />;
  }
  if (KNOWLEDGE_BASE_SECTIONS.includes(section) && kbMode === "hidden") {
    // Hidden also means the entitlement has not arrived yet; leaving then would drop a deep link
    // to a knowledge-base page in a professional deployment.
    if (entitlementLoading) {
      return <RouteLoading />;
    }
    // The community image has no knowledge-base pages: open the overview.
    return <Navigate replace to={projectSectionPath(projectId, "overview")} />;
  }

  return (
    <div className="knowledge-workspace-shell">
      <TopBar />
      <main className="knowledge-workspace-main">
        <div className="knowledge-workspace-scene-host">
          <ProjectWorkspaceScene key={projectId} projectId={projectId} section={section} />
        </div>
      </main>
    </div>
  );
}
