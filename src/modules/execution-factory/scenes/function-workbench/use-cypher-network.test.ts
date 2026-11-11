/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/network";

import { useCypherNetwork } from "./use-cypher-network";

const { getKnowledgeNetwork } = vi.hoisted(() => ({ getKnowledgeNetwork: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    runtimeConfig: {
      auth: { tokenManager: { getAccessToken: () => "token", refreshAccessToken: vi.fn() } },
    },
  }),
}));
vi.mock("@/modules/knowledge-network/services/network.service", () => ({ getKnowledgeNetwork }));
vi.mock("@/modules/knowledge-network/services/context-loader.service", () => ({
  fetchKnDetailRest: vi.fn(() => new Promise(() => undefined)),
}));
vi.mock("@/modules/knowledge-network/cypher/cypher-query.service", () => ({
  getObjectTypeProperties: vi.fn(),
}));

const network = (id: string) =>
  ({ id, identifier: `${id}-ident`, name: id }) as KnowledgeNetworkRecord;

describe("useCypherNetwork", () => {
  beforeEach(() => {
    getKnowledgeNetwork.mockReset();
  });

  it("does not hand out the previous function's network while the next one loads", async () => {
    let resolveB: (record: KnowledgeNetworkRecord) => void = () => undefined;
    getKnowledgeNetwork.mockImplementation((id: string) =>
      id === "kn-a"
        ? Promise.resolve(network("kn-a"))
        : new Promise<KnowledgeNetworkRecord>((resolve) => {
            resolveB = resolve;
          }),
    );

    const { result, rerender } = renderHook(({ knId }) => useCypherNetwork(knId), {
      initialProps: { knId: "kn-a" },
    });
    await waitFor(() => expect(result.current.network?.id).toBe("kn-a"));
    expect(result.current.env?.knId).toBe("kn-a-ident");

    rerender({ knId: "kn-b" });
    // A run now would go to kn-a: nothing must point there.
    expect(result.current.network).toBeNull();
    expect(result.current.env).toBeNull();

    await act(async () => {
      resolveB(network("kn-b"));
      await Promise.resolve();
    });
    expect(result.current.network?.id).toBe("kn-b");
    expect(result.current.env?.knId).toBe("kn-b-ident");
  });
});
