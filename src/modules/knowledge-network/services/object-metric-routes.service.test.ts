/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

describe("object metric V1 HTTP routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset().mockResolvedValue({ data: { entries: [], total_count: 0 } });
    postMock.mockReset().mockResolvedValue({ data: { status: "no_data" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the Foundry V1 catalog and query routes", async () => {
    const { listObjectMetricsV1, queryObjectMetricDataV1, trialObjectMetricDataV1 } =
      await import("@/modules/knowledge-network/services/object-metric.service");
    const { transformPrecisionSafeJSONResponse } =
      await import("@/framework/request/precision-safe-json");

    await listObjectMetricsV1("network-1", { limit: 500, offset: 0 });
    await queryObjectMetricDataV1("network-1", "metric-1", 2);
    await trialObjectMetricDataV1("network-1", createObjectMetricDefinitionV1("atomic", "orders"));

    expect(getMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/network-1/object-metrics",
      {
        params: {
          keyword: undefined,
          limit: 500,
          metric_type: undefined,
          offset: 0,
          owner_object_type_id: undefined,
          status: undefined,
        },
        skipErrorToast: undefined,
      },
    );
    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/network-1/object-metrics/metric-1/data",
      {},
      {
        params: { branch: "main", version: 2 },
        transformResponse: transformPrecisionSafeJSONResponse,
      },
    );
    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/network-1/object-metrics/trial",
      expect.anything(),
      {
        params: { branch: "main" },
        skipErrorToast: true,
        transformResponse: transformPrecisionSafeJSONResponse,
      },
    );
  });

  it("preserves large participant primary keys for exact object navigation", async () => {
    const raw =
      '{"participants":[{"instance_identity":{"order_id":110101199001152345},"role":"owner"}],"status":"ok"}';
    postMock.mockImplementation(
      (_url: string, _body: unknown, config: { transformResponse?: (data: unknown) => unknown }) =>
        Promise.resolve({ data: config.transformResponse?.(raw) }),
    );
    const { queryObjectMetricDrillThroughV1 } =
      await import("@/modules/knowledge-network/services/object-metric.service");

    await expect(
      queryObjectMetricDrillThroughV1("network-1", "metric-1", 2, {}, "bucket-1"),
    ).resolves.toMatchObject({
      participants: [{ instance_identity: { order_id: "110101199001152345" } }],
    });
  });
});
