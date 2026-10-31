/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { GRAPH_PALETTE, readGraphTokens } from "@/modules/knowledge-network/lib/graph-style";
import {
  HUB_RADIUS,
  NODE_RADIUS,
  UNGROUPED_ID,
  layoutOntologyGraph,
} from "@/modules/knowledge-network/utils/ontology-graph-layout";

import {
  buildOntologyDecorations,
  buildOntologyStructure,
  drawnRadius,
  labelScale,
  relationNameAt,
  typeColors,
} from "./ontology-graph-data";

const graph = {
  nodes: [
    { color: "#2563eb", id: "customer", name: "Customer" },
    { color: "#16a34a", id: "order", name: "Order" },
    { color: "", id: "product", name: "Product" },
  ],
  edges: [
    { id: "places", name: "Places", sourceId: "customer", targetId: "order" },
    { id: "contains", name: "", sourceId: "order", targetId: "product" },
  ],
};
const tokens = readGraphTokens();
const layout = layoutOntologyGraph(graph, "force", undefined);

const decorate = (overrides: Partial<Parameters<typeof buildOntologyDecorations>[0]> = {}) =>
  buildOntologyDecorations({
    graph,
    hubId: layout.hubId,
    selectedId: null,
    indexedIds: new Set(),
    edgeLabelsVisible: true,
    zoom: 1,
    defaultEdgeName: "relation",
    ...overrides,
  });

describe("buildOntologyStructure", () => {
  it("draws a faded type faint and a faded relation faint and dashed", () => {
    const structure = buildOntologyStructure({
      graph: {
        nodes: graph.nodes.map((node) => (node.id === "product" ? { ...node, faded: true } : node)),
        edges: graph.edges.map((edge) =>
          edge.id === "contains" ? { ...edge, faded: true } : edge,
        ),
      },
      layout,
      renderMode: "force",
      tokens,
      ungroupedLabel: "Ungrouped",
    });
    const node = (id: string) => structure.nodes.find((item) => item.id === id)?.style;
    const edge = (id: string) => structure.edges.find((item) => item.id === id)?.style;
    expect(node("product")?.opacity).toBeLessThan(1);
    expect(node("order")?.opacity).toBe(1);
    expect(edge("contains")?.opacity).toBeLessThan(1);
    expect(edge("contains")?.lineDash).toEqual([4, 4]);
    expect(edge("places")?.lineDash).toBeUndefined();
  });

  it("places every object type at its arranged position in its own colour", () => {
    const structure = buildOntologyStructure({
      graph,
      layout,
      renderMode: "force",
      tokens,
      ungroupedLabel: "Ungrouped",
    });

    expect(structure.nodes).toHaveLength(3);
    const order = structure.nodes.find((node) => node.id === "order");
    expect(order?.style?.x).toBe(layout.positions.get("order")?.x);
    expect(order?.style?.fill).toBe("#16a34a");
    // Relations stay one grey whatever the types' colours.
    expect(structure.edges[0].style?.stroke).toBe(tokens.faint);
    // A type without a colour of its own takes the first palette slot.
    expect(structure.nodes.find((node) => node.id === "product")?.style?.fill).toBe(
      GRAPH_PALETTE[0],
    );
    // "order" has two relations, the most: it is drawn as the hub, larger than the others.
    const customer = structure.nodes.find((node) => node.id === "customer");
    expect(Number(order?.style?.size)).toBeGreaterThan(Number(customer?.style?.size));
    expect(structure.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["customer", "order"],
      ["order", "product"],
    ]);
    expect(structure.combos).toEqual([]);
    // Names sit under the dots in every arrangement.
    expect(structure.nodes[0].style?.labelPlacement).toBe("bottom");
    // A dimmed element can only come back if its normal opacity is stated.
    expect(structure.nodes.every((node) => node.style?.opacity === 1)).toBe(true);
    expect(structure.edges.every((edge) => edge.style?.opacity === 1)).toBe(true);
  });

  it("boxes each concept group, the ungrouped types in one of their own", () => {
    const groupOf = new Map([
      ["customer", "sales"],
      ["order", "sales"],
    ]);
    const structure = buildOntologyStructure({
      graph,
      layout: layoutOntologyGraph(graph, "group", groupOf),
      renderMode: "group",
      groupOf,
      groupNames: new Map([["sales", "Sales"]]),
      tokens,
      ungroupedLabel: "Ungrouped",
    });

    expect(structure.combos.map((combo) => [combo.id, combo.style?.labelText])).toEqual([
      [UNGROUPED_ID, "Ungrouped"],
      ["sales", "Sales"],
    ]);
    expect(structure.nodes.find((node) => node.id === "product")?.combo).toBe(UNGROUPED_ID);
    expect(structure.nodes.find((node) => node.id === "order")?.combo).toBe("sales");
    // In the grid of a group box the name goes under the dot, clear of the next type.
    expect(structure.nodes[0].style?.labelPlacement).toBe("bottom");
  });
});

