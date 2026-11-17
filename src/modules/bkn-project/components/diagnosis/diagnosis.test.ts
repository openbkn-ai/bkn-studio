/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { Diagnosis, DiagnosisSuggestion } from "@/modules/bkn-project/types/diagnosis";

import { fieldLabel, islandIds, percent, previewEdges, writebackGroups } from "./diagnosis";

const draft = mapDraft(mockDraft("p1"));

const diagnosis = (overrides: Partial<Diagnosis> = {}): Diagnosis => ({
  components: [["sales_orders", "customers"], ["material_bom"], ["gone"]],
  computedAt: 1,
  draftUpdateTime: 1,
  error: "",
  metrics: null,
  runId: "r1",
  stale: false,
  state: "ready",
  suggestions: [],
  ...overrides,
});

const suggestion = (overrides: Partial<DiagnosisSuggestion>): DiagnosisSuggestion => ({
  apply: null,
  evidence: { quotes: [] },
  group: "connect",
  id: "s1",
  impact: { connects: [], questions: [] },
  kind: "create_relation",
  rank: 1,
  reason: "",
  status: "open",
  title: "",
  ...overrides,
});

describe("islandIds", () => {
  it("rings the draft's object types outside the largest block", () => {
    expect([...islandIds(diagnosis(), draft)]).toEqual(["material_bom"]);
  });

  it("rings nothing for one block, or a diagnosis not ready", () => {
    expect(islandIds(diagnosis({ components: [["customers"]] }), draft).size).toBe(0);
    expect(islandIds(diagnosis({ state: "running" }), draft).size).toBe(0);
    expect(islandIds(null, draft).size).toBe(0);
  });
});

describe("previewEdges", () => {
  it("draws a new relation between two object types of the draft", () => {
    const create = suggestion({
      apply: {
        cardinality: "many_to_one",
        description: "",
        kind: "create_relation",
        mapping: [],
        name: "Customer",
        source: "sales_orders",
        target: "customers",
      },
    });
    expect(previewEdges(create, draft)).toEqual([
      { id: "preview:s1", name: "Customer", sourceId: "sales_orders", targetId: "customers" },
    ]);
    // An end the draft no longer has draws nothing; nor does a settled suggestion.
    expect(
      previewEdges(
        { ...create, apply: { ...(create.apply as object), target: "gone" } as never },
        draft,
      ),
    ).toEqual([]);
    expect(previewEdges({ ...create, status: "applied" }, draft)).toEqual([]);
  });

  it("previews a drafted relation it would adopt in place", () => {
    const adopt = suggestion({
      apply: { kind: "adopt_relation", relationTypeId: "sales_orders_to_customers" },
      kind: "adopt_relation",
    });
    expect(previewEdges(adopt, draft)).toEqual([
      {
        id: "sales_orders_to_customers",
        name: "sales_orders_to_customers",
        sourceId: "sales_orders",
        targetId: "customers",
      },
    ]);
  });

  it("draws nothing for other suggestions", () => {
    expect(
      previewEdges(
        suggestion({ apply: { kind: "exclude_object", objectTypeId: "customers" } }),
        draft,
      ),
    ).toEqual([]);
    expect(previewEdges(null, draft)).toEqual([]);
  });
});

describe("fieldLabel", () => {
  it("names a field by its display name, on its object type first", () => {
    const named = mapDraft(mockDraft("p1"));
    named.items.objectTypes[0].properties[0].displayName = "客户编码";
    expect(fieldLabel(named, "customers", "customer_id")).toBe("客户编码");
    expect(fieldLabel(named, undefined, "customer_id")).toBe("客户编码");
    expect(fieldLabel(named, "customers", "unknown_field")).toBe("unknown_field");
  });
});

describe("percent and writebackGroups", () => {
  it("rounds a share and has none of nothing", () => {
    expect(percent(9, 16)).toBe(56);
    expect(percent(0, 0)).toBeNull();
  });

  it("orders the drafted properties by the decision-tracking roles", () => {
    const groups = writebackGroups([
      { displayName: "结果", name: "o", role: "outcome", type: "string" },
      { displayName: "编号", name: "i", role: "id", type: "string" },
      { displayName: "预测单", name: "f", role: "tracked", type: "string" },
      { displayName: "备注", name: "o2", role: "outcome", type: "string" },
    ]);
    expect(groups.map((group) => [group.role, group.properties.map((p) => p.name)])).toEqual([
      ["tracked", ["f"]],
      ["id", ["i"]],
      ["outcome", ["o", "o2"]],
    ]);
  });
});
