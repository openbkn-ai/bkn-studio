/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OntologyG6CanvasProps } from "./OntologyG6Canvas";
import { OntologyGraphView } from "./OntologyGraphView";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// G6 cannot draw in jsdom; the stand-in records what the view hands it.
const canvas: { props: OntologyG6CanvasProps | null } = { props: null };
vi.mock("./OntologyG6Canvas", async () => {
  const { forwardRef } = await import("react");
  return {
    OntologyG6Canvas: forwardRef<unknown, OntologyG6CanvasProps>(function Stub(props) {
      canvas.props = props;
      return (
        <div data-testid="ontology-graph-canvas">
          {props.structure.combos?.map((combo) => (
            <span key={combo.id}>{String(combo.style?.labelText ?? "")}</span>
          ))}
          <button onClick={() => props.onNodeClick("customer")} type="button">
            customer
          </button>
          <button onClick={() => props.onBlankClick()} type="button">
            blank
          </button>
        </div>
      );
    }),
  };
});

const graph = {
  nodes: [
    { color: "#2563eb", id: "customer", name: "Customer" },
    { color: "#16a34a", id: "order", name: "Order" },
  ],
  edges: [{ id: "places", name: "Places", sourceId: "customer", targetId: "order" }],
};

describe("OntologyGraphView", () => {
  it("selects a clicked type, clears it on a second click or a blank click", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        onSelect={onSelect}
        selectedId={null}
      />,
    );

    fireEvent.click(await screen.findByText("customer"));
    expect(onSelect).toHaveBeenLastCalledWith("customer");

    rerender(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        onSelect={onSelect}
        selectedId="customer"
      />,
    );
    fireEvent.click(screen.getByText("customer"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByText("blank"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("shows relation names from the toolbar, on a crowded graph too", async () => {
    const { rerender } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        onSelect={vi.fn()}
        selectedId={null}
      />,
    );
    await screen.findByTestId("ontology-graph-canvas");
    // Off at first: on a graph of dozens of types the names would cover it.
    expect(canvas.props?.decorations.edges[0].style?.labelText).toBe("");

    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewShowEdgeLabels"));
    await waitFor(() => expect(canvas.props?.decorations.edges[0].style?.labelText).toBe("Places"));

    const edges = Array.from({ length: 121 }, (_, index) => ({
      id: `edge-${index}`,
      name: "connects",
      sourceId: "customer",
      targetId: "order",
    }));
    rerender(
      <OntologyGraphView
        graph={{ ...graph, edges }}
        indexedIds={new Set()}
        onSelect={vi.fn()}
        selectedId={null}
      />,
    );
    // Names that would cover one another are left out, so the switch stays on for a big graph.
    expect(
      screen.getByTitle("knowledgeNetwork.previewHideEdgeLabels").hasAttribute("disabled"),
    ).toBe(false);
    await waitFor(() =>
      expect(
        canvas.props?.decorations.edges.filter((edge) => edge.style?.labelText).length,
      ).toBeGreaterThan(0),
    );
  });

  it("offers logical grouping only when group memberships are available", async () => {
    const { rerender } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        onSelect={vi.fn()}
        selectedId={null}
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
        onSelect={vi.fn()}
        selectedId={null}
      />,
    );
    fireEvent.click(await screen.findByText("knowledgeNetwork.previewLayoutGroup"));

    await waitFor(() => expect(screen.queryByText("Sales")).not.toBeNull());
  });

  it("maximizes over the window and comes back with the button or Esc", async () => {
    const { container } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        onSelect={vi.fn()}
        selectedId={null}
      />,
    );
    await screen.findByTestId("ontology-graph-canvas");
    const wrap = container.firstElementChild as HTMLElement;

    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewMaximize"));
    expect(wrap.dataset.maximized).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(wrap.dataset.maximized).toBeUndefined());

    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewMaximize"));
    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewRestoreView"));
    expect(wrap.dataset.maximized).toBeUndefined();
  });

  it("leaves the maximized view on a click that opens something over the page, and only then", async () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        onSelect={onSelect}
        selectedId={null}
      />,
    );
    await screen.findByTestId("ontology-graph-canvas");
    const wrap = container.firstElementChild as HTMLElement;

    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewMaximize"));
    fireEvent.click(screen.getByRole("button", { name: "customer" }));
    expect(wrap.dataset.maximized).toBe("true");

    rerender(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        leaveMaximizedOnSelect
        onSelect={onSelect}
        selectedId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "customer" }));
    await waitFor(() => expect(wrap.dataset.maximized).toBeUndefined());
    expect(onSelect).toHaveBeenLastCalledWith("customer");
  });

  it("hides object type names from the toolbar, beside the relation names switch", async () => {
    render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        onSelect={vi.fn()}
        selectedId={null}
      />,
    );
    await screen.findByTestId("ontology-graph-canvas");
    expect(canvas.props?.decorations.nodes[0].style?.labelText).toBe("Customer");

    fireEvent.click(screen.getByTitle("knowledgeNetwork.previewHideNodeLabels"));
    await waitFor(() => expect(canvas.props?.decorations.nodes[0].style?.labelText).toBe(""));
    expect(screen.getByTitle("knowledgeNetwork.previewShowNodeLabels")).toBeTruthy();
  });
});
