/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { RelationTypeMappingScene } from "@/modules/knowledge-network/scenes/RelationTypeMappingScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function RelationTypeMappingPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <RelationTypeMappingScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
