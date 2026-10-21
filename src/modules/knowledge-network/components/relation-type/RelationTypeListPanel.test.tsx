/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getObjectType: vi.fn(),
  listObjectTypePage: vi.fn(),
  listRelationTypePage: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ modal: { confirm: vi.fn() } }),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => false,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectType: mocks.getObjectType,
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectType,
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypePage,
}));

vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  listKnowledgeNetworkRelationTypePage: mocks.listRelationTypePage,
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer",
  () => ({ KnowledgeNetworkObjectAuthorizeDrawer: () => null }),
);

vi.mock("@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph", () => ({
  ObjectTypeResourceGraph: ({
    objectType,
    resourceScope,
  }: {
    objectType: { name: string };
    resourceScope: string;
  }) => (
    <div data-resource-scope={resourceScope} data-testid="relation-type-graph">
      {objectType.name}
    </div>
  ),
}));

import { RelationObjectTypeFilter, RelationTypeListPanel } from "./RelationTypeListPanel";

const emptyObjectTypePage = { entries: [], totalCount: 0 };
const emptyRelationTypePage = { entries: [], totalCount: 0 };
const originalMatchMedia = window.matchMedia;

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

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

function renderPanel(initialEntry = "/", canDelete = false) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RelationTypeListPanel
        canDelete={canDelete}
        canModify={false}
        networkId="network-1"
        networkName="Test network"
        onDelete={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("RelationTypeListPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getObjectType.mockResolvedValue(null);
    mocks.listObjectTypePage.mockResolvedValue(emptyObjectTypePage);
    mocks.listRelationTypePage.mockResolvedValue(emptyRelationTypePage);
  });

  it("resolves a selected object type restored from the URL outside the first option page", async () => {
    mocks.getObjectType.mockResolvedValue({ id: "selected-object", name: "Selected object" });

    renderPanel("/?view=list&source=selected-object");

    expect(await screen.findByText("Selected object")).not.toBeNull();
    expect(mocks.getObjectType).toHaveBeenCalledWith("network-1", "selected-object");
  });

  it("does not reload the option page when only the selected value changes", async () => {
    mocks.listObjectTypePage.mockResolvedValue({
      entries: [{ id: "object-1", name: "Object one" }],
      totalCount: 1,
    });
    const view = render(
      <RelationObjectTypeFilter
        label="Object type"
        networkId="network-1"
        onChange={vi.fn()}
        value="all"
      />,
    );
    await waitFor(() => expect(mocks.listObjectTypePage).toHaveBeenCalledTimes(1));

    view.rerender(
      <RelationObjectTypeFilter
        label="Object type"
        networkId="network-1"
        onChange={vi.fn()}
        value="object-1"
      />,
    );

    await waitFor(() => expect(screen.getByText("Object one")).not.toBeNull());
    expect(mocks.listObjectTypePage).toHaveBeenCalledTimes(1);
    expect(mocks.getObjectType).not.toHaveBeenCalled();
  });

  it("shows a retryable error instead of the empty creation state when loading fails", async () => {
    mocks.listRelationTypePage
      .mockRejectedValueOnce(new Error("backend unavailable"))
      .mockResolvedValueOnce(emptyRelationTypePage);

    renderPanel("/?view=list");

    expect(await screen.findByText("knowledgeNetwork.relationTypeListLoadFailed")).not.toBeNull();
    expect(screen.queryByText("knowledgeNetwork.emptyRelationTypes")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    await waitFor(() => expect(mocks.listRelationTypePage).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("knowledgeNetwork.emptyRelationTypes")).not.toBeNull();
  });

  it("uses graph view by default and selects an object type as the graph root", async () => {
    mocks.listObjectTypePage.mockResolvedValue({
      entries: [
        {
          color: "#1677ff",
          description: "Payment object",
          icon: "box",
          id: "payment",
          name: "Payment",
          operations: ["view_detail"],
          tags: [],
          updateTime: "2026-08-20 10:00:00",
          updaterName: "admin",
        },
      ],
      totalCount: 1,
    });

    renderPanel();

    expect(await screen.findByTestId("relation-type-graph")).toHaveTextContent("Payment");
    expect(screen.getByTestId("relation-type-graph")).toHaveAttribute(
      "data-resource-scope",
      "relations",
    );
    expect(screen.getByText("knowledgeNetwork.objectTypes")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Payment knowledgeNetwork.objectTypeGraphRelations 0"),
    ).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.objectTypeGraphView")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.objectTypeListView")).toBeInTheDocument();
  });

  it("hides the batch delete action in graph view", async () => {
    renderPanel("/", true);

    expect(await screen.findByText("knowledgeNetwork.objectTypeGraphView")).toBeInTheDocument();
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("knowledgeNetwork.objectTypeListView"));
    expect(await screen.findByText("common.delete")).toBeInTheDocument();
  });
});
