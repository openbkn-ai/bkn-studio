/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";

import { DraftConceptGraph } from "./DraftConceptGraph";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
}));

// Stands in for the drawing: lists what it is given, and clicks the first type.
vi.mock("@/modules/knowledge-network/components/preview/OntologyGraphView", () => ({
  OntologyGraphView: ({
    graph,
    onSelect,
    onSelectEdge,
  }: {
    graph: KnowledgeNetworkPreviewGraph;
    onSelect: (id: string | null) => void;
    onSelectEdge?: (id: string) => void;
  }) => (
    <div>
      <button onClick={() => onSelect("customers")} type="button">
        click
      </button>
      {onSelectEdge ? (
        <button onClick={() => onSelectEdge(graph.edges[0].id)} type="button">
          click a relation
        </button>
      ) : null}
      {graph.nodes.map((node) => (
        <span data-color={node.color} data-faded={String(Boolean(node.faded))} key={node.id}>
          {node.id}
        </span>
      ))}
      {graph.edges.map((edge) => (
        <span
          data-curve={edge.curveOffset ?? 0}
          data-faded={String(Boolean(edge.faded))}
          key={edge.id}
        >
          {edge.id}
        </span>
      ))}
    </div>
  ),
}));

function renderGraph(onOpen?: (id: string) => void, draft = mapDraft(mockDraft("p1"))) {
  render(<DraftConceptGraph draft={draft} networkId="n1" onOpen={onOpen} title="Concept model" />);
}

describe("DraftConceptGraph", () => {
  it("draws every type in a drawable colour, the unpublished ones faded", () => {
    renderGraph();
    expect(screen.getByText("Concept model")).toBeInTheDocument();
    expect(screen.getByText("bknProject.model.graph.legend")).toBeInTheDocument();
    // The types are listed beside the graph too, as on the knowledge network.
    expect(screen.getAllByText("customers").length).toBeGreaterThan(0);

    const node = (id: string) =>
      screen.getAllByText(id).find((element) => element.dataset.faded !== undefined)!;
    expect(node("customers").dataset.faded).toBe("false");
    expect(node("material_bom").dataset.faded).toBe("true");
    expect(node("material_bom_to_sales_orders").dataset.faded).toBe("true");
    expect(node("customers").dataset.color).toMatch(/^#/);
  });

  it("counts every drafted type and relation, and draws two relations of one pair apart", () => {
    const draft = mapDraft(mockDraft("p1"));
    const first = draft.items.relationTypes[0];
    draft.items.relationTypes.push({ ...first, id: `${first.id}_again`, name: `${first.name}2` });
    renderGraph(undefined, draft);

    expect(
      screen.getByText(
        `bknProject.model.graph.counts:${JSON.stringify({
          objects: draft.items.objectTypes.length,
          relations: draft.items.relationTypes.length,
        })}`,
      ),
    ).toBeInTheDocument();
    const edge = (id: string) =>
      screen.getAllByText(id).find((element) => element.dataset.curve !== undefined)!;
    expect(Number(edge(first.id).dataset.curve)).not.toBe(0);
    expect(Number(edge(`${first.id}_again`).dataset.curve)).toBe(
      -Number(edge(first.id).dataset.curve),
    );
  });

  it("opens the same object type on every click", () => {
    const onOpen = vi.fn();
    renderGraph(onOpen);
    fireEvent.click(screen.getByRole("button", { name: "click" }));
    fireEvent.click(screen.getByRole("button", { name: "click" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenLastCalledWith("customers");
  });

  it("opens a relation from its line where the page can, and offers no clicks otherwise", () => {
    const onOpenRelation = vi.fn();
    const draft = mapDraft(mockDraft("p1"));
    const { unmount } = render(
      <DraftConceptGraph
        draft={draft}
        networkId="n1"
        onOpenRelation={onOpenRelation}
        title="Concept model"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "click a relation" }));
    expect(onOpenRelation).toHaveBeenCalledWith(draft.items.relationTypes[0].id);
    unmount();

    renderGraph();
    expect(screen.queryByRole("button", { name: "click a relation" })).toBeNull();
  });
});
