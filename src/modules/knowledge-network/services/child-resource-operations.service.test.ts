/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

import { ensureKnowledgeNetworkChildOperations } from "./child-resource-operations.service";

describe("ensureKnowledgeNetworkChildOperations", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("keeps operations returned by a detail response without another request", async () => {
    const detail = { id: "action-1", operations: ["modify"] };

    await expect(
      ensureKnowledgeNetworkChildOperations("kn-1", "action-types", detail),
    ).resolves.toBe(detail);
    expect(getMock).not.toHaveBeenCalled();
  });

  it.each([
    "concept-groups",
    "object-types",
    "relation-types",
    "action-types",
    "metrics",
  ] as const)(
    "loads effective operations from the %s list when detail omits them",
    async (collection) => {
      getMock.mockResolvedValue({
        data: {
          entries: [
            { id: "another", operations: ["view_detail"] },
            {
              id: "child-1",
              operations: ["view_detail", "modify", "authorize", "delete"],
            },
          ],
          total_count: 2,
        },
      });

      const result = await ensureKnowledgeNetworkChildOperations("kn-1", collection, {
        id: "child-1",
      });

      expect(result.operations).toEqual(["view_detail", "modify", "authorize", "delete"]);
      expect(getMock).toHaveBeenCalledWith(
        `/bkn-backend/v1/knowledge-networks/kn-1/${collection}`,
        {
          params: {
            direction: "desc",
            limit: -1,
            offset: 0,
            sort: "update_time",
          },
        },
      );
    },
  );

  it("fails closed when the detail is no longer present in the visible list", async () => {
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });

    const result = await ensureKnowledgeNetworkChildOperations("kn-1", "object-types", {
      id: "object-1",
    });

    expect(result.operations).toEqual([]);
  });
});
