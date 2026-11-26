/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnEventType } from "@/modules/knowledge-network/types/event-type";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  canAuthorize: true,
  confirm: vi.fn(),
  getObjectType: vi.fn(),
  listEventTypes: vi.fn(),
  listObjectTypes: vi.fn(),
  modalError: vi.fn(),
  navigate: vi.fn(),
  objectWritable: undefined as ((objectTypeId: string) => boolean) | undefined,
  setSearchParams: vi.fn(),
  success: vi.fn(),
  versioned: false,
  versionView: "running",
  warning: vi.fn(),
}));

const searchParams = new URLSearchParams("view=graph");

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
    message: { error: vi.fn(), success: mocks.success, warning: mocks.warning },
    modal: { confirm: mocks.confirm, error: mocks.modalError },
  }),
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => "available",
  useEntitlement: () => ({ edition: "enterprise", extensions: ["object_metrics"] }),
}));

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => ({ currentUser: { isSuperAdmin: false } }),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => mocks.canAuthorize,
}));

vi.mock("@/modules/account/services/permission-requests.service", () => ({
  getPermissionRequestProposalPreview: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectType,
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypes,
}));

vi.mock("@/modules/knowledge-network/services/event-type.service", () => ({
  listKnEventTypes: mocks.listEventTypes,
}));

vi.mock("@/modules/knowledge-network/hooks/useKnVersionView", () => ({
  useKnVersioned: () => mocks.versioned,
  useKnVersionView: () => [mocks.versionView, vi.fn()] as const,
}));

vi.mock("@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph", () => ({
  ObjectTypeResourceGraph: ({
    canAuthorizeObject,
    canRequestObjectPermission,
    networkName,
    objectType,
    objectWritable,
    onAuthorizeObject,
    onDeleteObject,
    onSelectObject,
  }: {
    canAuthorizeObject: boolean;
    canRequestObjectPermission: boolean;
    networkName: string;
    objectType: KnowledgeNetworkObjectTypeRecord;
    objectWritable?: (objectTypeId: string) => boolean;
    onAuthorizeObject: (objectType: KnowledgeNetworkObjectTypeRecord) => void;
    onDeleteObject: (objectType: KnowledgeNetworkObjectTypeRecord) => void;
    onSelectObject: (objectTypeId: string) => void;
  }) => {
    mocks.objectWritable = objectWritable;
    return (
      <div
        data-can-authorize={canAuthorizeObject}
        data-can-request={canRequestObjectPermission}
        data-network-name={networkName}
        data-object-type-id={objectType.id}
        data-testid="object-resource-graph"
      >
        <button onClick={() => onSelectObject("customer")} type="button">
          focus-customer
        </button>
        <button onClick={() => onAuthorizeObject(objectType)} type="button">
          authorize-object
        </button>
        <button onClick={() => onDeleteObject(objectType)} type="button">
          delete-object
        </button>
      </div>
    );
  },
}));

import { ObjectTypeListPanel } from "./ObjectTypeListPanel";

const order = {
  color: "#1677ff",
  conceptGroupIds: [],
  conceptGroupNames: [],
  description: "Sales order",
  hasIndex: true,
  id: "order",
  name: "Order",
  operations: ["view_detail", "delete"],
  tags: [],
  updateTime: "",
  updaterName: "",
} as KnowledgeNetworkObjectTypeRecord;

const customer = {
  ...order,
  id: "customer",
  name: "Customer",
};

const overdue = {
  ...order,
  id: "order_overdue",
  name: "Overdue order",
  tags: ["event"],
};

