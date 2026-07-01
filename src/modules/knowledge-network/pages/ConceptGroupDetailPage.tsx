/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ConceptGroupDetailScene } from "@/modules/knowledge-network/scenes/ConceptGroupDetailScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ConceptGroupDetailPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <ConceptGroupDetailScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
