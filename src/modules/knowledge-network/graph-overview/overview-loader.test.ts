/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { CypherQuery, CypherResult, ObjectTypeMeta } from "./overview.service";

import { loadOverview } from "./overview-loader";
import type { OverviewRelation } from "./overview-queries";

type Row = Record<string, unknown>;

function meta(id: string, extra: Partial<ObjectTypeMeta> = {}): ObjectTypeMeta {
  return {
    id,
    name: id,
    primaryKeys: ["k"],
    properties: [{ name: "k" }, { name: "name" }],
    ...extra,
  };
}

/** A network in memory: instances per type and relation instances as [source key, target key]. */
function fakeNetwork(
  instances: Record<string, string[]>,
  links: Record<string, { rel: OverviewRelation; pairs: [string, string][] }>,
  options: { fail?: (query: string) => boolean } = {},
) {
  const queries: string[] = [];
  const runCypher = async ({ query }: CypherQuery): Promise<CypherResult> => {
    // A network answers asynchronously; the loader must not depend on it answering at once.
    await Promise.resolve();
    queries.push(query);
    if (options.fail?.(query)) throw new Error("boom");
    const skip = Number(/SKIP (\d+)/.exec(query)?.[1] ?? 0);
    const limit = Number(/LIMIT (\d+)/.exec(query)?.[1] ?? Infinity);
    const page = (rows: Row[]) => rows.slice(skip, skip + limit);
    const relMatch = /\[:`([^`]+)`\]/.exec(query);
    if (relMatch) {
      const { pairs } = links[relMatch[1]];
      if (query.includes("count(*)")) return { columns: [], entries: [{ n: pairs.length }] };
      const sorted = [...pairs].sort(
        ([a1, b1], [a2, b2]) => a1.localeCompare(a2) || b1.localeCompare(b2),
      );
      return {
        columns: [],
        entries: page(
          sorted.map(([a, b]) => ({
            a__k: a,
            a__name: `n${a}`,
            b__k: b,
            b__name: `n${b}`,
          })),
        ),
      };
    }
    const otId = /MATCH \(t:`([^`]+)`\)/.exec(query)?.[1] ?? "";
    const keys = [...(instances[otId] ?? [])].sort();
    if (query.includes("count(*)")) return { columns: [], entries: [{ n: keys.length }] };
    return {
      columns: [],
      entries: page(keys.map((k) => ({ t__k: k, t__name: `n${k}` }))),
    };
  };
  return { runCypher, queries };
}

const A = meta("a");
const B = meta("b");
const relAB: OverviewRelation = {
  id: "ab",
  name: "ab",
  sourceOtId: "a",
  targetOtId: "b",
};
const relAA: OverviewRelation = {
  id: "aa",
  name: "aa",
  sourceOtId: "a",
  targetOtId: "a",
};

