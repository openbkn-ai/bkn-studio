/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type OperationRecord = {
  operations?: string[];
};

/**
 * Checks a permission projected for this exact execution-unit record. Missing operation data is
 * deliberately denied so an older or failed backend response cannot reveal a write control.
 */
export function hasExecutionUnitRecordOperation(
  record: OperationRecord | null | undefined,
  operation: string,
) {
  return record?.operations?.includes("*") || record?.operations?.includes(operation) || false;
}
