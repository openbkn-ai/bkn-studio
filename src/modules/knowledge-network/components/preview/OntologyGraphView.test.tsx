/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OntologyGraphView } from "./OntologyGraphView";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const graph = {
  nodes: [
    { color: "#2563eb", id: "customer", name: "Customer" },
    { color: "#16a34a", id: "order", name: "Order" },
  ],
  edges: [{ id: "places", name: "Places", sourceId: "customer", targetId: "order" }],
};

describe("OntologyGraphView", () => {
  it("renders grid dots and edge markers through theme-aware CSS classes", () => {
    const { container } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const gridDot = container.querySelector("pattern circle");
    const edgeArrows = container.querySelectorAll("marker path");

    expect(gridDot?.getAttribute("class")).toContain("gridDot");
    expect(gridDot?.hasAttribute("fill")).toBe(false);
    expect(edgeArrows[0]?.getAttribute("class")).toContain("edgeArrow");
    expect(edgeArrows[0]?.hasAttribute("fill")).toBe(false);
    expect(edgeArrows[1]?.getAttribute("class")).toContain("edgeArrowActive");
    expect(screen.getByText("Places").getAttribute("class")).toContain("edgeLabel");

    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewHideEdgeLabels"));
    const relationLine = container.querySelector("g[class*='edge'] > line");
    expect(relationLine).toHaveAttribute("marker-end", "url(#kn-onto-arrow)");
  });

  it("uses a scalable canvas and limits low-detail DOM nodes for large graphs", () => {
    const nodes = Array.from({ length: 1_300 }, (_, index) => ({
      color: "#2563eb",
      id: `node-${index}`,
      name: `Node ${index}`,
    }));
    const edges = Array.from({ length: 1_298 }, (_, index) => ({
      id: `edge-${index}`,
      name: "connects",
      sourceId: `node-${index}`,
      targetId: `node-${index + 2}`,
    }));
    const { container } = render(
      <OntologyGraphView
        graph={{ edges, nodes }}
        indexedIds={new Set()}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const svg = screen.getByLabelText("knowledgeNetwork.previewCanvas");
    const [, , width] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
    expect(width).toBeGreaterThan(1_000);
    expect(Number(svg.getAttribute("data-rendered-nodes"))).toBeLessThanOrEqual(1_200);
    expect(svg).toHaveAttribute("data-total-nodes", "1300");
    const relationLines = container.querySelectorAll("g[class*='edge'] > line");
    expect(relationLines.length).toBeGreaterThan(0);
    relationLines.forEach((line) =>
      expect(line).toHaveAttribute("marker-end", "url(#kn-onto-arrow)"),
    );
    expect(screen.getByTitle("knowledgeNetwork.previewRearrange")).toHaveTextContent(
      "knowledgeNetwork.previewLayoutForce",
    );
  });

  it("dims unrelated relations instead of removing them when a node is selected", () => {
    const { container } = render(
      <OntologyGraphView
        graph={{
          nodes: [...graph.nodes, { color: "#f59e0b", id: "product", name: "Product" }],
          edges: [
            ...graph.edges,
            { id: "contains", name: "Contains", sourceId: "order", targetId: "product" },
          ],
        }}
        indexedIds={new Set()}
        selectedId="customer"
        onSelect={vi.fn()}
      />,
    );

    const relationLines = container.querySelectorAll("g[class*='edge'] > line");
    expect(relationLines).toHaveLength(2);
    expect(
      [...relationLines].some((line) =>
        line.parentElement?.getAttribute("class")?.includes("edgeDim"),
      ),
    ).toBe(true);
  });

  it("offers logical grouping only when group memberships are available", async () => {
    const { rerender } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewRearrange"));
    expect(screen.queryByText("knowledgeNetwork.previewLayoutGroup")).toBeNull();

    rerender(
      <OntologyGraphView
        graph={graph}
        groupNames={new Map([["sales", "Sales"]])}
        groupOf={new Map(graph.nodes.map((node) => [node.id, "sales"]))}
        indexedIds={new Set()}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const groupOption = await screen.findByText("knowledgeNetwork.previewLayoutGroup");
    fireEvent.click(groupOption);

    await waitFor(() => expect(screen.getByText("Sales")).toBeInTheDocument());
  });
});
