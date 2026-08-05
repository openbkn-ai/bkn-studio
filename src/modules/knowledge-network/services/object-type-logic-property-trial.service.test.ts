/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: {
    post: postMock,
  },
}));

const gmvMetric = {
  dataSource: { id: "metric-1", name: "GMV", type: "metric" as const },
  displayName: "GMV",
  name: "gmv_metric",
  type: "metric" as const,
};

describe("object-type-logic-property-trial.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({
      data: {
        datas: [{ gmv_metric: 42 }],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls the direct ontology-query property endpoint", async () => {
    const { getObjectTypeLogicPropertyValues } = await import(
      "@/modules/knowledge-network/services/object-type-logic-property-trial.service"
    );

    const rows = await getObjectTypeLogicPropertyValues({
      instanceIdentities: [{ order_id: "1001" }],
      logicProperties: [gmvMetric],
      networkId: "kn-route-id",
      objectTypeId: "ot-1",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, options] = postMock.mock.calls[0] as unknown as [
      string,
      {
        _instance_identities: Array<Record<string, string>>;
        dynamic_params: Record<string, { instant: boolean; start: number }>;
        properties: string[];
      },
      { headers: Record<string, string> },
    ];
    expect(url).toBe(
      "/ontology-query/v1/knowledge-networks/kn-route-id/object-types/ot-1/properties",
    );
    expect(body).toMatchObject({
      _instance_identities: [{ order_id: "1001" }],
      dynamic_params: {
        gmv_metric: { instant: true, start: 946684800000 },
      },
      properties: ["gmv_metric"],
    });
    expect(options).toEqual({ headers: { "X-HTTP-Method-Override": "GET" } });
    expect(rows).toEqual([
      { instanceIdentity: { order_id: "1001" }, values: { gmv_metric: 42 } },
    ]);
  });

  it("submits selected instances in one request and preserves returned row order", async () => {
    postMock.mockResolvedValueOnce({
      data: {
        datas: [{ gmv_metric: 1002 }, { gmv_metric: 1001 }],
      },
    });

    const { getObjectTypeLogicPropertyValues } = await import(
      "@/modules/knowledge-network/services/object-type-logic-property-trial.service"
    );

    const rows = await getObjectTypeLogicPropertyValues({
      instanceIdentities: [{ order_id: "1002" }, { order_id: "1001" }],
      logicProperties: [gmvMetric],
      networkId: "kn-1",
      objectTypeId: "ot-1",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      { instanceIdentity: { order_id: "1002" }, values: { gmv_metric: 1002 } },
      { instanceIdentity: { order_id: "1001" }, values: { gmv_metric: 1001 } },
    ]);
  });
});
