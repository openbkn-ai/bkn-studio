/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function rewriteObjectMetricDevApiUrl(url: string): string {
  if (
    /^\/api\/(?:bkn-backend|ontology-query)\/v1\/knowledge-networks\/[^/]+\/object-metrics(?:\/|\?|$)/.test(
      url,
    ) ||
    url.startsWith("/api/bkn-backend/v1/object-metrics/capabilities")
  ) {
    return url.replace("/v1/", "/v2/");
  }
  return url;
}
