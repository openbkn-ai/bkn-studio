/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type OperationRecord = {
  operations?: string[];
};

export function hasKnowledgeNetworkRecordOperation(
  record: OperationRecord | null | undefined,
  operation: string,
) {
  if (!record) {
    return false;
  }

  return record.operations?.includes("*") || record.operations?.includes(operation) || false;
}
