/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkWorkspaceSection } from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";

type KnowledgeNetworkWorkspacePageProps = {
  section: KnowledgeNetworkWorkspaceSection;
};

export function KnowledgeNetworkWorkspacePage({
  section,
}: KnowledgeNetworkWorkspacePageProps) {
  return <KnowledgeNetworkWorkspaceScene section={section} />;
}