describe("loadOverview", () => {
  it("draws everything, isolated instances included, when the network fits", async () => {
    const net = fakeNetwork(
      { a: ["1", "2", "3"], b: ["x", "y"] },
      {
        ab: {
          rel: relAB,
          pairs: [
            ["1", "x"],
            ["2", "x"],
          ],
        },
      },
    );
    const data = await loadOverview({
      metas: { a: A, b: B },
      relations: [relAB],
      labels: {},
      runCypher: net.runCypher,
    });
    expect(data.nodes.map((node) => node.id).sort()).toEqual(["a-1", "a-2", "a-3", "b-x", "b-y"]);
    expect(data.edges.map((edge) => edge.id).sort()).toEqual(["a-1|ab|b-x", "a-2|ab|b-x"]);
    expect(data.complete).toBe(true);
    expect(data.limitedBy).toBeNull();
    expect(data.typeTotals).toEqual({ a: 3, b: 2 });
    expect(data.relationTotals).toEqual({ ab: 2 });
    expect(data.nodes.find((node) => node.id === "a-1")?.display).toBe("n1");
  });

  it("stops at the point budget, keeps lines among drawn points and adds no isolated ones", async () => {
    const pairs: [string, string][] = Array.from({ length: 10 }, (_, i) => [String(i), "x"]);
    const net = fakeNetwork(
      { a: pairs.map(([k]) => k), b: ["x", "z"] },
      { ab: { rel: relAB, pairs } },
    );
    const data = await loadOverview({
      metas: { a: A, b: B },
      relations: [relAB],
      labels: {},
      runCypher: net.runCypher,
      limits: { nodes: 4, pageSize: 100 },
    });
    expect(data.nodes).toHaveLength(4);
    expect(data.edges).toHaveLength(3);
    expect(data.limitedBy).toBe("nodes");
    expect(data.complete).toBe(false);
    expect(data.nodes.some((node) => node.id === "b-z")).toBe(false);
  });

  it("reads every relation type page by page until each runs out", async () => {
    const big: [string, string][] = Array.from({ length: 5 }, (_, i) => [String(i), "x"]);
    const net = fakeNetwork(
      { a: ["0", "1", "2", "3", "4", "9"], b: ["x"] },
      {
        ab: { rel: relAB, pairs: big },
        aa: { rel: relAA, pairs: [["9", "0"]] },
      },
    );
    const data = await loadOverview({
      metas: { a: A, b: B },
      relations: [relAB, relAA],
      labels: {},
      runCypher: net.runCypher,
      limits: { pageSize: 2, concurrency: 1 },
    });
    const pages = net.queries.filter((query) => query.includes("ORDER BY") && query.includes("[:"));
    expect(pages.filter((query) => query.includes("[:`aa`]"))).toHaveLength(1);
    expect(pages.filter((query) => query.includes("[:`ab`]"))).toHaveLength(3);
    expect(data.edges).toHaveLength(6);
    expect(data.complete).toBe(true);
  });

  it("gives every relation type a share before one of them spends the budget", async () => {
    const small: [string, string][] = Array.from({ length: 30 }, (_, i) => [`s${i}`, `x${i}`]);
    const large: [string, string][] = Array.from({ length: 300 }, (_, i) => [`l${i}`, "x0"]);
    const net = fakeNetwork(
      { a: [...small, ...large].map(([k]) => k), b: small.map(([, k]) => k) },
      {
        ab: { rel: relAB, pairs: small },
        aa: { rel: relAA, pairs: large.map(([k]) => [k, "s0"]) },
      },
    );
    const data = await loadOverview({
      metas: { a: A, b: B },
      relations: [relAB, relAA],
      labels: {},
      runCypher: net.runCypher,
      limits: { nodes: 40, pageSize: 1000, minPageSize: 1 },
    });
    const perRelation = new Map<string, number>();
    for (const edge of data.edges)
      perRelation.set(edge.relTypeId, (perRelation.get(edge.relTypeId) ?? 0) + 1);
    expect(perRelation.get("ab")).toBeGreaterThan(0);
    expect(perRelation.get("aa")).toBeGreaterThan(0);
    expect(data.nodes).toHaveLength(40);
  });

  it("stops at the line budget", async () => {
    const pairs: [string, string][] = Array.from({ length: 6 }, (_, i) => [String(i), "x"]);
    const net = fakeNetwork({ a: pairs.map(([k]) => k), b: ["x"] }, { ab: { rel: relAB, pairs } });
    const data = await loadOverview({
      metas: { a: A, b: B },
      relations: [relAB],
      labels: {},
      runCypher: net.runCypher,
      limits: { edges: 2 },
    });
    expect(data.edges).toHaveLength(2);
    expect(data.limitedBy).toBe("edges");
    expect(data.complete).toBe(false);
  });

  it("skips a failing relation type, reports it, and does not claim completeness", async () => {
    const net = fakeNetwork(
      { a: ["1"], b: ["x"] },
      {
        ab: { rel: relAB, pairs: [["1", "x"]] },
        aa: { rel: relAA, pairs: [["1", "1"]] },
      },
      { fail: (query) => query.includes("[:`aa`]") },
    );
    const data = await loadOverview({
      metas: { a: A, b: B },
      relations: [relAB, relAA],
      labels: {},
      runCypher: net.runCypher,
    });
    expect(data.failures).toEqual([{ kind: "relation", id: "aa", message: "boom" }]);
    expect(data.relationTotals.aa).toBeNull();
    expect(data.edges).toHaveLength(1);
    expect(data.complete).toBe(false);
  });

  it("leaves out object types without a primary key and relations touching them", async () => {
    const net = fakeNetwork({ a: ["1"] }, {});
    const data = await loadOverview({
      metas: { a: A, n: meta("n", { primaryKeys: [] }) },
      relations: [{ id: "an", name: "an", sourceOtId: "a", targetOtId: "n" }],
      labels: {},
      runCypher: net.runCypher,
    });
    expect(net.queries.some((query) => query.includes(":`n`") || query.includes(":`an`"))).toBe(
      false,
    );
    expect(data.nodes.map((node) => node.id)).toEqual(["a-1"]);
    expect(data.failures).toEqual([{ kind: "type", id: "n", message: "no primary key" }]);
  });

  it("names a node by the configured label property", async () => {
    const net = fakeNetwork({ a: ["1"], b: [] }, {});
    const data = await loadOverview({
      metas: { a: A },
      relations: [],
      labels: { a: "name" },
      runCypher: net.runCypher,
    });
    expect(data.nodes[0].display).toBe("n1");
  });

  it("gives up when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const net = fakeNetwork({ a: ["1"] }, {});
    await expect(
      loadOverview({
        metas: { a: A },
        relations: [],
        labels: {},
        runCypher: net.runCypher,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("reads one page of a relation with far more rows than its ends have instances", async () => {
    // Every a linked to every b: 30 × 30 = 900 rows over 60 instances.
    const as = Array.from({ length: 30 }, (_, i) => `a${i}`);
    const bs = Array.from({ length: 30 }, (_, i) => `b${i}`);
    const pairs = as.flatMap((a) => bs.map((b) => [a, b] as [string, string]));
    const net = fakeNetwork({ a: as, b: bs }, { ab: { rel: relAB, pairs } });
    const data = await loadOverview({
      metas: { a: A, b: B },
      relations: [relAB],
      labels: {},
      runCypher: net.runCypher,
      limits: { pageSize: 100, minPageSize: 100, concurrency: 3 },
    });
    // One page, or two when the first answered before the counts did.
    const pages = net.queries.filter((q) => q.includes("ORDER BY") && q.includes("[:"));
    expect(pages.length).toBeLessThanOrEqual(2);
    expect(data.saturated).toEqual(["ab"]);
    expect(data.complete).toBe(false);
  });
});
