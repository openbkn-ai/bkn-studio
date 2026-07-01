/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ConceptGroupFormScene } from "@/modules/knowledge-network/scenes/ConceptGroupFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ConceptGroupCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <ConceptGroupFormScene mode="create" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
