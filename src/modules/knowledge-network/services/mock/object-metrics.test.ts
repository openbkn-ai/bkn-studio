/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { countMockObjectMetrics, mockObjectMetrics } from "./object-metrics";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

describe("object-metric mock statistics", () => {
  it("counts metric identities rather than definition versions", () => {
    const networkId = "mock-count-test";
    mockObjectMetrics[networkId] = [
      { definition: { id: "metric-a", version: 1 } } as ObjectMetricRecordV1,
      { definition: { id: "metric-a", version: 2 } } as ObjectMetricRecordV1,
      { definition: { id: "metric-b", version: 1 } } as ObjectMetricRecordV1,
    ];

    try {
      expect(countMockObjectMetrics(networkId)).toBe(2);
    } finally {
      delete mockObjectMetrics[networkId];
    }
  });
});
