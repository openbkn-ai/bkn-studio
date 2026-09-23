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

describe("relation-type.service · listKnowledgeNetworkRelationTypePage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requests one server page with relation and endpoint filters", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        entries: [
          {
            id: "relation-101",
            name: "Ordered by",
            operations: ["view_detail"],
            source_object_type: { id: "order", name: "Order" },
            target_object_type: { id: "customer", name: "Customer" },
          },
        ],
        total_count: 137,
      },
    });
    const { listKnowledgeNetworkRelationTypePage } =
      await import("@/modules/knowledge-network/services/relation-type.service");

    const result = await listKnowledgeNetworkRelationTypePage("kn-1", {
      direction: "asc",
      limit: 10,
      namePattern: "  Order  ",
      offset: 100,
      sort: "name",
      sourceObjectTypeId: "order",
      targetObjectTypeId: "customer",
    });

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn-1/relation-types", {
      params: {
        direction: "asc",
        limit: 10,
        name_pattern: "Order",
        offset: 100,
        sort: "name",
        source_object_type_id: "order",
        target_object_type_id: "customer",
      },
    });
    expect(result).toMatchObject({
      entries: [
        {
          id: "relation-101",
          name: "Ordered by",
          operations: ["view_detail"],
          sourceObjectTypeId: "order",
          sourceObjectTypeName: "Order",
          targetObjectTypeId: "customer",
          targetObjectTypeName: "Customer",
        },
      ],
      totalCount: 137,
    });
  });
});
