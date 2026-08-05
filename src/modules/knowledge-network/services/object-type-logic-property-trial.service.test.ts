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

const toolProperty = {
  dataSource: { id: "tool-1", name: "Discount", type: "tool" as const },
  displayName: "Discount",
  name: "discount",
  type: "tool" as const,
};

describe("object-type-logic-property-trial.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({
      data: {
        datas: [{ discount: 42 }],
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
      logicProperties: [toolProperty],
      networkId: "kn-route-id",
      objectTypeId: "ot-1",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, options] = postMock.mock.calls[0] as unknown as [
      string,
      {
        _instance_identities: Array<Record<string, string>>;
        properties: string[];
      },
      { headers: Record<string, string> },
    ];
    expect(url).toBe(
      "/ontology-query/v1/knowledge-networks/kn-route-id/object-types/ot-1/properties",
    );
    expect(body).toMatchObject({
      _instance_identities: [{ order_id: "1001" }],
      properties: ["discount"],
    });
    expect(options).toEqual({ headers: { "X-HTTP-Method-Override": "GET" } });
    expect(rows).toEqual([
      { instanceIdentity: { order_id: "1001" }, values: { discount: 42 } },
    ]);
  });

  it("submits selected instances in one request and preserves returned row order", async () => {
    postMock.mockResolvedValueOnce({
      data: {
        datas: [{ discount: 1002 }, { discount: 1001 }],
      },
    });

    const { getObjectTypeLogicPropertyValues } = await import(
      "@/modules/knowledge-network/services/object-type-logic-property-trial.service"
    );

    const rows = await getObjectTypeLogicPropertyValues({
      instanceIdentities: [{ order_id: "1002" }, { order_id: "1001" }],
      logicProperties: [toolProperty],
      networkId: "kn-1",
      objectTypeId: "ot-1",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      { instanceIdentity: { order_id: "1002" }, values: { discount: 1002 } },
      { instanceIdentity: { order_id: "1001" }, values: { discount: 1001 } },
    ]);
  });

  it("rejects a response that cannot be mapped to every selected instance", async () => {
    postMock.mockResolvedValueOnce({ data: { datas: [] } });

    const { getObjectTypeLogicPropertyValues } = await import(
      "@/modules/knowledge-network/services/object-type-logic-property-trial.service"
    );

    await expect(
      getObjectTypeLogicPropertyValues({
        instanceIdentities: [{ order_id: "1001" }],
        logicProperties: [toolProperty],
        networkId: "kn-1",
        objectTypeId: "ot-1",
      }),
    ).rejects.toThrow("unexpected number of rows");
  });
});
