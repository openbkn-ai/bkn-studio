/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";
import { ObjectTypeAuthorizationScene } from "@/modules/knowledge-network/scenes/ObjectTypeAuthorizationScene";

export function ObjectTypeAuthorizationPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <ObjectTypeAuthorizationScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
