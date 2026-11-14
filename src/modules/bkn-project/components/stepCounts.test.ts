/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  modelObjectCount,
  questionCount,
  requirementConceptCount,
  tableCount,
} from "@/modules/bkn-project/components/stepCounts";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { UnderstandingCatalog } from "@/modules/bkn-project/types/publish";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

const draft = (objectTypes: { adopted: boolean; id: string }[]) =>
  ({ items: { objectTypes, relationTypes: [] }, status: "ready" }) as unknown as Draft;

describe("stepCounts", () => {
  it("counts the tables of every catalog", () => {
    expect(
      tableCount([
        { tables: [{}, {}] },
        { tables: [{}] },
        { tables: [] },
      ] as unknown as UnderstandingCatalog[]),
    ).toBe(3);
  });

  it("counts the model as the network's with what the project adds and adopted", () => {
    const network = new Set(["regions", "plants"]);
    const ready = draft([
      { adopted: true, id: "regions" },
      { adopted: true, id: "orders" },
      { adopted: false, id: "notes" },
    ]);
    expect(modelObjectCount(ready, network)).toBe(3);
    // Before a draft, the network's own model.
    expect(modelObjectCount(null, network)).toBe(2);
    // A new network counts the adopted object types; nothing before a draft.
    expect(modelObjectCount(ready, new Set())).toBe(2);
    expect(modelObjectCount(null, null)).toBeUndefined();
  });

  it("counts the questions of a ready specification only", () => {
    expect(
      questionCount({ spec: { questions: [{}, {}] }, status: "ready" } as unknown as Requirements),
    ).toBe(2);
    expect(questionCount({ status: "drafting" } as unknown as Requirements)).toBeUndefined();
    expect(questionCount(null)).toBeUndefined();
  });
});

describe("requirementConceptCount", () => {
  it("counts the requirement concepts as the concept page lists them, evidence left out", () => {
    expect(
      requirementConceptCount([
        { category: "object" },
        { category: "kinetic" },
        { category: "not_ontology" },
        { category: "evidence" },
      ]),
    ).toBe(3);
  });
});
