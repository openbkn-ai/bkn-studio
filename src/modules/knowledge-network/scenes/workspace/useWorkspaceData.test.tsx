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
  entitlementState,
  getKnowledgeNetwork,
  getKnowledgeNetworkStatistics,
  listKnowledgeNetworkCapabilities,
  listObjectMetricsV1,
} = vi.hoisted(() => ({
  entitlementState: { value: "available" },
  getKnowledgeNetwork: vi.fn<() => Promise<KnowledgeNetworkRecord | null>>(),
  getKnowledgeNetworkStatistics: vi.fn(),
  listKnowledgeNetworkCapabilities: vi.fn(),
  listObjectMetricsV1: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/capability-binding.service", () => ({
  listKnowledgeNetworkCapabilities,
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => entitlementState.value,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetwork,
  getKnowledgeNetworkStatistics,
  listKnowledgeNetworkActionTypes: vi.fn(() => []),
  listKnowledgeNetworkConceptGroups: vi.fn(() => []),
  listObjectMetricsV1,
  listKnowledgeNetworkObjectTypes: vi.fn(() => []),
  listKnowledgeNetworkRecentObjects: vi.fn(() => []),
  listKnowledgeNetworkRelationTypes: vi.fn(() => []),
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
    operations: [],
    statistics: {
      actionTypesTotal: 0,
      conceptGroupsTotal: 0,
      metricsTotal,
      objectTypesTotal: 0,
      relationTypesTotal: 0,
      skillsTotal: 0,
      mcpToolsTotal: 0,
      apisTotal: 0,
      functionsTotal: 0,
    },
    tags: [],
    updateTime: "2026-01-01",
    updaterName: "admin",
  };
}

afterEach(() => {
  entitlementState.value = "available";
  vi.clearAllMocks();
});

describe("useWorkspaceData metrics sidebar count", () => {
  it("merges metrics total when metrics resolves before detail in the same batch", async () => {
    let resolveDetail: (value: KnowledgeNetworkRecord) => void = () => {};
    const detailPromise = new Promise<KnowledgeNetworkRecord>((resolve) => {
      resolveDetail = resolve;
    });

    getKnowledgeNetwork.mockReturnValue(detailPromise);
    listObjectMetricsV1.mockResolvedValue({
      entries: [],
      total_count: 12,
    });
    getKnowledgeNetworkStatistics.mockResolvedValue(createDetail(0).statistics);

    const { result } = renderHook(() => useWorkspaceData("kn-1", "metrics"));

    await waitFor(() => {
      expect(listObjectMetricsV1).toHaveBeenCalled();
    });

    resolveDetail(createDetail(0));

    await waitFor(() => {
      expect(result.current.detail?.statistics.metricsTotal).toBe(12);
    });
  });

  it("does not request Object Metrics when the deployment capability is unavailable", async () => {
    entitlementState.value = "not-installed";
    getKnowledgeNetwork.mockResolvedValue(createDetail(0));
    getKnowledgeNetworkStatistics.mockResolvedValue(createDetail(0).statistics);

    renderHook(() => useWorkspaceData("kn-1", "metrics"));

    await waitFor(() => {
      expect(getKnowledgeNetwork).toHaveBeenCalled();
    });
    expect(listObjectMetricsV1).not.toHaveBeenCalled();
  });
});

describe("useWorkspaceData direct capability mounts", () => {
  it.each([
    ["functions", "function", "function"],
    ["apis", "function", "openapi"],
    ["mcp", "mcp_tool", ""],
  ] as const)("shows only mounted %s entries", async (section, type, metadataType) => {
    getKnowledgeNetwork.mockResolvedValue(createDetail());
    getKnowledgeNetworkStatistics.mockResolvedValue(createDetail().statistics);
    listKnowledgeNetworkCapabilities.mockResolvedValue({
      boxes: [],
      entries: [{ id: "binding-1", boxId: "box-1", metadataType, name: "Direct mount" }],
      metadataAvailable: true,
      totalCount: 1,
    });

    const { result } = renderHook(() => useWorkspaceData("kn-1", section));

    await waitFor(() => {
      const data = section === "mcp" ? result.current.mcpTools : result.current[section];
      expect(data.entries.map((entry) => entry.name)).toEqual(["Direct mount"]);
      expect(data.totalCount).toBe(1);
    });
    expect(listKnowledgeNetworkCapabilities).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ mountedOnly: true, type }),
    );
  });

  it("hides reference-only rows if an older backend ignores mounted_only", async () => {
    getKnowledgeNetwork.mockResolvedValue(createDetail());
    getKnowledgeNetworkStatistics.mockResolvedValue(createDetail().statistics);
    listKnowledgeNetworkCapabilities.mockResolvedValue({
      boxes: [],
      entries: [
        { id: "", boxId: "box-1", metadataType: "function", name: "Action reference" },
        { id: "binding-1", boxId: "box-1", metadataType: "function", name: "Direct mount" },
      ],
      metadataAvailable: true,
      totalCount: 2,
    });

    const { result } = renderHook(() => useWorkspaceData("kn-1", "functions"));

    await waitFor(() => {
      expect(result.current.functions.entries.map((entry) => entry.name)).toEqual(["Direct mount"]);
      expect(result.current.functions.totalCount).toBe(1);
    });
  });

  it("reads the next mount page before splitting API and Function rows", async () => {
    getKnowledgeNetwork.mockResolvedValue(createDetail());
    getKnowledgeNetworkStatistics.mockResolvedValue(createDetail().statistics);
    listKnowledgeNetworkCapabilities.mockImplementation(
      (_networkId: string, query: { offset?: number }) =>
        Promise.resolve({
          boxes: [],
          entries:
            query.offset === 1000
              ? [{ id: "api-1", boxId: "box-api", metadataType: "openapi", name: "API" }]
              : Array.from({ length: 1000 }, (_, index) => ({
                  id: `function-${index}`,
                  boxId: "box-function",
                  metadataType: "function",
                  name: `Function ${index}`,
                })),
          metadataAvailable: true,
          totalCount: 1001,
        }),
    );

    const { result } = renderHook(() => useWorkspaceData("kn-1", "apis"));

    await waitFor(() => {
      expect(result.current.apis.entries.map((entry) => entry.id)).toEqual(["api-1"]);
      expect(result.current.functions.totalCount).toBe(1000);
    });
    expect(listKnowledgeNetworkCapabilities).toHaveBeenCalledWith(
      "kn-1",
      expect.objectContaining({ mountedOnly: true, offset: 1000, type: "function" }),
    );
  });
});
