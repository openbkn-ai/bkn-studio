/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { ProjectObjectTypeEditScene } from "@/modules/bkn-project/scenes/ProjectObjectTypeEditScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

/** An object type of a project's draft, edited full screen as a network's object type is. */
export function ProjectObjectTypeEditPage() {
  const { itemId = "", projectId = "" } = useParams<{ itemId: string; projectId: string }>();
  return (
    <KnowledgeNetworkResourceConfigStandalonePage immersive>
      <ProjectObjectTypeEditScene
        itemId={itemId}
        key={`${projectId}/${itemId}`}
        projectId={projectId}
      />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
