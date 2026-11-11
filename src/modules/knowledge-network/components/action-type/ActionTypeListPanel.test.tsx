/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const listActionTypePage = vi.hoisted(() => vi.fn());
const getObjectTypeDetail = vi.hoisted(() => vi.fn());
const listObjectTypePage = vi.hoisted(() => vi.fn());
const getRelationTypeDetail = vi.hoisted(() => vi.fn());
const resolveActionSource = vi.hoisted(() => vi.fn());
const getToolboxMetadata = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      key === "knowledgeNetwork.actionRelationScope"
        ? `${values?.source} → ${values?.relation} → ${values?.target}`
        : key,
  }),
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

vi.mock("@/modules/knowledge-network/services/relation-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/relation-type.service")
  >()),
  getKnowledgeNetworkRelationTypeDetail: getRelationTypeDetail,
}));

vi.mock("@/modules/knowledge-network/services/action-type-tool.service", () => ({
  getActionTypeToolboxMetadataType: getToolboxMetadata,
  needsActionTypeActionSourceDisplayResolution: (source: { type: string; toolName?: string }) =>
    source.type === "tool" && !source.toolName,
  resolveActionTypeActionSourceDisplayWithTimeout: resolveActionSource,
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

function renderPanel(initialEntry = "/?view=list", canDelete = false, canModify = false) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ActionTypeListPanel
        canDelete={canDelete}
        canModify={canModify}
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

beforeEach(() => {
  listActionTypePage.mockResolvedValue({ entries: [], totalCount: 0 });
  resolveActionSource.mockImplementation((source) => Promise.resolve(source));
  getToolboxMetadata.mockResolvedValue("openapi");
});

afterEach(() => {
  cleanup();
  navigate.mockReset();
  listActionTypePage.mockReset();
  getObjectTypeDetail.mockReset();
  listObjectTypePage.mockReset();
  getRelationTypeDetail.mockReset();
  resolveActionSource.mockReset();
  getToolboxMetadata.mockReset();
  listObjectTypePage.mockResolvedValue({ entries: [], totalCount: 0 });
});

describe("ActionTypeListPanel menu access", () => {
  it("filters the list by the execution tool category", async () => {
    renderPanel("/?view=list");

    const category = screen.getByRole("combobox", {
      name: "knowledgeNetwork.actionTypeExecutionToolCategory",
    });
    fireEvent.mouseDown(category);
    expect(screen.getByText("executionFactory.functionToolboxTab")).toBeInTheDocument();
    expect(screen.getByText("executionFactory.executionUnitTabsV2.mcp")).toBeInTheDocument();
    fireEvent.click(await screen.findByText("executionFactory.openapiToolboxTab"));

    await waitFor(() =>
      expect(listActionTypePage).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({
          executionToolCategory: "openapi",
        }) as unknown,
      ),
    );
    expect(
      screen
        .getByRole("columnheader", { name: /knowledgeNetwork.actionTypeExecutionToolFilter/ })
        .querySelector(".ant-table-filter-trigger"),
    ).toBeNull();

    fireEvent.mouseDown(category);
    fireEvent.click(screen.getAllByText("common.all").at(-1)!);
    await waitFor(() =>
      expect(listActionTypePage).toHaveBeenLastCalledWith(
        "network-1",
        expect.objectContaining({ executionToolCategory: undefined }) as unknown,
      ),
    );
  });

  it("resolves the execution tool name for a list row before displaying it", async () => {
    listActionTypePage.mockResolvedValue({
      entries: [
        {
          actionKind: "create",
          actionSource: {
            boxId: "box-uuid",
            toolId: "tool-uuid",
            type: "tool",
          },
          color: "#1677ff",
          description: "",
          id: "create-order",
          name: "Create order",
          objectTypeId: "orders",
          objectTypeName: "Orders",
          tags: [],
          updateTime: "",
          updaterName: "",
        },
      ],
      totalCount: 1,
    });
    resolveActionSource.mockResolvedValue({
      boxId: "box-uuid",
      boxName: "Orders API",
      toolId: "tool-uuid",
      toolName: "Create order",
      type: "tool",
    });

    renderPanel("/?view=list");
    expect(await screen.findByText("Orders API/Create order")).toBeInTheDocument();
    expect(await screen.findByText("executionFactory.openapiToolboxTab")).toBeInTheDocument();
    expect(screen.queryByText("box-uuid/tool-uuid")).toBeNull();
    expect(resolveActionSource).toHaveBeenCalledWith(
      expect.objectContaining({ boxId: "box-uuid", toolId: "tool-uuid" }),
    );
  });

  it("shows distinct operation and relationship scope in the complete list", async () => {
    listActionTypePage.mockResolvedValue({
      entries: [
        {
          actionKind: "create",
          color: "#1677ff",
          description: "",
          id: "create-order",
          name: "Create order",
          actionSource: {
            boxId: "api-box",
            boxName: "API toolset",
            toolId: "send",
            toolName: "Send API",
            type: "tool",
          },
          objectTypeId: "orders",
          objectTypeName: "Orders",
          tags: [],
          updateTime: "",
          updaterName: "",
        },
        {
          actionKind: "create",
          color: "#1677ff",
          description: "",
          id: "link-order",
          name: "Link order",
          objectTypeId: "orders",
          objectTypeName: "Orders",
          operationConfig: {
            type: "relation",
            relationTypeId: "order_supplier",
            relationOperation: "create",
          },
          tags: [],
          updateTime: "",
          updaterName: "",
        },
        {
          actionKind: "notify",
          color: "#1677ff",
          description: "",
          id: "send-alert",
          name: "Send alert",
          objectTypeId: "",
          objectTypeName: "",
          operationConfig: { type: "tool" },
          tags: [],
          updateTime: "",
          updaterName: "",
        },
      ],
      totalCount: 3,
    });
    getRelationTypeDetail.mockResolvedValue({
      id: "order_supplier",
      name: "Supplied by",
      sourceObjectTypeName: "Orders",
      targetObjectTypeName: "Suppliers",
    });

    renderPanel();

    expect(
      await screen.findByText("knowledgeNetwork.actionObjectCreateInstance"),
    ).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.actionRelationCreate")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.actionOperationExecuteTool")).toBeInTheDocument();
    expect(screen.getByText("API toolset/Send API")).toBeInTheDocument();
    expect(await screen.findByText("Orders → Supplied by → Suppliers")).toBeInTheDocument();
    expect(getRelationTypeDetail).toHaveBeenCalledWith("network-1", "order_supplier");
  });

  it("passes the selected relationship operation through the list query", async () => {
    listActionTypePage.mockResolvedValue({ entries: [], totalCount: 0 });

    renderPanel("/?view=list&operation=relation&relationOperation=delete");

    await waitFor(() =>
      expect(listActionTypePage).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({
          operationKind: "relation",
          relationOperation: "delete",
        }) as unknown,
      ),
    );
  });

  it("keeps the graph scoped to object-associated action types", async () => {
    listObjectTypePage.mockResolvedValue({
      entries: [{ id: "orders", name: "Orders", color: "#1677ff" }],
      totalCount: 1,
    });
    renderPanel("/?graphScope=tool");

    expect(await screen.findByTestId("action-type-graph")).toHaveTextContent("Orders");
    expect(screen.queryByText("knowledgeNetwork.actionIndependentActions")).toBeNull();
    expect(listActionTypePage).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({ objectTypeId: "orders" }) as unknown,
    );
    const requests = listActionTypePage.mock.calls as Array<[string, { objectTypeId?: string }]>;
    expect(requests.every(([, query]) => query.objectTypeId === "orders")).toBe(true);
  });
  it("opens object and tool entries and routes them into the shared editor", async () => {
    listActionTypePage.mockResolvedValue({ entries: [], totalCount: 0 });
    renderPanel("/?view=list", false, true);

    fireEvent.click(await screen.findByText("common.create"));
    expect(screen.getByText("knowledgeNetwork.actionTypeCreateEntryTitle")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /knowledgeNetwork.actionOperationRelation/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /knowledgeNetwork.actionOperationTool/ }));
    expect(navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/action-types/create?operation=tool",
      {
        state: {
          knowledgeNetworkReturnTo: "/knowledge-network/workspace/network-1/action-types?view=list",
        },
      },
    );

    navigate.mockClear();
    fireEvent.click(await screen.findByText("common.create"));
    fireEvent.click(screen.getByRole("button", { name: /knowledgeNetwork.actionOperationObject/ }));
    expect(navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/action-types/create?operation=object",
      {
        state: {
          knowledgeNetworkReturnTo: "/knowledge-network/workspace/network-1/action-types?view=list",
        },
      },
    );
  });

  it("keeps all three creation choices visible when the graph has a selected object", async () => {
    getObjectTypeDetail.mockResolvedValue(null);
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
    renderPanel("/", false, true);

    expect(await screen.findByTestId("action-type-graph")).toHaveTextContent("Order");
    fireEvent.click(await screen.findByText("common.create"));

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText("knowledgeNetwork.actionTypeCreateEntryTitle")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /knowledgeNetwork.actionOperationTool/ }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /knowledgeNetwork.actionOperationObject/ }));
    expect(navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/action-types/create?operation=object",
      {
        state: expect.objectContaining({
          actionTypeInitialObjectTypeId: "object-1",
        }) as unknown,
      },
    );
    expect(screen.queryByText("knowledgeNetwork.actionTypeCreateEntryTitle")).toBeNull();
  });

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
