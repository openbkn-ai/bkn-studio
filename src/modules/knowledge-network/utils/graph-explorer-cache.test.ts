/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { GEdge, GNode } from "@/modules/knowledge-network/services/graph-explorer.service";

import { CACHE_VERSION, DEFAULT_SETTINGS, cacheKey, clearCache, readCache, writeCache, type CacheStorage } from "./graph-explorer-cache";

function memoryStorage(failOnLength?: number): CacheStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (failOnLength !== undefined && value.length > failOnLength) throw new DOMException("quota", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const node = (id: string): GNode => ({ id, otId: "ot", otName: "OT", identity: { k: id }, display: id, props: { k: id } });
const edge = (s: string, t: string): GEdge => ({ id: `${s}|r|${t}`, source: s, target: t, relTypeId: "r", relTypeName: "R" });

describe("graph explorer cache", () => {
  it("round-trips nodes, edges, positions and settings", () => {
    const storage = memoryStorage();
    const snapshot = {
      nodes: [node("a"), node("b")],
      edges: [edge("a", "b")],
      positions: { a: { x: 1, y: 2 }, b: { x: 3, y: 4, fixed: true } },
      settings: { layout: "dagre" as const, shape: "rect" as const, labelByOt: { ot: "k" }, colorByOt: { ot: 2 }, showNodeLabels: true, showEdgeLabels: false },
    };
    expect(writeCache("kn1", snapshot, storage)).toBe("saved");
    expect(readCache("kn1", storage)).toEqual({ version: CACHE_VERSION, ...snapshot });
  });

  it("returns null for a missing or corrupt entry", () => {
    const storage = memoryStorage();
    expect(readCache("kn1", storage)).toBeNull();
    storage.data.set(cacheKey("kn1"), "{not json");
    expect(readCache("kn1", storage)).toBeNull();
  });

  it("keeps only recognisable settings on a version mismatch", () => {
    const storage = memoryStorage();
    storage.data.set(
      cacheKey("kn1"),
      JSON.stringify({ version: 99, nodes: [node("a")], settings: { layout: "grid", shape: "bogus", labelByOt: { ot: "k", bad: 1 } } }),
    );
    expect(readCache("kn1", storage)).toEqual({
      version: CACHE_VERSION,
      nodes: [],
      edges: [],
      positions: {},
      settings: { ...DEFAULT_SETTINGS, layout: "grid", labelByOt: { ot: "k" }, colorByOt: {} },
    });
  });

  it("drops edges and positions that point at unknown nodes", () => {
    const storage = memoryStorage();
    storage.data.set(
      cacheKey("kn1"),
      JSON.stringify({
        version: CACHE_VERSION,
        nodes: [node("a")],
        edges: [edge("a", "ghost")],
        positions: { a: { x: 0, y: 0 }, ghost: { x: 9, y: 9 }, a2: { x: "no", y: 1 } },
        settings: DEFAULT_SETTINGS,
      }),
    );
    const snapshot = readCache("kn1", storage);
    expect(snapshot?.edges).toEqual([]);
    expect(snapshot?.positions).toEqual({ a: { x: 0, y: 0 } });
  });

  it("falls back to settings only when the full payload exceeds the quota", () => {
    const storage = memoryStorage(400);
    const nodes = Array.from({ length: 20 }, (_, index) => node(`n${index}`));
    const outcome = writeCache("kn1", { nodes, edges: [], positions: {}, settings: { ...DEFAULT_SETTINGS, layout: "radial" } }, storage);
    expect(outcome).toBe("settings-only");
    const snapshot = readCache("kn1", storage);
    expect(snapshot?.nodes).toEqual([]);
    expect(snapshot?.settings.layout).toBe("radial");
  });

  it("clears the entry", () => {
    const storage = memoryStorage();
    writeCache("kn1", { nodes: [], edges: [], positions: {}, settings: DEFAULT_SETTINGS }, storage);
    clearCache("kn1", storage);
    expect(readCache("kn1", storage)).toBeNull();
  });

  it("reports unavailable storage without throwing", () => {
    expect(writeCache("kn1", { nodes: [], edges: [], positions: {}, settings: DEFAULT_SETTINGS }, null)).toBe("unavailable");
    expect(readCache("kn1", null)).toBeNull();
    expect(() => clearCache("kn1", null)).not.toThrow();
  });
});
