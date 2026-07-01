/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { TaskFormScene } from "@/modules/knowledge-network/scenes/TaskFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function TaskCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <TaskFormScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
