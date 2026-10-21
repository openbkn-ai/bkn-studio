/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getObjectTypeDetail: vi.fn(),
  listActionTypes: vi.fn(),
  listObjectTypes: vi.fn(),
  listRelationTypes: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/action-type.service", () => ({
  listKnowledgeNetworkActionTypePage: mocks.listActionTypes,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectTypeDetail,
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypes,
}));

vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  listKnowledgeNetworkRelationTypePage: mocks.listRelationTypes,
}));

import { useObjectTypeGraphExplorer } from "./useObjectTypeGraphExplorer";

const objectType = {
  color: "#1677ff",
  description: "Sales order",
  id: "order",
  name: "Order",
  operations: ["view_detail"],
  tags: [],
  updateTime: "2026-08-20 10:00:00",
  updaterName: "admin",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("useObjectTypeGraphExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getObjectTypeDetail.mockResolvedValue(objectType);
    mocks.listObjectTypes.mockImplementation(() =>
      Promise.resolve({ entries: [{ ...objectType }], totalCount: 1 }),
    );
  });

  it("reuses an in-flight count request after the object list refreshes", async () => {
    const countRequest = deferred<{ entries: []; totalCount: number }>();
    mocks.listRelationTypes.mockReturnValue(countRequest.promise);
    const setSelectedId = vi.fn();
    const { result, rerender } = renderHook(
      ({ keyword }) =>
        useObjectTypeGraphExplorer({
          direction: "asc",
          enabled: true,
          keyword,
          networkId: "network-1",
          refreshVersion: 0,
          resourceScope: "relations",
          selectedId: "order",
          setSelectedId,
          sort: "name",
        }),
      { initialProps: { keyword: "" } },
    );

    await waitFor(() => expect(mocks.listRelationTypes).toHaveBeenCalledTimes(1));

    rerender({ keyword: "ord" });
    await waitFor(() => expect(mocks.listObjectTypes).toHaveBeenCalledTimes(2));
    countRequest.resolve({ entries: [], totalCount: 3 });

    await waitFor(() => expect(result.current.resourceCounts.order).toBe(3));
    expect(mocks.listRelationTypes).toHaveBeenCalledTimes(1);
  });
});