const overdueType: KnEventType = {
  check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
  code: "order_overdue",
  merge_hours: 0,
  name: "Overdue order",
  object_type_id: "order_overdue",
  rule: { basis: "function", tool: { box_id: "box-1", tool_id: "tool-1" } },
  rule_tool: { box_id: "box-1", tool_id: "tool-1" },
  severity: "P2",
  source: "rule",
  subject: "order",
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
  searchParams.delete("objectTypeId");
  searchParams.delete("view");
  mocks.listObjectTypes.mockResolvedValue({ entries: [order], totalCount: 1 });
  mocks.getObjectType.mockResolvedValue(customer);
  mocks.listEventTypes.mockResolvedValue([]);
  mocks.objectWritable = undefined;
  mocks.versioned = false;
  mocks.versionView = "running";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ObjectTypeListPanel graph view", () => {
  it("exposes the full object name on hover", async () => {
    const longName = "objectName".repeat(15);
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ ...order, name: longName }],
      totalCount: 1,
    });

    render(
      <ObjectTypeListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Sales"
        onDelete={vi.fn()}
      />,
    );

    const name = await screen.findByText(longName);
    expect(name).toHaveAttribute("title", longName);
  });

  it("offers list and graph modes and selects the first visible object for the graph", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <ObjectTypeListPanel
        canDelete
        canModify={false}
        networkId="network-1"
        networkName="Sales"
        onDelete={onDelete}
      />,
    );

    const graph = await screen.findByTestId("object-resource-graph");
    expect(graph.dataset.objectTypeId).toBe("order");
    expect(graph).toHaveAttribute("data-can-authorize", "true");
    expect(graph).toHaveAttribute("data-can-request", "true");
    expect(graph).toHaveAttribute("data-network-name", "Sales");
    expect(screen.getByText("knowledgeNetwork.objectTypeListView")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.objectTypeGraphView")).toBeInTheDocument();
    expect(
      screen
        .getAllByText(/knowledgeNetwork\.objectType(?:Graph|List)View/)
        .map((element) => element.textContent),
    ).toEqual(["knowledgeNetwork.objectTypeGraphView", "knowledgeNetwork.objectTypeListView"]);
    expect(
      screen.queryByRole("heading", { name: "knowledgeNetwork.objectTypesTitle" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /common\.delete/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "authorize-object" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/object-types/order/authorization",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/object-types?view=graph&objectTypeId=order&graphResourceKind=object&graphResourceId=order",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "delete-object" }));
    expect(mocks.confirm).toHaveBeenCalledOnce();
    const confirmation = mocks.confirm.mock.calls[0]?.[0] as { onOk: () => Promise<void> };
    await confirmation.onOk();
    expect(onDelete).toHaveBeenCalledWith([order]);

    fireEvent.click(screen.getByText("knowledgeNetwork.objectTypeListView"));
    expect(screen.queryByTestId("object-resource-graph")).not.toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
  });

  it("loads an object outside the current list page when the graph focus changes", async () => {
    render(
      <ObjectTypeListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Sales"
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "focus-customer" }, { timeout: 5_000 }),
    );

    await vi.waitFor(() => {
      expect(mocks.getObjectType).toHaveBeenCalledWith("network-1", "customer");
      expect(screen.getByTestId("object-resource-graph").dataset.objectTypeId).toBe("customer");
    });
  });

  it("falls back to the first visible object when the URL object is unavailable", async () => {
    searchParams.set("objectTypeId", "deleted-object");
    mocks.getObjectType.mockResolvedValue(null);

    render(
      <ObjectTypeListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Sales"
        onDelete={vi.fn()}
      />,
    );

    await vi.waitFor(() => {
      expect(mocks.getObjectType).toHaveBeenCalledWith("network-1", "deleted-object");
      expect(screen.getByTestId("object-resource-graph").dataset.objectTypeId).toBe("order");
    });
  });

  it("keeps the highlighted object and rendered graph in sync when selecting from the sidebar", async () => {
    mocks.listObjectTypes.mockResolvedValue({ entries: [order, customer], totalCount: 2 });

    render(
      <ObjectTypeListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Sales"
        onDelete={vi.fn()}
      />,
    );

    expect((await screen.findByTestId("object-resource-graph")).dataset.objectTypeId).toBe("order");
    fireEvent.click(screen.getByRole("button", { name: "Customer" }));

    await vi.waitFor(() => {
      expect(screen.getByTestId("object-resource-graph").dataset.objectTypeId).toBe("customer");
    });
  });
});

