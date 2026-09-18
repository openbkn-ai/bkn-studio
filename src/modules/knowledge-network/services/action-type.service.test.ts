/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

describe("action-type.service - executeKnowledgeNetworkActionTypeNow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({ data: { execution_id: "execution-1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("submits dynamic_params without the obsolete unique_identities field", async () => {
    const { executeKnowledgeNetworkActionTypeNow } =
      await import("@/modules/knowledge-network/services/action-type.service");

    await executeKnowledgeNetworkActionTypeNow("kn-1", "action-1", {
      city: "Shanghai",
      limit: 10,
    });

    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-types/action-1/execute",
      {
        dynamic_params: {
          city: "Shanghai",
          limit: 10,
        },
      },
    );
  });

  it("keeps one-click execution for action types without dynamic parameters", async () => {
    const { executeKnowledgeNetworkActionTypeNow } =
      await import("@/modules/knowledge-network/services/action-type.service");

    await executeKnowledgeNetworkActionTypeNow("kn-1", "action-1");

    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-types/action-1/execute",
      {},
    );
  });
});

describe("action-type.service - listKnowledgeNetworkActionTypeExecutionResults", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requests one page of results filtered by status and maps it", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          { _display: "Order 21", duration_ms: 12, error_message: "timeout", status: "failed" },
        ],
        total_count: 3,
      },
    });
    const { listKnowledgeNetworkActionTypeExecutionResults } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const page = await listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", {
      limit: 20,
      offset: 20,
      status: "failed",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-logs/exec-1/results",
      { params: { limit: 20, offset: 20, status: "failed" } },
    );
    expect(page).toEqual({
      entries: [
        { displayName: "Order 21", durationMs: 12, errorMessage: "timeout", status: "failed" },
      ],
      totalCount: 3,
    });
  });

  it("does not send an empty status filter", async () => {
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
    const { listKnowledgeNetworkActionTypeExecutionResults } =
      await import("@/modules/knowledge-network/services/action-type.service");

    await listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", {
      limit: 20,
      offset: 0,
      status: "",
    });

    expect(getMock).toHaveBeenCalledWith(expect.any(String), { params: { limit: 20, offset: 0 } });
  });

  it("resolves to null when the backend has no results endpoint, and rethrows other errors", async () => {
    const { listKnowledgeNetworkActionTypeExecutionResults } =
      await import("@/modules/knowledge-network/services/action-type.service");

    getMock.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
    await expect(
      listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", { limit: 20, offset: 0 }),
    ).resolves.toBeNull();

    const serverError = { isAxiosError: true, response: { status: 500 } };
    getMock.mockRejectedValueOnce(serverError);
    await expect(
      listKnowledgeNetworkActionTypeExecutionResults("kn-1", "exec-1", { limit: 20, offset: 0 }),
    ).rejects.toBe(serverError);
  });
});

describe("action-type.service - getKnowledgeNetworkActionTypeExecutionLogDetail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps how many results the execution has beyond the embedded first page", async () => {
    getMock.mockResolvedValue({
      data: {
        id: "exec-1",
        results: [{ _display: "Order 1", status: "success" }],
        results_total: 8808,
        status: "completed",
      },
    });
    const { getKnowledgeNetworkActionTypeExecutionLogDetail } =
      await import("@/modules/knowledge-network/services/action-type.service");

    const detail = await getKnowledgeNetworkActionTypeExecutionLogDetail("kn-1", "exec-1");

    expect(detail?.results).toHaveLength(1);
    expect(detail?.resultsTotal).toBe(8808);
  });
});
