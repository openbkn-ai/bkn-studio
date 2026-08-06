/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

export function hasKnowledgeNetworkRecordOperation(
  record: KnowledgeNetworkRecord | null | undefined,
  operation: string,
) {
  if (!record) {
    return false;
  }

  if (record.operations === undefined) {
    return true;
  }

  return record.operations.includes("*") || record.operations.includes(operation);
}
