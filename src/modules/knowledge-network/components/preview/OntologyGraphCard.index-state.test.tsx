/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const {
  getCatalogResources,
  getKnowledgeNetworkConceptGroup,
  listKnowledgeNetworkConceptGroups,
} = vi.hoisted(() => ({
  getCatalogResources: vi.fn(),
  getKnowledgeNetworkConceptGroup: vi.fn(),
  listKnowledgeNetworkConceptGroups: vi.fn(),
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

vi.mock("./OntologyGraphView", () => ({
  OntologyGraphView: ({ indexedIds }: { indexedIds: Set<string> }) => (
    <div data-testid="indexed-object-types">{[...indexedIds].join(",")}</div>
  ),
}));

vi.mock("./OntologyInspectorPanel", () => ({
  OntologyInspectorPanel: () => null,
}));

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
  });
});
