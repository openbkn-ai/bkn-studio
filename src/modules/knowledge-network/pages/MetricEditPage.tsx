/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { MetricFormScene } from "@/modules/knowledge-network/scenes/MetricFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function MetricEditPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <MetricFormScene mode="edit" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
