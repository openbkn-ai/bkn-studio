/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { MetricDataQueryScene } from "@/modules/knowledge-network/scenes/MetricDataQueryScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function MetricDataQueryPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <MetricDataQueryScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
