/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { rewriteObjectMetricDevApiUrl } from "../../../../vite-object-metric-proxy";

describe("Object Metric V1 development proxy", () => {
  it("rewrites only object metric routes", () => {
    expect(
      rewriteObjectMetricDevApiUrl(
        "/api/bkn-backend/v1/knowledge-networks/kn-1/object-metrics?limit=20",
      ),
    ).toBe("/api/bkn-backend/v2/knowledge-networks/kn-1/object-metrics?limit=20");
    expect(
      rewriteObjectMetricDevApiUrl(
        "/api/ontology-query/v1/knowledge-networks/kn-1/object-metrics/m-1/data",
      ),
    ).toBe("/api/ontology-query/v2/knowledge-networks/kn-1/object-metrics/m-1/data");
    expect(rewriteObjectMetricDevApiUrl("/api/bkn-backend/v1/object-metrics/capabilities")).toBe(
      "/api/bkn-backend/v2/object-metrics/capabilities",
    );
    expect(rewriteObjectMetricDevApiUrl("/api/bkn-backend/v1/knowledge-networks/kn-1")).toBe(
      "/api/bkn-backend/v1/knowledge-networks/kn-1",
    );
  });
});
