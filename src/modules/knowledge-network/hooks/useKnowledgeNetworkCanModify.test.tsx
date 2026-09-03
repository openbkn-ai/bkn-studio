/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import {
  useKnowledgeNetworkModifyAccess,
  useKnowledgeNetworkOperationAccessState,
} from "./useKnowledgeNetworkCanModify";

const { getKnowledgeNetwork } = vi.hoisted(() => ({
  getKnowledgeNetwork: vi.fn<() => Promise<KnowledgeNetworkRecord | null>>(),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetwork,
}));

function createRecord(operations: string[]): KnowledgeNetworkRecord {
  return {
    color: "#1677ff",
    createTime: "2026-01-01",
    creatorName: "admin",
    description: "",
    id: "kn-1",
    identifier: "kn-1",
    name: "Test KN",
    operations,
    statistics: {
      actionTypesTotal: 0,
      conceptGroupsTotal: 0,
      metricsTotal: 0,
      objectTypesTotal: 0,
      relationTypesTotal: 0,
    },
    tags: [],
    updateTime: "2026-01-01",
    updaterName: "admin",
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useKnowledgeNetworkModifyAccess", () => {
  it("keeps write actions pending until the resource operation set resolves", async () => {
    let resolveDetail: (value: KnowledgeNetworkRecord | null) => void = () => {};
    getKnowledgeNetwork.mockReturnValue(
      new Promise<KnowledgeNetworkRecord | null>((resolve) => {
        resolveDetail = resolve;
      }),
    );

    const { result } = renderHook(() => useKnowledgeNetworkModifyAccess("kn-1"));

    expect(result.current).toEqual({
      canModify: false,
      error: null,
      isForbidden: false,
      isLoading: true,
    });

    resolveDetail(createRecord(["view_detail", "modify", "delete"]));

    await waitFor(() => {
      expect(result.current).toEqual({
        canModify: true,
        error: null,
        isForbidden: false,
        isLoading: false,
      });
    });
  });

  it("keeps delete denied when the network only grants modify", async () => {
    getKnowledgeNetwork.mockResolvedValue(createRecord(["view_detail", "modify"]));

    const { result } = renderHook(() =>
      useKnowledgeNetworkOperationAccessState("kn-1", ["modify", "delete"]),
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        access: { delete: false, modify: true },
        error: null,
        isForbidden: false,
        isLoading: false,
      });
    });
  });

  it("treats a confirmed 403 as denied without reporting a service failure", async () => {
    getKnowledgeNetwork.mockRejectedValue(
      Object.assign(new Error("forbidden"), { response: { status: 403 } }),
    );

    const { result } = renderHook(() =>
      useKnowledgeNetworkOperationAccessState("kn-1", ["modify"]),
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        access: { modify: false },
        error: null,
        isForbidden: true,
        isLoading: false,
      });
    });
  });

  it("reports a non-permission failure instead of silently treating it as denial", async () => {
    getKnowledgeNetwork.mockRejectedValue(
      Object.assign(new Error("backend unavailable"), { response: { status: 503 } }),
    );

    const { result } = renderHook(() =>
      useKnowledgeNetworkOperationAccessState("kn-1", ["modify"]),
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        access: { modify: false },
        error: "backend unavailable",
        isForbidden: false,
        isLoading: false,
      });
    });
  });
});
