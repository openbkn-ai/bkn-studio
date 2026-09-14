/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("metric dependency property candidates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads only the backend-authorized full properties", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ display_name: "Amount", name: "amount", type: "double" }],
      },
    });
    const { getKnowledgeNetworkMetricDependencyProperties } = await import(
      "@/modules/knowledge-network/services/metric.service"
    );

    await expect(
      getKnowledgeNetworkMetricDependencyProperties("kn-1", "orders"),
    ).resolves.toEqual([{ comment: undefined, displayName: "Amount", name: "amount", type: "double" }]);
    expect(getMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/metrics/dependency-properties/orders",
    );
  });
});
