/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { useExperienceNetwork } from "./useExperienceNetwork";

const { getKnowledgeNetwork } = vi.hoisted(() => ({
  getKnowledgeNetwork: vi.fn<() => Promise<KnowledgeNetworkRecord | null>>(),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetwork,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("useExperienceNetwork", () => {
  it("reuses the identity supplied by the workspace without another detail request", () => {
    const identity = { id: "network-1", name: "Orders", slug: "orders_kn" };

    const { result } = renderHook(() => useExperienceNetwork("network-1", identity));

    expect(result.current).toEqual(identity);
    expect(getKnowledgeNetwork).not.toHaveBeenCalled();
  });

  it("loads the identity for standalone consumers", async () => {
    getKnowledgeNetwork.mockResolvedValue({
      id: "network-1",
      identifier: "orders_kn",
      name: "Orders",
    } as KnowledgeNetworkRecord);

    const { result } = renderHook(() => useExperienceNetwork("network-1"));

    await waitFor(() => {
      expect(result.current).toEqual({
        id: "network-1",
        name: "Orders",
        slug: "orders_kn",
      });
    });
    expect(getKnowledgeNetwork).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a stale workspace identity after the route id changes", () => {
    const { result } = renderHook(() =>
      useExperienceNetwork("network-2", {
        id: "network-1",
        name: "Orders",
        slug: "orders_kn",
      }),
    );

    expect(result.current).toBeNull();
    expect(getKnowledgeNetwork).not.toHaveBeenCalled();
  });
});
