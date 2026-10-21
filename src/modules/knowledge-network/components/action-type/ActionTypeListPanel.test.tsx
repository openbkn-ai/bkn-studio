/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const listActionTypePage = vi.hoisted(() => vi.fn());
const getObjectTypeDetail = vi.hoisted(() => vi.fn());
const listObjectTypePage = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: [] } },
  }),
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/usePersistentPageSize",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/components/shared/usePersistentPageSize")
    >()),
    usePersistentPageSize: () => [10, vi.fn()],
  }),
);

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => true,
}));

vi.mock("@/modules/knowledge-network/services/action-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/action-type.service")
  >()),
  listKnowledgeNetworkActionTypePage: listActionTypePage,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/object-type.service")
  >()),
  getKnowledgeNetworkObjectTypeDetail: getObjectTypeDetail,
  listKnowledgeNetworkObjectTypePage: listObjectTypePage,
}));

vi.mock("@/modules/knowledge-network/components/shared/ObjectTypeRemoteFilter", () => ({
  ObjectTypeRemoteFilter: () => null,
}));

vi.mock("@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph", () => ({
  ObjectTypeResourceGraph: ({
    allowAuthorizeObject,
    allowEditObject,
    canRequestObjectPermission,
    initialSelectedResource,
    objectType,
    onAuthorizeAction,
    onDeleteAction,
    onEditAction,
    permissionRequestsEnabled,
    resourceScope,
  }: {
    allowAuthorizeObject?: boolean;
    allowEditObject?: boolean;
    canRequestObjectPermission: boolean;
    initialSelectedResource?: { id: string; kind: string };
    objectType: { name: string };
    onAuthorizeAction?: unknown;
    onDeleteAction?: unknown;
    onEditAction?: unknown;
    permissionRequestsEnabled?: boolean;
    resourceScope: string;
  }) => (
    <div
      data-action-authorize={typeof onAuthorizeAction}
      data-action-delete={typeof onDeleteAction}
      data-action-edit={typeof onEditAction}
      data-authorize-object={String(allowAuthorizeObject)}
      data-edit-object={String(allowEditObject)}
      data-initial-resource={`${initialSelectedResource?.kind ?? ""}:${initialSelectedResource?.id ?? ""}`}
      data-permission-requests={String(permissionRequestsEnabled)}
      data-request-object-permission={String(canRequestObjectPermission)}
      data-resource-scope={resourceScope}
      data-testid="action-type-graph"
    >
      {objectType.name}
    </div>
  ),
}));

import { ActionTypeListPanel } from "./ActionTypeListPanel";

function renderPanel(initialEntry = "/?view=list", canDelete = false) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ActionTypeListPanel
        canDelete={canDelete}
        canModify={false}
        networkId="network-1"
        networkName="Test network"
        onDelete={vi.fn()}
      />
    </MemoryRouter>,
  );
}

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
afterEach(() => {
  cleanup();
  navigate.mockReset();
  listActionTypePage.mockReset();
  getObjectTypeDetail.mockReset();
  listObjectTypePage.mockReset();
  listObjectTypePage.mockResolvedValue({ entries: [], totalCount: 0 });
});

