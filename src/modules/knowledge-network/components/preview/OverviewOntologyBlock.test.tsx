/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const {
  getCatalogResources,
  getKnowledgeNetworkObjectTypeDetail,
  getKnowledgeNetworkOverviewGraph,
} = vi.hoisted(() => ({
  getCatalogResources: vi.fn(),
  getKnowledgeNetworkObjectTypeDetail: vi.fn(),
  getKnowledgeNetworkOverviewGraph: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResources,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkObjectTypeDetail,
  getKnowledgeNetworkOverviewGraph,
}));

vi.mock("./OntologyGraphCard", () => ({
  OntologyGraphCard: ({ onExpandNode }: { onExpandNode?: (id: string) => void }) => (
    <button
      data-testid="ontology-graph-card"
      onClick={() => onExpandNode?.("object-denied-resource")}
      type="button"
    />
  ),
}));

import { OverviewOntologyBlock } from "./OverviewOntologyBlock";

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

describe("OverviewOntologyBlock resource authorization regression", () => {
  it("uses authorized hasIndex summaries without reading resource details when a bound resource is denied", async () => {
    getKnowledgeNetworkOverviewGraph.mockResolvedValue({
      graph: {
        edges: [],
        nodes: [
          {
            color: "#1677ff",
            id: "object-denied-resource",
            indexed: true,
            name: "Customer",
          },
          {
            color: "#52c41a",
            id: "object-authorized-resource",
            indexed: false,
            name: "Order",
          },
        ],
      },
      objectTypeTotal: 2,
      relationTypeTotal: 0,
      snapshot: "snapshot-1",
      truncated: false,
    });
    getKnowledgeNetworkObjectTypeDetail.mockResolvedValue(null);
    getCatalogResources.mockRejectedValue(new Error("403 resource detail denied"));

    render(<OverviewOntologyBlock detailsExpanded networkId="network-1" />);

    expect(await screen.findByText("Customer")).not.toBeNull();
    expect(screen.getByText("Order")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.previewIndexed")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.previewNotIndexed")).not.toBeNull();
    expect(getCatalogResources).not.toHaveBeenCalled();
  });

  it("loads only one bounded neighbourhood when a graph node is selected", async () => {
    getKnowledgeNetworkOverviewGraph
      .mockResolvedValueOnce({
        graph: {
          edges: [],
          nodes: [{ id: "object-denied-resource", indexed: true, name: "Customer" }],
        },
        objectTypeTotal: 2,
        relationTypeTotal: 1,
        snapshot: "snapshot-1",
        truncated: true,
      })
      .mockResolvedValueOnce({
        graph: {
          edges: [
            {
              id: "relation-1",
              name: "places",
              sourceId: "object-denied-resource",
              targetId: "object-order",
            },
          ],
          nodes: [
            { id: "object-denied-resource", indexed: true, name: "Customer" },
            { id: "object-order", indexed: false, name: "Order" },
          ],
        },
        objectTypeTotal: 2,
        relationTypeTotal: 1,
        snapshot: "snapshot-1",
        truncated: false,
      });

    render(<OverviewOntologyBlock networkId="network-1" />);
    await screen.findByTestId("ontology-graph-card");
    fireEvent.click(screen.getByTestId("ontology-graph-card"));

    await waitFor(() =>
      expect(getKnowledgeNetworkOverviewGraph).toHaveBeenNthCalledWith(2, "network-1", {
        edgeLimit: 120,
        expandDepth: 1,
        focusObjectTypeId: "object-denied-resource",
        nodeLimit: 60,
      }),
    );
    expect(getKnowledgeNetworkObjectTypeDetail).not.toHaveBeenCalled();
  });

  it("renders mapping modes and concept groups from bounded graph and visible details", async () => {
    getKnowledgeNetworkOverviewGraph.mockResolvedValue({
      graph: {
        edges: [
          {
            id: "relation-1",
            mappingMode: "resource",
            name: "places",
            sourceId: "object-customer",
            targetId: "object-order",
          },
        ],
        nodes: [
          { id: "object-customer", indexed: true, name: "Customer" },
          { id: "object-order", indexed: false, name: "Order" },
        ],
      },
      objectTypeTotal: 2,
      relationTypeTotal: 1,
      snapshot: "snapshot-1",
      truncated: false,
    });
    getKnowledgeNetworkObjectTypeDetail.mockImplementation(
      (_networkId: string, objectTypeId: string) =>
        Promise.resolve({
          conceptGroupNames: objectTypeId === "object-customer" ? ["Core Group"] : [],
          dataProperties: [],
        }),
    );

    render(<OverviewOntologyBlock detailsExpanded networkId="network-1" />);

    expect(await screen.findByText("Core Group")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.previewMappingResource")).not.toBeNull();
  });
});
