/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { layoutChain } from "./chain-layout";
import type { ChainGraph } from "./evidence-chain.types";
const graph: ChainGraph = { nodes: [
  { id: "end", kind: "conclusion", label: "Delay" },
  { id: "source", kind: "source", label: "Delivery date" },
  { id: "object", kind: "object", label: "Product" },
  { id: "calc", kind: "calculation", label: "Date difference" },
  { id: "field", kind: "field", label: "Available date" },
], edges: [] };
describe("semantic graph layout", () => {
  it("groups by business roles, independent of incoming array order", () => {
    const first = layoutChain(graph, "evidence");
    const shuffled = layoutChain({ ...graph, nodes: [...graph.nodes].reverse() }, "evidence");
    expect(first.positions).toEqual(shuffled.positions);
    expect(first.positions.get("end")!.x).toBeLessThan(first.positions.get("field")!.x);
    expect(first.positions.get("field")!.x).toBeLessThan(first.positions.get("source")!.x);
  });
  it("has no overlapping cards, including multiple objects and calculations", () => {
    const expanded = { ...graph, nodes: Array.from({ length: 30 }, (_, i) => ({ ...graph.nodes[i % 5], id: `n${i}` })) };
    const { positions } = layoutChain(expanded, "evidence");
    const boxes = [...positions.values()];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
  });
  it("places explicit execution inputs, process and outputs in different columns", () => {
    const result = layoutChain({ nodes: [{ id: "out", label: "Result", kind: "field", role: "output" }, { id: "in", label: "Demand", kind: "field", role: "input" }, { id: "fn", label: "Evaluation", kind: "function" }], edges: [] }, "execution");
    expect(result.positions.get("in")!.x).toBeLessThan(result.positions.get("fn")!.x);
    expect(result.positions.get("fn")!.x).toBeLessThan(result.positions.get("out")!.x);
  });
});
