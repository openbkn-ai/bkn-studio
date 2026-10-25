/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  getObjectTypeDetail: vi.fn(),
  getOverviewGraph: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/knowledge-network/services/overview-graph.service", () => ({
  getKnowledgeNetworkOverviewGraph: mocks.getOverviewGraph,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectTypeDetail,
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => "available",
  useEntitlement: () => ({ edition: "enterprise", extensions: ["concept_groups"] }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({
    pathname: "/knowledge-network/workspace/network-1/concept-groups",
    search: "",
  }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer", () => ({
  ObjectMetricTrialDrawer: () => null,
}));

vi.mock("@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph", () => ({
  ObjectTypeResourceGraph: ({
    allowAuthorizeObject,
    allowEditObject,
    allowExecuteAction,
    allowTrialMetric,
    backLabel,
    canRequestObjectPermission,
    objectType,
    onBack,
  }: {
    allowAuthorizeObject?: boolean;
    allowEditObject?: boolean;
    allowExecuteAction?: boolean;
    allowTrialMetric?: boolean;
    backLabel?: string;
    canRequestObjectPermission: boolean;
    objectType: KnowledgeNetworkObjectTypeRecord;
    onBack?: () => void;
  }) => (
    <div
      data-allow-authorize={String(allowAuthorizeObject)}
      data-allow-edit={String(allowEditObject)}
      data-allow-execute={String(allowExecuteAction)}
      data-allow-trial={String(allowTrialMetric)}
      data-can-request-permission={String(canRequestObjectPermission)}
      data-object-type-id={objectType.id}
      data-testid="object-type-resource-graph"
    >
      {onBack ? (
        <button aria-label={backLabel} onClick={onBack} type="button">
          back
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@/modules/knowledge-network/components/preview/OntologyGraphCard", () => ({
  OntologyGraphCard: ({
    fillAvailableHeight,
    objectTypes,
    onExpandNode,
    relationTypes,
    showInspector,
    title,
  }: {
    fillAvailableHeight?: boolean;
    objectTypes: KnowledgeNetworkObjectTypeRecord[];
    onExpandNode?: (id: string) => void;
    relationTypes: KnowledgeNetworkRelationTypeRecord[];
    showInspector?: boolean;
    title: string;
  }) => (
    <div
      data-objects={objectTypes.map((item) => `${item.id}:${item.conceptGroupIds[0]}`).join(",")}
      data-fill-height={String(fillAvailableHeight)}
      data-relations={relationTypes
        .map((item) => `${item.id}:${item.sourceObjectTypeName}->${item.targetObjectTypeName}`)
        .join(",")}
      data-show-inspector={String(showInspector)}
      data-title={title}
      data-testid="ontology-graph-card"
    >
      <button onClick={() => onExpandNode?.("order")} type="button">
        order-node
      </button>
    </div>
  ),
}));

import { ConceptGroupGraphPanel } from "./ConceptGroupGraphPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConceptGroupGraphPanel", () => {
  it("loads the bounded group projection and maps it into the shared ontology graph", async () => {
    const onFocusedObjectTypeIdChange = vi.fn();
    mocks.getOverviewGraph.mockResolvedValue({
      graph: {
        nodes: [
          { color: "#1677ff", id: "order", name: "Order" },
          { color: "#52c41a", id: "customer", name: "Customer" },
        ],
        edges: [
          {
            id: "places",
            mappingMode: "direct",
            name: "Places",
            sourceId: "customer",
            targetId: "order",
          },
        ],
      },
      objectTypeTotal: 2,
      relationTypeTotal: 1,
      snapshot: "snapshot-1",
      truncated: true,
    });

    render(
      <ConceptGroupGraphPanel
        group={{
          actionTypesTotal: 0,
          color: "#1677ff",
          description: "Core sales concepts",
          id: "group-1",
          name: "Sales",
          objectTypesTotal: 2,
          relationTypesTotal: 1,
          tags: [],
          updateTime: "",
        }}
        networkId="network-1"
        onFocusedObjectTypeIdChange={onFocusedObjectTypeIdChange}
        onSelectedObjectTypeIdChange={vi.fn()}
        refreshVersion={0}
        selectedObjectTypeId={null}
      />,
    );

    const graph = await screen.findByTestId("ontology-graph-card");
    expect(mocks.getOverviewGraph).toHaveBeenCalledWith("network-1", {
      conceptGroupId: "group-1",
      edgeLimit: 1000,
      nodeLimit: 500,
    });
    expect(graph).toHaveAttribute("data-objects", "order:group-1,customer:group-1");
    expect(graph).toHaveAttribute("data-relations", "places:Customer->Order");
    expect(graph).toHaveAttribute("data-title", "Sales");
    expect(graph).toHaveAttribute("data-fill-height", "true");
    expect(graph).toHaveAttribute("data-show-inspector", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "order-node" }));
    expect(onFocusedObjectTypeIdChange).toHaveBeenCalledWith("order");
  });

  it("merges independently paged nodes and relations without dropping a cross-page edge", async () => {
    mocks.getOverviewGraph
      .mockResolvedValueOnce({
        graph: {
          nodes: [{ id: "order", name: "Order" }],
          edges: [
            {
              id: "places",
              name: "Places",
              sourceId: "customer",
              targetId: "order",
            },
          ],
        },
        nextCursor: "page-2",
        objectTypeTotal: 2,
        relationTypeTotal: 1,
        snapshot: "snapshot-1",
        truncated: true,
      })
      .mockResolvedValueOnce({
        graph: { edges: [], nodes: [{ id: "customer", name: "Customer" }] },
        objectTypeTotal: 2,
        relationTypeTotal: 1,
        snapshot: "snapshot-1",
        truncated: false,
      });

    render(
      <ConceptGroupGraphPanel
        group={{
          actionTypesTotal: 0,
          color: "#1677ff",
          description: "",
          id: "group-1",
          name: "Sales",
          objectTypesTotal: 2,
          relationTypesTotal: 1,
          tags: [],
          updateTime: "",
        }}
        networkId="network-1"
        onSelectedObjectTypeIdChange={vi.fn()}
        refreshVersion={0}
        selectedObjectTypeId={null}
      />,
    );

    await waitFor(() => expect(mocks.getOverviewGraph).toHaveBeenCalledTimes(2));
    expect(mocks.getOverviewGraph).toHaveBeenNthCalledWith(2, "network-1", {
      conceptGroupId: "group-1",
      cursor: "page-2",
      edgeLimit: 1000,
      nodeLimit: 500,
    });
    await waitFor(() =>
      expect(screen.getByTestId("ontology-graph-card")).toHaveAttribute(
        "data-objects",
        "order:group-1,customer:group-1",
      ),
    );
    expect(screen.getByTestId("ontology-graph-card")).toHaveAttribute(
      "data-relations",
      "places:Customer->Order",
    );
  });

  it("opens the selected object type with the shared full resource graph", async () => {
    mocks.getOverviewGraph.mockResolvedValue({
      graph: { edges: [], nodes: [{ id: "order", name: "Order" }] },
      objectTypeTotal: 1,
      relationTypeTotal: 0,
      snapshot: "snapshot-1",
      truncated: false,
    });
    mocks.getObjectTypeDetail.mockResolvedValue({
      color: "#1677ff",
      description: "Order object type",
      id: "order",
      name: "Order",
      operations: ["view_detail", "modify"],
      tags: [],
      updateTime: "",
      updaterName: "",
    });
    const onFocusedObjectTypeIdChange = vi.fn();

    render(
      <ConceptGroupGraphPanel
        focusedObjectTypeId="order"
        group={{
          actionTypesTotal: 0,
          color: "#1677ff",
          description: "Core sales concepts",
          id: "group-1",
          name: "Sales",
          objectTypesTotal: 1,
          relationTypesTotal: 0,
          tags: [],
          updateTime: "",
        }}
        networkId="network-1"
        networkName="Sales network"
        onFocusedObjectTypeIdChange={onFocusedObjectTypeIdChange}
        onSelectedObjectTypeIdChange={vi.fn()}
        refreshVersion={0}
        selectedObjectTypeId={null}
      />,
    );

    const resourceGraph = await screen.findByTestId("object-type-resource-graph");
    expect(resourceGraph).toHaveAttribute("data-object-type-id", "order");
    expect(resourceGraph).toHaveAttribute("data-allow-edit", "false");
    expect(resourceGraph).toHaveAttribute("data-allow-authorize", "false");
    expect(resourceGraph).toHaveAttribute("data-allow-execute", "false");
    expect(resourceGraph).toHaveAttribute("data-allow-trial", "false");
    expect(resourceGraph).toHaveAttribute("data-can-request-permission", "false");
    expect(mocks.getObjectTypeDetail).toHaveBeenCalledWith("network-1", "order");

    fireEvent.click(screen.getByRole("button", { name: /conceptGroupGraphBack/ }));
    expect(onFocusedObjectTypeIdChange).toHaveBeenCalledWith(null);
  });
});
