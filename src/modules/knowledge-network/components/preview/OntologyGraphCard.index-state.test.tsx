/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const {
  getCatalogResources,
  getKnowledgeNetworkConceptGroup,
  listKnowledgeNetworkConceptGroups,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
} = vi.hoisted(() => ({
  getCatalogResources: vi.fn(),
  getKnowledgeNetworkConceptGroup: vi.fn(),
  listKnowledgeNetworkConceptGroups: vi.fn(),
  listKnowledgeNetworkObjectTypes: vi.fn(),
  listKnowledgeNetworkRelationTypes: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResources,
}));

vi.mock("@/modules/knowledge-network/services/concept-group.service", () => ({
  getKnowledgeNetworkConceptGroup,
  listKnowledgeNetworkConceptGroups,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
}));

vi.mock("./OntologyGraphView", () => ({
  OntologyGraphView: ({
    graph,
    groupNames,
    groupOf,
    indexedIds,
  }: {
    graph: { nodes: { color: string }[] };
    groupNames: Map<string, string>;
    groupOf: Map<string, string>;
    indexedIds: Set<string>;
  }) => (
    <div
      data-colors={graph.nodes.map((node) => node.color).join(",")}
      data-group-names={[...groupNames].flat().join(",")}
      data-groups={[...groupOf].flat().join(",")}
      data-testid="indexed-object-types"
    >
      {[...indexedIds].join(",")}
    </div>
  ),
}));

vi.mock("./OntologyInspectorPanel", () => ({
  OntologyInspectorPanel: ({ objectTypes }: { objectTypes: { color?: string }[] }) => (
    <div data-testid="inspector-colors">{objectTypes.map((item) => item.color).join(",")}</div>
  ),
}));

import { GRAPH_PALETTE } from "@/modules/knowledge-network/lib/graph-style";

import { OntologyGraphCard } from "./OntologyGraphCard";

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OntologyGraphCard resource authorization regression", () => {
  it("derives the graph index state from hasIndex without requesting partially authorized resources", async () => {
    listKnowledgeNetworkConceptGroups.mockResolvedValue([]);
    getCatalogResources.mockRejectedValue(new Error("403 resource detail denied"));

    render(
      <OntologyGraphCard
        networkId="network-1"
        objectTypes={[
          {
            color: "#1677ff",
            conceptGroupIds: [],
            conceptGroupNames: [],
            dataSource: { id: "denied-resource", name: "Denied resource" },
            description: "",
            hasIndex: true,
            id: "object-denied-resource",
            name: "Customer",
            tags: [],
            updateTime: "",
            updaterName: "",
          },
          {
            color: "#52c41a",
            conceptGroupIds: [],
            conceptGroupNames: [],
            dataSource: { id: "authorized-resource", name: "Authorized resource" },
            description: "",
            hasIndex: false,
            id: "object-authorized-resource",
            name: "Order",
            tags: [],
            updateTime: "",
            updaterName: "",
          },
        ]}
        relationTypes={[]}
      />,
    );

    expect(await screen.findByTestId("indexed-object-types")).toHaveTextContent(
      "object-denied-resource",
    );
    expect(getCatalogResources).not.toHaveBeenCalled();
    // A type left at the mapping's default blue takes a palette colour, in the graph and in the
    // panel beside it alike; a type with its own colour keeps it.
    const colors = `${GRAPH_PALETTE[0]},#52c41a`;
    expect(screen.getByTestId("indexed-object-types").dataset.colors).toBe(colors);
    expect(screen.getByTestId("inspector-colors")).toHaveTextContent(colors);
  });

  it("uses memberships already returned with overview nodes for logical grouping", async () => {
    render(
      <OntologyGraphCard
        loadConceptGroups={false}
        networkId="network-1"
        objectTypes={[
          {
            color: "#1677ff",
            conceptGroupIds: ["group-z", "group-a"],
            conceptGroupNames: ["Zulu", "Alpha"],
            description: "",
            hasIndex: false,
            id: "customer",
            name: "Customer",
            tags: [],
            updateTime: "",
            updaterName: "",
          },
        ]}
        relationTypes={[]}
      />,
    );

    const graph = await screen.findByTestId("indexed-object-types");
    expect(graph).toHaveAttribute("data-groups", "customer,group-a");
    expect(graph).toHaveAttribute("data-group-names", "group-a,Alpha,group-z,Zulu");
    expect(listKnowledgeNetworkConceptGroups).not.toHaveBeenCalled();
  });

  it("does not reload uncontrolled graph data when a controlled selection changes", async () => {
    listKnowledgeNetworkConceptGroups.mockResolvedValue([]);
    listKnowledgeNetworkObjectTypes.mockResolvedValue([]);
    listKnowledgeNetworkRelationTypes.mockResolvedValue([]);

    const { rerender } = render(<OntologyGraphCard networkId="network-1" selectedId="customer" />);

    await waitFor(() => {
      expect(listKnowledgeNetworkObjectTypes).toHaveBeenCalledTimes(1);
      expect(listKnowledgeNetworkRelationTypes).toHaveBeenCalledTimes(1);
    });

    rerender(<OntologyGraphCard networkId="network-1" selectedId="order" />);

    expect(listKnowledgeNetworkObjectTypes).toHaveBeenCalledTimes(1);
    expect(listKnowledgeNetworkRelationTypes).toHaveBeenCalledTimes(1);
  });
});
