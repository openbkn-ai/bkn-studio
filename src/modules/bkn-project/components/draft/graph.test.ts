/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";

import { draftGraph } from "./graph";

describe("draft concept graph", () => {
  it("draws only what is adopted, and no relation to an end that is not", () => {
    const graph = draftGraph(mapDraft(mockDraft("p1")));
    expect(graph.nodes.map((node) => node.id)).toEqual(["customers", "sales_orders"]);
    // material_bom_to_sales_orders is adopted, but material_bom is not.
    expect(graph.edges).toEqual([
      {
        id: "sales_orders_to_customers",
        name: expect.any(String) as string,
        sourceId: "sales_orders",
        targetId: "customers",
      },
    ]);
  });

  it("leaves out a relation that is not adopted, even between adopted ends", () => {
    const draft = mapDraft(mockDraft("p1"));
    draft.items.relationTypes[0].adopted = false;
    expect(draftGraph(draft).edges).toEqual([]);
  });

  it("colors nodes with the theme, not a fixed color", () => {
    const graph = draftGraph(mapDraft(mockDraft("p1")));
    expect(graph.nodes.every((node) => node.color.startsWith("var(--"))).toBe(true);
  });
});
