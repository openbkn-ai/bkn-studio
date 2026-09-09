/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";
import { GraphExplorerScene } from "@/modules/knowledge-network/scenes/graph-explorer/GraphExplorerPage";

export function GraphExplorerPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <GraphExplorerScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
