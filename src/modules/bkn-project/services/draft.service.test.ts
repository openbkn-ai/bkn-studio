/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));

vi.mock("@/framework/request/http", () => ({
  http: { get: mockGet, post: mockPost },
}));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importService() {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  return import("@/modules/bkn-project/services/draft.service");
}

function httpError(status: number, code: string) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: code },
    status,
  } as AxiosResponse);
}

describe("draft.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the draft and maps every item, null lists as empty", async () => {
    const { getDraft, mockDraft } = await importService();
    const backend = mockDraft("p1");
    backend.items.decisions = undefined;
    backend.items.object_types![2].primary_keys = null;
    mockGet.mockResolvedValue({ data: backend });

    const draft = await getDraft("p/1");

    expect(mockGet).toHaveBeenCalledWith("/bkn-project/v1/projects/p%2F1/ontology/draft", {
      skipErrorToast: true,
    });
    expect(draft?.status).toBe("ready");
    expect(draft?.items.decisions).toEqual([]);
    expect(draft?.items.objectTypes[1]).toMatchObject({
      id: "sales_orders",
      key: { computed: true, distinct: 911, rows: 1972, source: "chosen" },
      needsIdentity: false,
      primaryKeys: ["id"],
      table: { catalogId: "cat-001", name: "sales_orders", resourceId: "res-sales_orders" },
    });
    expect(draft?.items.objectTypes[2].primaryKeys).toEqual([]);
    expect(draft?.items.relationTypes[0]).toMatchObject({
      evidence: { hitRate: 0.995, hits: 796, orphans: 4, rows: 800, sourceDistinct: 60 },
      mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
      origin: "name_match",
    });
    expect(draft?.items.valueTypes[0]).toMatchObject({
      baseType: "string",
      usedBy: [{ objectType: "customers", property: "level" }],
    });
    expect(draft?.items.excluded[0]).toEqual({
      field: "contact_phone",
      keyword: "phone",
      objectType: "customers",
      reason: "privacy",
    });
    expect(draft?.items.unreadable[0].reason).toBe("not_visible");
  });

  it("answers null before the first draft and rethrows any other error", async () => {
    const { getDraft } = await importService();
    mockGet.mockRejectedValueOnce(httpError(404, "BknProject.Draft.NotFound"));
    await expect(getDraft("p1")).resolves.toBeNull();

    mockGet.mockRejectedValueOnce(httpError(500, "BknProject.Draft.InternalError"));
    await expect(getDraft("p1")).rejects.toBeInstanceOf(AxiosError);
  });

  it("starts drafting with the generate method and returns the drafting draft", async () => {
    const { generateDraft, mockDraft } = await importService();
    mockPost.mockResolvedValue({ data: { ...mockDraft("p1"), status: "drafting" } });

    const draft = await generateDraft("p1");

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft:generate",
      {},
      { skipErrorToast: true },
    );
    expect(draft.status).toBe("drafting");
  });
});