describe("ActionTypeListPanel menu access", () => {
  it("exposes execution management only with execute access", async () => {
    listActionTypePage.mockResolvedValue({
      entries: [
        {
          actionKind: "update",
          color: "#1677ff",
          description: "Update an order",
          id: "action-1",
          name: "Update order",
          objectTypeId: "object-1",
          objectTypeName: "Order",
          operations: ["execute"],
          tags: [],
          updateTime: "2026-08-20 10:00:00",
          updaterName: "admin",
        },
      ],
      totalCount: 1,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "common.actions" }));

    expect(await screen.findByText("knowledgeNetwork.actionTypeExecutionEntry")).not.toBeNull();
    expect(screen.queryByText("common.edit")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.authorizeAction")).toBeNull();
  });

  it("uses root authorize plus child view for the configure-permissions entry", async () => {
    listActionTypePage.mockResolvedValue({
      entries: [
        {
          actionKind: "update",
          color: "#1677ff",
          description: "Update an order",
          id: "action-1",
          name: "Update order",
          objectTypeId: "object-1",
          objectTypeName: "Order",
          operations: ["view_detail"],
          tags: [],
          updateTime: "2026-08-20 10:00:00",
          updaterName: "admin",
        },
      ],
      totalCount: 1,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "common.actions" }));

    expect(await screen.findByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
    expect(screen.getByText("common.entitlement.editionsShort.professional")).not.toBeNull();
  });

  it("uses graph view by default and selects an object type as the graph root", async () => {
    listActionTypePage.mockResolvedValue({ entries: [], totalCount: 0 });
    listObjectTypePage.mockResolvedValue({
      entries: [
        {
          color: "#1677ff",
          description: "Sales order",
          icon: "box",
          id: "object-1",
          name: "Order",
          operations: ["view_detail"],
          tags: [],
          updateTime: "2026-08-20 10:00:00",
          updaterName: "admin",
        },
      ],
      totalCount: 1,
    });

    renderPanel("/");

    expect(await screen.findByTestId("action-type-graph")).toHaveTextContent("Order");
    expect(screen.getByTestId("action-type-graph")).toHaveAttribute(
      "data-resource-scope",
      "actions",
    );
    expect(screen.getByTestId("action-type-graph")).toHaveAttribute(
      "data-authorize-object",
      "false",
    );
    expect(screen.getByTestId("action-type-graph")).toHaveAttribute("data-edit-object", "false");
    expect(screen.getByTestId("action-type-graph")).toHaveAttribute(
      "data-request-object-permission",
      "false",
    );
    expect(screen.getByTestId("action-type-graph")).toHaveAttribute(
      "data-action-authorize",
      "function",
    );
    expect(screen.getByTestId("action-type-graph")).toHaveAttribute(
      "data-action-delete",
      "function",
    );
    expect(screen.getByTestId("action-type-graph")).toHaveAttribute("data-action-edit", "function");
    expect(screen.getByText("knowledgeNetwork.objectTypes")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Order knowledgeNetwork.objectTypeGraphActions 0"),
    ).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.objectTypeGraphView")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.objectTypeListView")).toBeInTheDocument();
  });

  it("hides the batch delete action in graph view", async () => {
    listActionTypePage.mockResolvedValue({ entries: [], totalCount: 0 });
    listObjectTypePage.mockResolvedValue({ entries: [], totalCount: 0 });

    renderPanel("/", true);

    expect(await screen.findByText("knowledgeNetwork.objectTypeGraphView")).toBeInTheDocument();
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("knowledgeNetwork.objectTypeListView"));
    expect(await screen.findByText("common.delete")).toBeInTheDocument();
  });

  it("preserves list filters and pagination when opening an action detail", async () => {
    listActionTypePage.mockResolvedValue({
      entries: [
        {
          actionKind: "update",
          color: "#1677ff",
          description: "Update an order",
          id: "action-1",
          name: "Update order",
          objectTypeId: "object-1",
          objectTypeName: "Order",
          operations: ["view_detail"],
          tags: [],
          updateTime: "2026-08-20 10:00:00",
          updaterName: "admin",
        },
      ],
      totalCount: 11,
    });
    const returnTo =
      "/knowledge-network/workspace/network-1/action-types?view=list&page=2&q=update&actionKind=update&objectType=object-1&sort=name&order=asc";

    renderPanel(
      "/?view=list&page=2&q=update&actionKind=update&objectType=object-1&sort=name&order=asc",
    );

    fireEvent.click(await screen.findByText("Update order"));

    expect(navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/action-types/action-1/detail",
      { state: { knowledgeNetworkReturnTo: returnTo } },
    );
  });

  it("restores the selected action when returning from its detail page", async () => {
    getObjectTypeDetail.mockResolvedValue({
      color: "#1677ff",
      description: "Sales order",
      id: "object-1",
      name: "Order",
      operations: ["view_detail"],
      tags: [],
      updateTime: "",
      updaterName: "",
    });
    listActionTypePage.mockResolvedValue({ entries: [], totalCount: 0 });
    listObjectTypePage.mockResolvedValue({
      entries: [
        {
          color: "#1677ff",
          description: "Sales order",
          id: "object-1",
          name: "Order",
          operations: ["view_detail"],
          tags: [],
          updateTime: "",
          updaterName: "",
        },
      ],
      totalCount: 1,
    });

    renderPanel("/?objectTypeId=object-1&graphResourceKind=action&graphResourceId=action-1");

    expect(await screen.findByTestId("action-type-graph")).toHaveAttribute(
      "data-initial-resource",
      "action:action-1",
    );
  });
});
