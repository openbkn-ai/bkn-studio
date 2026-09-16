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
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
} = vi.hoisted(() => ({
  getCatalogResources: vi.fn(),
  getKnowledgeNetworkObjectTypeDetail: vi.fn(),
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

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
}));

vi.mock("./OntologyGraphCard", () => ({
  OntologyGraphCard: () => <div data-testid="ontology-graph-card" />,
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
    listKnowledgeNetworkObjectTypes.mockResolvedValue([
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
    ]);
    listKnowledgeNetworkRelationTypes.mockResolvedValue([]);
    getKnowledgeNetworkObjectTypeDetail.mockResolvedValue(null);
    getCatalogResources.mockRejectedValue(new Error("403 resource detail denied"));

    render(<OverviewOntologyBlock detailsExpanded networkId="network-1" />);

    expect(await screen.findByText("Customer")).not.toBeNull();
    expect(screen.getByText("Order")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.previewIndexed")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.previewNotIndexed")).not.toBeNull();
    expect(getCatalogResources).not.toHaveBeenCalled();
  });
});
