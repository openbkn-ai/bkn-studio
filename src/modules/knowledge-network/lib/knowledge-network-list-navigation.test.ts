/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildKnowledgeNetworkListPath,
  knowledgeNetworkListReturnState,
  readKnowledgeNetworkListLocation,
  rememberKnowledgeNetworkListPath,
  resolveKnowledgeNetworkListPath,
} from "@/modules/knowledge-network/lib/knowledge-network-list-navigation";

describe("knowledge network list navigation", () => {
  it("round-trips the visible list position through the URL", () => {
    const path = buildKnowledgeNetworkListPath({
      keyword: "order",
      page: 3,
      pageSize: 24,
      sortBy: "name",
      sortDirection: "asc",
      tag: "sales",
    });

    expect(path).toBe(
      "/knowledge-network?page=3&pageSize=24&keyword=order&tag=sales&sortBy=name&sortDirection=asc",
    );
    expect(readKnowledgeNetworkListLocation(path.split("?")[1] ?? "")).toEqual({
      keyword: "order",
      page: 3,
      pageSize: 24,
      sortBy: "name",
      sortDirection: "asc",
      tag: "sales",
    });
  });

  it("uses the remembered list path after workspace navigation drops route state", () => {
    const storage = {
      getItem: vi.fn<() => string | null>(),
      setItem: vi.fn<(key: string, value: string) => void>(),
    };
    const returnTo = "/knowledge-network?page=2&keyword=customer";
    rememberKnowledgeNetworkListPath(returnTo, storage);
    storage.getItem.mockReturnValue(returnTo);

    expect(resolveKnowledgeNetworkListPath(null, storage)).toBe(returnTo);
    expect(storage.setItem).toHaveBeenCalledWith("knowledge-network:list-return-path", returnTo);
  });

  it("rejects return targets outside the knowledge network list", () => {
    expect(
      resolveKnowledgeNetworkListPath(
        { knowledgeNetworkListReturnTo: "//example.com/knowledge-network" },
        undefined,
      ),
    ).toBe("/knowledge-network");
    expect(knowledgeNetworkListReturnState("/account")).toEqual({
      knowledgeNetworkListReturnTo: "/knowledge-network",
    });
  });
});
