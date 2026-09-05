/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type { BackendListResponse } from "@/modules/knowledge-network/services/mappers/backend-types";

export type KnowledgeNetworkChildCollection =
  | "action-types"
  | "concept-groups"
  | "metrics"
  | "object-types"
  | "relation-types";

type OperationRecord = {
  id: string;
  operations?: string[];
};

/**
 * Older bkn-backend detail responses omit operations even though their list response exposes the
 * effective, inheritance-aware operation set. Keep the detail response as the primary source and
 * fall back to the matching list record only when the field is absent.
 */
export async function ensureKnowledgeNetworkChildOperations<T extends OperationRecord>(
  networkId: string,
  collection: KnowledgeNetworkChildCollection,
  record: T,
): Promise<T & { operations: string[] }> {
  if (record.operations !== undefined) {
    return record as T & { operations: string[] };
  }

  const response = await http.get<BackendListResponse<OperationRecord>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/${collection}`,
    {
      params: {
        direction: "desc",
        limit: -1,
        offset: 0,
        sort: "update_time",
      },
    },
  );
  const matchingRecord = response.data.entries.find((item) => item.id === record.id);

  return {
    ...record,
    operations: matchingRecord?.operations ?? [],
  };
}
