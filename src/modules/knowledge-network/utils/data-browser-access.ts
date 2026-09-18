/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnObjectType } from "@/modules/knowledge-network/services/context-loader.service";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

/**
 * Context Loader does not expose record operations itself. Keep its dynamic requests available
 * only while access is unknown; once Studio has enriched the object type, enforce the effective
 * record operation before issuing a sample-data request.
 */
export function canQueryDataBrowserObjectType(objectType: KnObjectType) {
  return (
    objectType.operations === undefined ||
    hasKnowledgeNetworkRecordOperation(objectType, "query_data")
  );
}