describe("typeColors", () => {
  it("keeps a type's own colour and hands the palette to the rest, the mapping default included", () => {
    const colors = typeColors([
      { id: "a", color: "#16a34a" },
      { id: "b", color: "#1677ff" },
      { id: "c", color: "" },
    ]);
    expect([...colors.values()]).toEqual(["#16a34a", GRAPH_PALETTE[0], GRAPH_PALETTE[1]]);
  });
});

describe("drawnRadius", () => {
  it("grows with the number of relations, within the room the arrangement keeps", () => {
    expect(drawnRadius(0, false)).toBe(10);
    expect(drawnRadius(9, false)).toBeGreaterThan(drawnRadius(4, false));
    expect(drawnRadius(400, false)).toBe(24);
    expect(drawnRadius(400, true)).toBe(30);
    // Within the room the arrangement keeps, so dots never overlap.
    expect(drawnRadius(400, true)).toBeLessThan(HUB_RADIUS);
    expect(drawnRadius(400, false)).toBeLessThan(NODE_RADIUS);
  });
});

describe("buildOntologyDecorations", () => {
  it("dims unrelated relations instead of removing them when a node is selected", () => {
    const { edges, states } = decorate({ selectedId: "customer" });

    expect(edges).toHaveLength(2);
    expect(states).toMatchObject({
      customer: ["selected"],
      order: [],
      product: ["inactive"],
      places: ["active"],
      contains: ["inactive"],
    });
  });

  it("names relations unless hidden, the selected type's relations always", () => {
    expect(decorate().edges.map((edge) => edge.style?.labelText)).toEqual(["Places", "relation"]);
    expect(
      decorate({ edgeLabelsVisible: false, selectedId: "customer" }).edges.map(
        (edge) => edge.style?.labelText,
      ),
    ).toEqual(["Places", ""]);
  });

  it("leaves out a relation name that would cover one already placed, the selection's first", () => {
    // "customer" and "product" sit together, so both relations to "order" meet at one midpoint.
    const positions = new Map([
      ["customer", { id: "customer", x: 0, y: 0 }],
      ["order", { id: "order", x: 100, y: 0 }],
      ["product", { id: "product", x: 0, y: 0 }],
    ]);
    const twin = {
      ...graph,
      edges: [
        { id: "places", name: "Places", sourceId: "customer", targetId: "order" },
        { id: "contains", name: "Contains", sourceId: "product", targetId: "order" },
      ],
    };
    const labels = (selectedId: string | null) =>
      buildOntologyDecorations({
        graph: twin,
        hubId: null,
        positions,
        selectedId,
        indexedIds: new Set(),
        edgeLabelsVisible: true,
        zoom: 1,
        defaultEdgeName: "relation",
      }).edges.map((edge) => edge.style?.labelText);

    expect(labels(null)).toEqual(["Places", ""]);
    // Selected, "product"'s relation takes the spot.
    expect(labels("product")).toEqual(["", "Contains"]);
  });

  it("marks indexed types with a badge", () => {
    const { nodes } = decorate({ indexedIds: new Set(["order"]) });
    expect(nodes.find((node) => node.id === "order")?.style?.badges).toHaveLength(1);
    expect(nodes.find((node) => node.id === "customer")?.style?.badges).toEqual([]);
  });

  it("keeps names readable when zoomed out, and grows them more slowly than the graph", () => {
    expect(labelScale(0.25)).toBe(4);
    expect(labelScale(1)).toBe(1);
    // At 400% a name is drawn twice its size on screen, the dots four times theirs.
    expect(labelScale(4) * 4).toBe(2);
    const node = decorate({ zoom: 0.25 }).nodes[0];
    expect(node.style?.labelFontSize).toBe(11 * 4);
  });

  it("names the best-connected types first and leaves out names that would collide", () => {
    // Three types in a row, close enough that neighbouring names collide when zoomed out.
    const row = {
      nodes: [
        { color: "", id: "a", name: "Alpha" },
        { color: "", id: "b", name: "Bravo" },
        { color: "", id: "c", name: "Charlie" },
      ],
      edges: [
        { id: "ab", name: "", sourceId: "a", targetId: "b" },
        { id: "bc", name: "", sourceId: "b", targetId: "c" },
      ],
    };
    const positions = new Map([
      ["a", { id: "a", x: 0, y: 0 }],
      ["b", { id: "b", x: 60, y: 0 }],
      ["c", { id: "c", x: 120, y: 0 }],
    ]);
    const names = (zoom: number, selectedId: string | null = null, nodeLabelsVisible = true) =>
      buildOntologyDecorations({
        graph: row,
        hubId: null,
        positions,
        selectedId,
        indexedIds: new Set(),
        edgeLabelsVisible: false,
        nodeLabelsVisible,
        zoom,
        defaultEdgeName: "relation",
      }).nodes.map((node) => node.style?.labelText);

    // Zoomed in there is room for every name.
    expect(names(1)).toEqual(["Alpha", "Bravo", "Charlie"]);
    // Zoomed out, the middle type has the most relations and keeps its name; never none at all.
    expect(names(0.2)).toEqual(["", "Bravo", ""]);
    // The selection comes first.
    expect(names(0.2, "c")).toEqual(["", "", "Charlie"]);
    // Names switched off: only the selection and its neighbours are named.
    expect(names(1, "a", false)).toEqual(["Alpha", "Bravo", ""]);
  });

  it("places a relation's name where G6 draws it, above the dot for a type related to itself", () => {
    // Between the dots' edges: a larger source pushes the name toward the target.
    expect(
      relationNameAt({ x: 0, y: 0 }, { x: 100, y: 0 }, false, { source: 20, target: 10 }),
    ).toEqual({ x: 55, y: 0 });
    expect(
      relationNameAt({ x: 0, y: 0 }, { x: 0, y: 0 }, true, { source: 10, target: 10 }),
    ).toEqual({ x: 0, y: -25 });
    // The loop's name does not sit on the type's own name, so both are drawn.
    const looped = buildOntologyDecorations({
      graph: {
        nodes: [{ color: "", id: "staff", name: "Staff" }],
        edges: [{ id: "manages", name: "Manages", sourceId: "staff", targetId: "staff" }],
      },
      hubId: null,
      positions: new Map([["staff", { id: "staff", x: 0, y: 0 }]]),
      selectedId: null,
      indexedIds: new Set(),
      edgeLabelsVisible: true,
      zoom: 1,
      defaultEdgeName: "relation",
    });
    expect(looped.nodes[0].style?.labelText).toBe("Staff");
    expect(looped.edges[0].style?.labelText).toBe("Manages");
  });
});