describe("ObjectTypeListPanel event classes", () => {
  beforeEach(() => {
    mocks.listObjectTypes.mockResolvedValue({ entries: [overdue, order], totalCount: 2 });
    mocks.listEventTypes.mockResolvedValue([overdueType]);
  });

  const renderPanel = (
    props: { onDelete?: (records: KnowledgeNetworkObjectTypeRecord[]) => Promise<void> } = {},
  ) =>
    render(
      <ObjectTypeListPanel
        canDelete
        canModify
        networkId="network-1"
        networkName="Sales"
        onDelete={props.onDelete ?? vi.fn().mockResolvedValue(undefined)}
      />,
    );

  const toEventClasses = (action: string) => [
    "/knowledge-network/workspace/network-1/event-classes",
    { state: { eventClassIntent: { action, code: "order_overdue" } } },
  ];

  it("tags only the event class, and creates event classes only under the dynamic model", async () => {
    renderPanel();

    expect(await screen.findByTestId("event-class-tag")).toBeInTheDocument();
    expect(screen.getAllByTestId("event-class-tag")).toHaveLength(1);
    expect(screen.queryByText("knowledgeNetwork.eventClasses.create")).not.toBeInTheDocument();
    expect(screen.getByText("common.create")).toBeInTheDocument();
  });

  it("sends the delete of an event class to its definition under the dynamic model", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onDelete });

    await screen.findByTestId("event-class-tag");
    expect(screen.getByTestId("object-resource-graph").dataset.objectTypeId).toBe("order_overdue");
    fireEvent.click(screen.getByRole("button", { name: "delete-object" }));

    expect(mocks.navigate).toHaveBeenCalledWith(...toEventClasses("delete"));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("links an event class in the list to its definition, and leaves it out of a batch delete", async () => {
    searchParams.set("view", "list");
    renderPanel();

    const link = await screen.findByRole("button", {
      name: "knowledgeNetwork.eventClasses.openDefinition",
    });
    fireEvent.click(link);

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith(...toEventClasses("view"));
    const eventRow = screen.getByText("Overdue order").closest("tr");
    const objectRow = screen.getByText("Order").closest("tr");
    expect(within(eventRow as HTMLElement).getByRole("checkbox")).toBeDisabled();
    expect(within(objectRow as HTMLElement).getByRole("checkbox")).toBeEnabled();
  });

  it("hides event class tags when the event module cannot be reached", async () => {
    mocks.listEventTypes.mockRejectedValue(new Error("not found"));
    renderPanel();

    expect(await screen.findByTestId("object-resource-graph")).toBeInTheDocument();
    await vi.waitFor(() => expect(mocks.listEventTypes).toHaveBeenCalled());
    expect(screen.queryByTestId("event-class-tag")).not.toBeInTheDocument();
  });

  it("offers no event class writes on the running version of a versioned network", async () => {
    // The running version is not edited, so its event classes are not written either.
    mocks.versioned = true;
    renderPanel();

    await screen.findByTestId("event-class-tag");
    expect(mocks.objectWritable?.("order_overdue")).toBe(false);
    expect(mocks.objectWritable?.("order")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "delete-object" }));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("offers event class writes on the draft of a versioned network", async () => {
    mocks.versioned = true;
    mocks.versionView = "draft";
    renderPanel();

    await screen.findByTestId("event-class-tag");
    expect(mocks.objectWritable?.("order_overdue")).toBe(true);
  });

  it("offers no edit or delete until it is known which object types are event classes", async () => {
    let answer: (types: KnEventType[]) => void = () => undefined;
    mocks.listEventTypes.mockReturnValue(
      new Promise<KnEventType[]>((resolve) => {
        answer = resolve;
      }),
    );
    renderPanel();

    expect(await screen.findByTestId("object-resource-graph")).toBeInTheDocument();
    expect(mocks.objectWritable?.("order_overdue")).toBe(false);
    // Deleting now would take the event class down the object type path.
    fireEvent.click(screen.getByRole("button", { name: "delete-object" }));
    expect(mocks.confirm).not.toHaveBeenCalled();

    answer([overdueType]);
    await screen.findByTestId("event-class-tag");
    expect(mocks.objectWritable?.("order_overdue")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "delete-object" }));
    expect(mocks.navigate).toHaveBeenCalledWith(...toEventClasses("delete"));
  });
});
