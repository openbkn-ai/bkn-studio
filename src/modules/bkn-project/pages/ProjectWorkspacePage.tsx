/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate, useParams } from "react-router-dom";

import { TopBar } from "@/app/shell/TopBar";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
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

  // An unknown page, or a knowledge-base page the community image does not have, opens the overview.
  if (
    !isProjectSection(section) ||
    (kbMode === "hidden" && KNOWLEDGE_BASE_SECTIONS.includes(section))
  ) {
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
