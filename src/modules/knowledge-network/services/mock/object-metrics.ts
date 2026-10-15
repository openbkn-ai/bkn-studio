/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

export const mockObjectMetrics: Record<string, ObjectMetricRecordV1[]> = {};

export function countMockObjectMetrics(networkId: string): number {
  return new Set((mockObjectMetrics[networkId] ?? []).map((record) => record.definition.id)).size;
}
