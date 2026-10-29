/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  GROUP_COLORS,
  HUB_RADIUS,
  NODE_RADIUS,
  UNGROUPED_ID,
  clusterBounds,
  conceptGroupClusters,
  layoutOntologyGraph,
  renderModeOf,
} from "./ontology-graph-layout";

const nodes = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    color: "#2563eb",
    id: `node-${index}`,
    name: `Node ${index}`,
  }));

describe("renderModeOf", () => {
  it("keeps force up to a thousand types and falls back to a grid past that", () => {
    expect(renderModeOf(1_000, "force", false)).toBe("force");
    expect(renderModeOf(1_001, "force", false)).toBe("grid");
    expect(renderModeOf(2_000, "circle", false)).toBe("circle");
  });

  it("offers the group arrangement only with group memberships", () => {
    expect(renderModeOf(10, "group", false)).toBe("force");
    expect(renderModeOf(10, "group", true)).toBe("group");
  });
});

describe("layoutOntologyGraph", () => {
  it("lays 500 types out by force without two of them on top of each other", () => {
    const graph = {
      nodes: nodes(500),
      edges: Array.from({ length: 499 }, (_, i) => ({
        id: `e${i}`,
        name: "e",
        sourceId: `node-${i + 1}`,
        targetId: `node-${i % 12}`,
      })),
    };
    const layout = layoutOntologyGraph(graph, "force", undefined);
    const points = [...layout.positions.values()];
    let closest = Infinity;
    for (let i = 0; i < points.length; i += 1)
      for (let j = i + 1; j < points.length; j += 1)
        closest = Math.min(
          closest,
          Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y),
        );
    expect(closest).toBeGreaterThan(NODE_RADIUS);
    // Wider than tall.
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
  });

  it("spaces a ring so its types do not overlap however many there are", () => {
    const layout = layoutOntologyGraph({ nodes: nodes(500), edges: [] }, "circle", undefined);
    const [a, b] = [layout.positions.get("node-0"), layout.positions.get("node-1")];
    if (!a || !b) throw new Error("missing");
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(NODE_RADIUS * 2);
  });

  it("spreads concept groups sideways rather than stacking them", () => {
    const groupOf = new Map(nodes(240).map((node, i) => [node.id, `g-${i % 12}`]));
    const layout = layoutOntologyGraph({ nodes: nodes(240), edges: [] }, "group", groupOf);
    expect(layout.canvasWidth).toBeGreaterThan(layout.canvasHeight);
  });

  it("grows the canvas for a large graph and gives the best-connected type the hub size", () => {
    const graph = {
      nodes: nodes(1_300),
      edges: [
        { id: "a", name: "a", sourceId: "node-0", targetId: "node-1" },
        { id: "b", name: "b", sourceId: "node-0", targetId: "node-2" },
      ],
    };
    const layout = layoutOntologyGraph(graph, "grid", undefined);

    expect(layout.canvasWidth).toBeGreaterThan(1_000);
    expect(layout.positions.size).toBe(1_300);
    expect(layout.hubId).toBe("node-0");
    expect(layout.radiusById.get("node-0")).toBe(HUB_RADIUS);
    expect(layout.radiusById.get("node-1")).toBe(NODE_RADIUS);
  });

  it("keeps concept-group boundaries separate and puts the ungrouped types first", () => {
    const groupOf = new Map<string, string>([
      ["node-16", "group-a"],
      ["node-17", "group-a"],
      ["node-18", "group-b"],
      ["node-19", "group-b"],
    ]);
    const graph = { nodes: nodes(20), edges: [] };
    const layout = layoutOntologyGraph(graph, "group", groupOf);
    const clusters = conceptGroupClusters(
      graph.nodes.map((node) => node.id),
      groupOf,
    );

    expect(clusters.map((cluster) => cluster.id)).toEqual([UNGROUPED_ID, "group-a", "group-b"]);
    expect(clusters[0].ungrouped).toBe(true);
    expect(clusters[1].color).toBe(GROUP_COLORS[0]);
    expect(clusters[2].color).toBe(GROUP_COLORS[1]);
    const hulls = clusters.map((cluster) => clusterBounds(cluster.ids, layout));
    hulls.forEach((left, leftIndex) => {
      hulls.slice(leftIndex + 1).forEach((right) => {
        if (!left || !right) throw new Error("missing bounds");
        const separated =
          left.x + left.w <= right.x ||
          right.x + right.w <= left.x ||
          left.y + left.h <= right.y ||
          right.y + right.h <= left.y;
        expect(separated).toBe(true);
      });
    });
  });
});
