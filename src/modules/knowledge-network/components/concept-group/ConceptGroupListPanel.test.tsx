/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConceptGroupRecord } from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  getConceptGroup: vi.fn(),
  listConceptGroups: vi.fn(),
  modalConfirm: vi.fn(),
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
}));

const searchParams = new URLSearchParams();

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [searchParams, mocks.setSearchParams],
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: mocks.modalConfirm },
  }),
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlement: () => ({ edition: "enterprise", extensions: ["concept_groups"] }),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => false,
}));

vi.mock("@/modules/knowledge-network/services/concept-group.service", () => ({
  listKnowledgeNetworkConceptGroupPage: mocks.listConceptGroups,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkConceptGroup: mocks.getConceptGroup,
}));

vi.mock("./ConceptGroupGraphPanel", () => ({
  ConceptGroupGraphPanel: ({
    focusedObjectTypeId,
    group,
    onFocusedObjectTypeIdChange,
  }: {
    focusedObjectTypeId?: string | null;
    group: ConceptGroupRecord;
    onFocusedObjectTypeIdChange: (id: string | null) => void;
  }) => (
    <div
      data-focused-object-id={focusedObjectTypeId ?? ""}
      data-group-id={group.id}
      data-testid="concept-group-graph"
    >
      <button onClick={() => onFocusedObjectTypeIdChange("object-1")} type="button">
        explore-object
      </button>
    </div>
  ),
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer",
  () => ({
    KnowledgeNetworkObjectAuthorizeDrawer: () => null,
  }),
);

import { ConceptGroupListPanel } from "./ConceptGroupListPanel";

const group: ConceptGroupRecord = {
  actionTypesTotal: 1,
  color: "#1677ff",
  description: "Core sales concepts",
  id: "group-1",
  name: "Sales",
  objectTypesTotal: 2,
  operations: ["view_detail", "delete"],
  relationTypesTotal: 1,
  tags: ["core"],
  updateTime: "2026-10-24 10:00:00",
  updaterName: "Admin",
};

const secondGroup: ConceptGroupRecord = {
  ...group,
  id: "group-2",
  name: "Fulfillment",
};

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

beforeEach(() => {
  for (const key of [...searchParams.keys()]) searchParams.delete(key);
  mocks.listConceptGroups.mockResolvedValue({
    availableTags: ["core"],
    entries: [group],
    totalCount: 1,
  });
  mocks.getConceptGroup.mockResolvedValue(group);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConceptGroupListPanel graph view", () => {
  it("defaults to graph mode, selects the first visible group, and can switch to the list", async () => {
    render(
      <ConceptGroupListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Sales network"
        onDelete={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(await screen.findByTestId("concept-group-graph")).toHaveAttribute(
      "data-group-id",
      "group-1",
    );
    expect(screen.getByText("knowledgeNetwork.conceptGroupGraphView")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.conceptGroupListView")).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(mocks.setSearchParams).toHaveBeenCalledWith(expect.any(URLSearchParams), {
        replace: true,
      });
    });

    fireEvent.click(screen.getByText("knowledgeNetwork.conceptGroupListView"));
    expect(screen.queryByTestId("concept-group-graph")).not.toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
  });

  it("selects the next available group after deleting the current graph group", async () => {
    mocks.listConceptGroups.mockResolvedValue({
      availableTags: ["core"],
      entries: [group, secondGroup],
      totalCount: 2,
    });
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <ConceptGroupListPanel
        canDelete
        canModify={false}
        networkId="network-1"
        networkName="Sales network"
        onDelete={onDelete}
        onImport={vi.fn()}
      />,
    );

    expect(await screen.findByTestId("concept-group-graph")).toHaveAttribute(
      "data-group-id",
      "group-1",
    );
    fireEvent.click(screen.getByRole("button", { name: /common\.delete/ }));

    const confirmOptions = mocks.modalConfirm.mock.calls[0]?.[0] as {
      onOk: () => Promise<void>;
    };
    mocks.listConceptGroups.mockResolvedValue({
      availableTags: ["core"],
      entries: [secondGroup],
      totalCount: 1,
    });
    await act(async () => {
      await confirmOptions.onOk();
    });

    expect(onDelete).toHaveBeenCalledWith([group]);
    expect(await screen.findByTestId("concept-group-graph")).toHaveAttribute(
      "data-group-id",
      "group-2",
    );
  });

  it("stores the focused object type in the graph URL", async () => {
    render(
      <ConceptGroupListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Sales network"
        onDelete={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    await screen.findByTestId("concept-group-graph");
    fireEvent.click(screen.getByRole("button", { name: "explore-object" }));

    const focusCall = mocks.setSearchParams.mock.calls.find(
      ([params]) => (params as URLSearchParams).get("focusObjectTypeId") === "object-1",
    );
    expect(focusCall?.[0]).toBeInstanceOf(URLSearchParams);
    expect((focusCall?.[0] as URLSearchParams).get("focusObjectTypeId")).toBe("object-1");
    expect(focusCall?.[1]).toEqual({ replace: true });
  });
});
