/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { GraphOverviewScene } from "@/modules/knowledge-network/graph-overview/GraphOverviewPage";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

/** The whole network's instances and relations at once, on a page of its own. */
export function GraphOverviewPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <GraphOverviewScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
