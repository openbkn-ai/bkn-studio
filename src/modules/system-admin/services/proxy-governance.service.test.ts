/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

const backendAccount = {
  created_at: 1_700_000_000_000,
  kn_id: "kn-1",
  lifecycle_status: "active" as const,
  proxy_account_id: "proxy-1",
  proxy_account_type: "app" as const,
  published_model_version: "model-v2",
  sync_status: "ready" as const,
  synced_model_version: "model-v2",
  updated_at: 1_700_000_100_000,
  version: 2,
};

describe("proxy-governance.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
  });

  it("lists only the sanitized public proxy shape", async () => {
    const { listProxyAccounts } = await import("@/modules/system-admin/services/proxy-governance.service");
    getMock.mockResolvedValue({ data: { entries: [backendAccount], total: 1 } });

    await expect(listProxyAccounts()).resolves.toEqual([
      expect.objectContaining({
        knowledgeNetworkId: "kn-1",
        proxyAccountId: "proxy-1",
        syncStatus: "ready",
      }),
    ]);
    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/proxy-accounts", {
      skipErrorToast: true,
    });
  });

  it("loads a server-derived grant-source plan", async () => {
    const { getProxySyncPlan } = await import("@/modules/system-admin/services/proxy-governance.service");
    getMock.mockResolvedValue({
      data: {
        kn_id: "kn/1",
        model_version: "model-v2",
        sources: [{
          binding_id: "ot-1",
          binding_type: "object_type",
          kn_id: "kn/1",
          operation: "query_data",
          resource_id: "resource-1",
          resource_type: "resource",
          source_id: "source-1",
          source_type: "kn_proxy_binding",
        }],
      },
    });

    const plan = await getProxySyncPlan("kn/1");
    expect(getMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn%2F1/proxy-account/plan",
      { skipErrorToast: true },
    );
    expect(plan.sources[0]).toMatchObject({ bindingId: "ot-1", resourceId: "resource-1" });
  });

  it("uses public mutation endpoints and does not accept caller-selected targets", async () => {
    const { reconcileProxyAccounts, retryProxySync } = await import(
      "@/modules/system-admin/services/proxy-governance.service"
    );
    postMock
      .mockResolvedValueOnce({ data: backendAccount })
      .mockResolvedValueOnce({ data: { failed_kn_ids: ["kn-2"] } });

    await retryProxySync("kn-1");
    await expect(reconcileProxyAccounts()).resolves.toMatchObject({
      failedKnowledgeNetworkIds: ["kn-2"],
    });
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/bkn-backend/v1/knowledge-networks/kn-1/proxy-account/sync",
      undefined,
      { skipErrorToast: true },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/bkn-backend/v1/proxy-accounts/reconcile",
      undefined,
      { skipErrorToast: true },
    );
  });
});
