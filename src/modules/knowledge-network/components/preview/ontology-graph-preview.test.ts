/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { readGraphTokens } from "@/modules/knowledge-network/lib/graph-style";
import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import { layoutOntologyGraph } from "@/modules/knowledge-network/utils/ontology-graph-layout";

import {
  buildOntologyDecorations,
  buildOntologyStructure,
  withPreviewEdges,
} from "./ontology-graph-data";

const graph: KnowledgeNetworkPreviewGraph = {
  edges: [{ id: "ab", name: "ab", sourceId: "a", targetId: "b" }],
  nodes: [
    { color: "", id: "a", name: "A" },
    { color: "", id: "b", name: "B" },
    { color: "", highlighted: true, id: "c", name: "C" },
  ],
};
const tokens = readGraphTokens();

describe("withPreviewEdges", () => {
  it("adds a new relation between drawn types and marks a drawn one in place", () => {
    const previewed = withPreviewEdges(graph, [
      { id: "ab", name: "ab", sourceId: "a", targetId: "b" },
      { id: "preview:1", name: "New", sourceId: "c", targetId: "a" },
      { id: "preview:2", name: "Gone", sourceId: "c", targetId: "x" },
    ]);
    expect(previewed.edges).toEqual([
      { id: "ab", name: "ab", preview: true, sourceId: "a", targetId: "b" },
      { id: "preview:1", name: "New", preview: true, sourceId: "c", targetId: "a" },
    ]);
  });
});

describe("previewed relations and highlighted types", () => {
  const previewed = withPreviewEdges(graph, [
    { id: "preview:1", name: "New", sourceId: "c", targetId: "a" },
  ]);
  const layout = layoutOntologyGraph(graph, "force", undefined);
  const structure = buildOntologyStructure({
    graph: previewed,
    layout,
    renderMode: "force",
    tokens,
    ungroupedLabel: "",
  });

  it("rings a highlighted type in the warning colour", () => {
    const style = (id: string) => structure.nodes.find((node) => node.id === id)?.style;
    expect(style("c")).toMatchObject({ lineWidth: 3, stroke: tokens.warning });
    expect(style("a")).toMatchObject({ lineWidth: 1.5, stroke: tokens.inverse });
  });

  it("draws a previewed relation dashed in the success colour, sizing no dot by it", () => {
    const edge = structure.edges.find((item) => item.id === "preview:1")?.style;
    expect(edge).toMatchObject({ lineDash: [6, 4], opacity: 1, stroke: tokens.success });
    const size = (id: string) => structure.nodes.find((node) => node.id === id)?.style?.size;
    const plain = buildOntologyStructure({
      graph,
      layout,
      renderMode: "force",
      tokens,
      ungroupedLabel: "",
    });
    expect(size("c")).toBe(plain.nodes.find((node) => node.id === "c")?.style?.size);
  });

  it("names a previewed relation even with relation names off", () => {
    const decorations = buildOntologyDecorations({
      defaultEdgeName: "",
      edgeLabelsVisible: false,
      graph: previewed,
      hubId: null,
      indexedIds: new Set(),
      selectedId: null,
      zoom: 1,
    });
    const label = (id: string) =>
      decorations.edges.find((edge) => edge.id === id)?.style?.labelText;
    expect(label("preview:1")).toBe("New");
    expect(label("ab")).toBe("");
  });
});
