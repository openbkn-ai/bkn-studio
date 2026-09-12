/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { CHAIN_COL_GAP, chainPositions, connectedParts, hopLevels } from "./chain-layout";

describe("connectedParts", () => {
  it("splits the graph where no relation joins it", () => {
    const parts = connectedParts(["a", "b", "c", "d", "e"], [
      { source: "a", target: "b" },
      { source: "c", target: "d" },
    ]);
    expect(parts).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });
});

describe("hopLevels", () => {
  it("numbers a chain from the node nothing points at", () => {
    const level = hopLevels(["a", "b", "c"], [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ]);
    expect([level.get("a"), level.get("b"), level.get("c")]).toEqual([0, 1, 2]);
  });

  it("puts every target of one node in the same hop", () => {
    const level = hopLevels(["a", "b", "c"], [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
    ]);
    expect([level.get("b"), level.get("c")]).toEqual([1, 1]);
  });

  it("still numbers a part that is one cycle", () => {
    const level = hopLevels(["a", "b"], [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ]);
    expect(level.get("a")).toBe(0);
    expect(level.get("b")).toBe(1);
  });
});

describe("chainPositions", () => {
  it("runs a chain left to right on one line", () => {
    const points = chainPositions(["a", "b", "c"], [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ]);
    expect(points.get("a")).toEqual({ x: 0, y: 0 });
    expect(points.get("b")).toEqual({ x: CHAIN_COL_GAP, y: 0 });
    expect(points.get("c")).toEqual({ x: CHAIN_COL_GAP * 2, y: 0 });
  });

  it("stacks separate chains without letting them overlap", () => {
    const points = chainPositions(["a", "b", "c", "d"], [
      { source: "a", target: "b" },
      { source: "c", target: "d" },
    ]);
    expect(points.get("a")?.y).toBe(0);
    expect(points.get("c")?.y).toBeGreaterThan(0);
    expect(points.get("a")?.x).toBe(points.get("c")?.x);
  });

  it("gives every node a position, including one nothing connects to", () => {
    const points = chainPositions(["a", "b", "lonely"], [{ source: "a", target: "b" }]);
    expect(points.size).toBe(3);
    expect(points.get("lonely")).toBeDefined();
  });
});
