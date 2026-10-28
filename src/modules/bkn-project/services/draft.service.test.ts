/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPatch, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("@/framework/request/http", () => ({
  http: { get: mockGet, patch: mockPatch, post: mockPost, put: mockPut },
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

  it("agrees to discard the decisions only when asked", async () => {
    const { generateDraft, mockDraft } = await importService();
    mockPost.mockResolvedValue({ data: { ...mockDraft("p1"), status: "drafting" } });

    await generateDraft("p1", { discardDecisions: true });

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft:generate",
      { discard_decisions: true },
      { skipErrorToast: true },
    );
  });

  it("edits one item with the draft's update time and only the fields given", async () => {
    const { editDraftItem, mockDraft } = await importService();
    mockPatch.mockResolvedValue({ data: { ...mockDraft("p1"), update_time: 42 } });

    const draft = await editDraftItem("p 1", "object_types", "sales orders", 7, {
      adopted: false,
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/ontology/draft/items/object_types/sales%20orders",
      { adopted: false, update_time: 7 },
      { skipErrorToast: true },
    );
    expect(draft.updateTime).toBe(42);
  });

  it("chooses an identity and waits longer than bkn-project counts", async () => {
    const { chooseIdentity, IDENTITY_TIMEOUT_MS, mockDraft } = await importService();
    mockPut.mockResolvedValue({ data: mockDraft("p1") });

    await chooseIdentity("p1", "material bom", 7, ["material_code"]);

    expect(mockPut).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft/object_types/material%20bom/identity",
      { properties: ["material_code"], update_time: 7 },
      { skipErrorToast: true, timeout: IDENTITY_TIMEOUT_MS },
    );
    // bkn-project counts for up to 30 seconds and keeps the identity either way; the page must
    // not give up first and report a choice that was saved as failed.
    expect(IDENTITY_TIMEOUT_MS).toBeGreaterThan(30_000);
  });

  it("restores an excluded field with the draft's update time", async () => {
    const { mockDraft, restoreField } = await importService();
    mockPost.mockResolvedValue({ data: mockDraft("p1") });

    await restoreField("p1", 7, "customers", "contact_phone");

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft:restore",
      { field: "contact_phone", object_type: "customers", update_time: 7 },
      { skipErrorToast: true },
    );
  });
});
