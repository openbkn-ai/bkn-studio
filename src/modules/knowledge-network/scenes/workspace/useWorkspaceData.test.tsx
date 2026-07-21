/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { useWorkspaceData } from "./useWorkspaceData";

const {
  getKnowledgeNetwork,
  getMetricApiAvailability,
  listKnowledgeNetworkMetrics,
} = vi.hoisted(() => ({
  getKnowledgeNetwork: vi.fn<() => Promise<KnowledgeNetworkRecord | null>>(),
  getMetricApiAvailability: vi.fn(() => "ready"),
  listKnowledgeNetworkMetrics: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetwork,
  getMetricApiAvailability,
  listKnowledgeNetworkActionTypes: vi.fn(() => []),
  listKnowledgeNetworkConceptGroups: vi.fn(() => []),
  listKnowledgeNetworkMetrics,
  listKnowledgeNetworkObjectTypes: vi.fn(() => []),
  listKnowledgeNetworkRecentObjects: vi.fn(() => []),
  listKnowledgeNetworkRelationTypes: vi.fn(() => []),
  listKnowledgeNetworkTasks: vi.fn(() => []),
}));

function createDetail(metricsTotal = 0): KnowledgeNetworkRecord {
  return {
    color: "#1677ff",
    createTime: "2026-01-01",
    creatorName: "admin",
    description: "",
    id: "kn-1",
    identifier: "kn-1",
    name: "Test KN",
    statistics: {
      actionTypesTotal: 0,
      conceptGroupsTotal: 0,
      metricsTotal,
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

describe("useWorkspaceData metrics sidebar count", () => {
  it("merges metrics total when metrics resolves before detail in the same batch", async () => {
    let resolveDetail: (value: KnowledgeNetworkRecord) => void = () => {};
    const detailPromise = new Promise<KnowledgeNetworkRecord>((resolve) => {
      resolveDetail = resolve;
    });

    getKnowledgeNetwork.mockReturnValue(detailPromise);
    listKnowledgeNetworkMetrics.mockResolvedValue({
      entries: [],
      totalCount: 12,
    });

    const { result } = renderHook(() => useWorkspaceData("kn-1", "metrics"));

    await waitFor(() => {
      expect(listKnowledgeNetworkMetrics).toHaveBeenCalled();
    });

    resolveDetail(createDetail(0));

    await waitFor(() => {
      expect(result.current.detail?.statistics.metricsTotal).toBe(12);
    });
  });
});
