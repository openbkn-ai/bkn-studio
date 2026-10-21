/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { buildGraphOption, densityFor, typeColors } from "./graph-option";
import {
  EMPTY_GRAPH_STYLE,
  captionKeys,
  type FrameGraphSettings,
  loadGraphStyle,
  saveGraphStyle,
  setEdgeStyle,
  setNodeStyle,
} from "./graph-style";
import type { CypherGraph } from "./graph-values";

function graph(nodes: number, edges = 0): CypherGraph {
  const list = Array.from({ length: nodes }, (_, index) => ({
    id: `n${index}`,
    objectTypeId: index === 0 ? "hub" : "leaf",
    objectTypeName: index === 0 ? "Hub" : "Leaf",
    label: `n${index}`,
    key: { id: index },
    properties: {},
  }));
  return {
    nodes: list,
    edges: Array.from({ length: edges }, (_, index) => ({
      id: `e${index}`,
      source: "n0",
      target: `n${(index % (nodes - 1)) + 1}`,
      name: "LINKS",
      derived: false,
    })),
    totalNodes: nodes,
  };
}

beforeEach(() => localStorage.clear());

describe("graph style", () => {
  it("sets and clears a type's style and keeps it per network", () => {
    let style = setNodeStyle(EMPTY_GRAPH_STYLE, "teams", {
      color: "#ee6666",
      caption: "team_name",
    });
    style = setNodeStyle(style, "teams", { color: undefined });
    style = setEdgeStyle(style, "LINKS", "#5470c6");
    expect(style.nodes.teams).toEqual({ caption: "team_name" });
    expect(captionKeys(style)).toEqual({ teams: "team_name" });

    saveGraphStyle("kn_a", { ...style, nodeLimit: 800 });
    expect(loadGraphStyle("kn_a")).toEqual({ ...style, nodeLimit: 800 });
    expect(buildGraphOption(graph(2), style, { dragMode: "force" }).dragMode).toBe("force");
    expect(buildGraphOption(graph(2)).dragMode).toBe("fixed");
    expect(loadGraphStyle("kn_b")).toEqual(EMPTY_GRAPH_STYLE);
  });

  it("draws types in their chosen color and size, and edges in theirs", () => {
    const style = setEdgeStyle(
      setNodeStyle(EMPTY_GRAPH_STYLE, "hub", { color: "#ee6666", size: "l" }),
      "LINKS",
      "#5470c6",
    );
    const { data } = buildGraphOption(graph(3, 2), style);
    const nodes = data.nodes ?? [];
    expect(nodes[0].style?.fill).toBe("#ee6666");
    expect(nodes[1].style?.fill).not.toBe("#ee6666");
    expect(Number(nodes[0].style?.size)).toBeGreaterThan(Number(nodes[1].style?.size));
    expect((data.edges ?? []).every((edge) => edge.style?.stroke === "#5470c6")).toBe(true);
  });

  it("keeps a type's color whatever order the rows come in", () => {
    const forward = graph(3);
    const reversed = { ...forward, nodes: [...forward.nodes].reverse() };
    expect(typeColors(reversed)).toEqual(typeColors(forward));
  });

  it("shrinks nodes and drops arrows for large graphs, and follows the label setting", () => {
    expect(densityFor(500).size).toBeLessThan(densityFor(20).size);
    const edgesOf = (settings: FrameGraphSettings = {}) =>
      buildGraphOption(graph(300, 299), EMPTY_GRAPH_STYLE, settings).data.edges ?? [];
    expect(edgesOf().every((edge) => !edge.style?.endArrow && !edge.style?.labelText)).toBe(true);
    const forced = edgesOf({ edgeLabels: "on" });
    expect(forced.every((edge) => edge.style?.labelText === "LINKS")).toBe(true);
  });
});
