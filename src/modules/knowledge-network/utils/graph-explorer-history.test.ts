/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { GNode } from "@/modules/knowledge-network/services/graph-explorer.service";

import { pushHistory, pushSnapshot, takeSnapshot, truncateForDisplay, type CanvasSnapshot, type HistoryEntry } from "./graph-explorer-history";

const node = (id: string): GNode => ({ id, otId: "ot", otName: "OT", identity: { k: id }, display: id, props: {} });

describe("undo stack", () => {
  it("copies the maps so later mutations do not leak into the snapshot", () => {
    const nodes = new Map([["a", node("a")]]);
    const positions = { a: { x: 1, y: 2 } };
    const snapshot = takeSnapshot(nodes.values(), [], positions);
    nodes.set("b", node("b"));
    positions.a.x = 99;
    expect(snapshot.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(snapshot.positions.a.x).toBe(1);
  });

  it("drops the oldest snapshot past the limit", () => {
    const stack: CanvasSnapshot[] = [];
    for (let index = 0; index < 5; index += 1) pushSnapshot(stack, { nodes: [node(String(index))], edges: [], positions: {} }, 3);
    expect(stack.map((s) => s.nodes[0].id)).toEqual(["2", "3", "4"]);
  });
});

describe("call history", () => {
  const entry = (id: string): HistoryEntry => ({ id, at: 0, kind: "search", title: id, input: {}, output: {}, ok: true, ms: 1, summary: "" });

  it("prepends and bounds the list", () => {
    let list: HistoryEntry[] = [];
    for (const id of ["a", "b", "c"]) list = pushHistory(list, entry(id), 2);
    expect(list.map((e) => e.id)).toEqual(["c", "b"]);
  });

  it("truncates large payloads with a marker", () => {
    const text = truncateForDisplay({ big: "x".repeat(50) }, 20);
    expect(text.startsWith('{\n  "big": "xxxxx')).toBe(true);
    expect(text).toMatch(/… \(\d+ more characters\)$/);
    expect(truncateForDisplay("short")).toBe("short");
  });
});
