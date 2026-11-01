/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));

vi.mock("@/framework/request/http", () => ({ http: { get: mockGet, post: mockPost } }));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importService() {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  return import("@/modules/bkn-project/services/relation-suggestions.service");
}

const path = "/bkn-project/v1/projects/p%2F1/ontology/draft/relation-suggestions";

const reply = {
  candidates: [
    {
      evidence: {
        computed: true,
        hit_rate: 0.96,
        hits: 1180,
        nulls: 4,
        orphans: 50,
        rows: 1234,
        source_distinct: 40,
      },
      mapping_rules: [{ source_property: { name: "ward_id" }, target_property: { name: "id" } }],
      name: "Bed in ward",
      origin: "drafted",
      relation_type_id: "rt_bed_ward",
      source_object_type_id: "bed",
      target_object_type_id: "ward",
      type: "direct",
    },
    {
      evidence: { computed: false, reason: "cross_catalog" },
      mapping_rules: {
        backing_data_source: { id: "res-roster" },
        source_mapping_rules: [
          { source_property: { name: "id" }, target_property: { name: "nurse_id" } },
        ],
        target_mapping_rules: [
          { source_property: { name: "ward_id" }, target_property: { name: "id" } },
        ],
      },
      name: "Nurse on ward",
      origin: "ai",
      reason: "Rosters assign nurses to wards.",
      source_object_type_id: "nurse",
      target_object_type_id: "ward",
      type: "indirect",
    },
  ],
  object_type: { id: "ward", name: "Ward" },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("relation suggestions", () => {
  it("lists the unconnected object types", async () => {
    const { listIsolatedObjectTypes } = await importService();
    mockGet.mockResolvedValue({ data: { isolated: [{ id: "ward", name: "Ward" }] } });

    expect(await listIsolatedObjectTypes("p/1")).toEqual([{ id: "ward", name: "Ward" }]);
    expect(mockGet).toHaveBeenCalledWith(path, { skipErrorToast: true });

    mockGet.mockResolvedValue({ data: { isolated: null } });
    expect(await listIsolatedObjectTypes("p/1")).toEqual([]);
  });

  it("reads an object type's suggestions, direct or through a link table, with their counts", async () => {
    const { getRelationSuggestions } = await importService();
    mockGet.mockResolvedValue({ data: reply });

    const suggestions = await getRelationSuggestions("p/1", "ward");

    expect(mockGet).toHaveBeenCalledWith(path, {
      params: { object_type: "ward" },
      skipErrorToast: true,
    });
    expect(suggestions.objectType).toEqual({ id: "ward", name: "Ward" });
    expect(suggestions.candidates[0]).toMatchObject({
      ends: {
        mapping: [{ sourceProperty: "ward_id", targetProperty: "id" }],
        source: "bed",
        target: "ward",
      },
      // As bkn-project counted it: the empty rows apart from those that found no record.
      evidence: {
        computed: true,
        hitRate: 0.96,
        hits: 1180,
        nulls: 4,
        orphans: 50,
        rows: 1234,
        sourceDistinct: 40,
      },
      origin: "drafted",
      reason: "",
      relationTypeId: "rt_bed_ward",
    });
    expect(suggestions.candidates[1]).toMatchObject({
      ends: {
        link: {
          resourceId: "res-roster",
          sourceMapping: [{ sourceProperty: "id", targetProperty: "nurse_id" }],
          targetMapping: [{ sourceProperty: "ward_id", targetProperty: "id" }],
        },
        mapping: [],
      },
      evidence: { computed: false, reason: "cross_catalog" },
      origin: "ai",
      reason: "Rosters assign nurses to wards.",
      relationTypeId: "",
    });
  });

  it("asks AI for one object type, waiting longer than other requests", async () => {
    const { ASK_RELATIONS_TIMEOUT_MS, askRelationSuggestions } = await importService();

    mockPost.mockResolvedValue({ data: { ...reply, answer: "Wards hold beds and nurses." } });
    const asked = await askRelationSuggestions("p/1", "ward");
    expect(asked.candidates).toHaveLength(2);
    expect(asked.answer).toBe("Wards hold beds and nurses.");

    // No answer, or only blanks: none.
    mockPost.mockResolvedValue({ data: reply });
    expect((await askRelationSuggestions("p/1", "ward")).answer).toBe("");
    mockPost.mockResolvedValue({ data: { ...reply, answer: "  " } });
    expect((await askRelationSuggestions("p/1", "ward")).answer).toBe("");
    expect(mockPost).toHaveBeenCalledWith(
      `${path}:ask`,
      { object_type: "ward" },
      { skipErrorToast: true, timeout: ASK_RELATIONS_TIMEOUT_MS },
    );
  });
});
