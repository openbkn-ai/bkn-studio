/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getKnowledgeNetworkActionTypeDetail: vi.fn(),
  getKnowledgeNetworkMetric: vi.fn(),
  getKnowledgeNetworkObjectTypeDetail: vi.fn(),
  getKnowledgeNetworkRelationTypeDetail: vi.fn(),
  listKnowledgeNetworkActionTypes: vi.fn(),
  listKnowledgeNetworkMetrics: vi.fn(),
  listKnowledgeNetworkObjectTypes: vi.fn(),
  listKnowledgeNetworkRelationTypes: vi.fn(),
  modalConfirm: vi.fn(),
  navigate: vi.fn(),
  routeParams: {
    current: {},
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({ state: null }),
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.routeParams.current,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => ({ currentUser: { permissions: [] } }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { success: vi.fn() },
    modal: { confirm: mocks.modalConfirm },
    runtimeConfig: { currentUser: { permissions: [] } },
  }),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  listBuildTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useResolvedUpdaterName: (name?: string) => name || "--",
}));

vi.mock(
  "@/modules/knowledge-network/components/object-type/useObjectTypePropertyTableState",
  () => ({
    useObjectTypePropertyTableState: () => ({
      columnVisibility: {},
      handleColumnConfigChange: vi.fn(),
      handleTableChange: vi.fn(),
      storageScope: "test",
      tableColumns: [],
    }),
  }),
);

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  deleteKnowledgeNetworkActionType: vi.fn(),
  deleteKnowledgeNetworkMetric: vi.fn(),
  deleteKnowledgeNetworkObjectType: vi.fn(),
  deleteKnowledgeNetworkRelationType: vi.fn(),
  getKnowledgeNetworkActionTypeDetail: mocks.getKnowledgeNetworkActionTypeDetail,
  getKnowledgeNetworkMetric: mocks.getKnowledgeNetworkMetric,
  getKnowledgeNetworkObjectTypeDetail: mocks.getKnowledgeNetworkObjectTypeDetail,
  getKnowledgeNetworkRelationTypeDetail: mocks.getKnowledgeNetworkRelationTypeDetail,
  getObjectTypeSampleData: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
  listKnowledgeNetworkActionTypes: mocks.listKnowledgeNetworkActionTypes,
  listKnowledgeNetworkMetrics: mocks.listKnowledgeNetworkMetrics,
  listKnowledgeNetworkObjectTypes: mocks.listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes: mocks.listKnowledgeNetworkRelationTypes,
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell",
  () => ({
    KnowledgeNetworkResourceConfigShell: ({
      actions,
      loading = false,
      title,
    }: {
      actions?: ReactNode;
      loading?: boolean;
      title: ReactNode;
    }) => (
      <div data-loading={String(loading)} data-testid="detail-shell">
        <div data-testid="detail-title">{title}</div>
        <div data-testid="detail-header-actions">{actions}</div>
      </div>
    ),
  }),
);

import { ActionTypeDetailScene } from "./ActionTypeDetailScene";
import { MetricDetailScene } from "./MetricDetailScene";
import { ObjectTypeDetailScene } from "./ObjectTypeDetailScene";
import { RelationTypeDetailScene } from "./RelationTypeDetailScene";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listKnowledgeNetworkActionTypes.mockResolvedValue([]);
  mocks.listKnowledgeNetworkMetrics.mockResolvedValue({ entries: [], totalCount: 0 });
  mocks.listKnowledgeNetworkObjectTypes.mockResolvedValue([]);
  mocks.listKnowledgeNetworkRelationTypes.mockResolvedValue([]);
});

describe("knowledge network detail scene headers", () => {
  it("shows action type operations granted by the detail record", async () => {
    mocks.routeParams.current = { actionTypeId: "action-1", networkId: "network-1" };
    mocks.getKnowledgeNetworkActionTypeDetail.mockResolvedValue({
      actionKind: "update",
      color: "#126ee3",
      description: "Action description",
      executionConfig: {
        actionSource: { type: "manual" },
        parameters: [],
        sourceName: "Manual",
        sourceType: "manual",
      },
      id: "action-1",
      name: "Update order",
      objectTypeId: "object-1",
      objectTypeName: "Order",
      operations: ["modify", "task_manage", "authorize", "delete"],
      tags: [],
      updateTime: "2026-08-20 16:09:36",
      updaterName: "admin",
    });

    render(<ActionTypeDetailScene />);

    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("true");
    expect(await screen.findByText("Update order")).not.toBeNull();
    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("false");
    expect(screen.getByText("common.edit")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.actionTypeExecutionEntry")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
    expect(screen.getByText("common.delete")).not.toBeNull();

    fireEvent.click(screen.getByText("knowledgeNetwork.actionTypeExecutionEntry"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/action-types/action-1/execution",
    );
  });

  it("shows object type operations granted by the detail record", async () => {
    mocks.routeParams.current = { networkId: "network-1", objectTypeId: "object-1" };
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      color: "#126ee3",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [],
      description: "Object description",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Order",
      operations: ["modify", "authorize", "delete"],
      primaryKeys: [],
      tags: [],
      updateTime: "2026-08-20 16:09:36",
      updaterName: "admin",
    });

    render(<ObjectTypeDetailScene />);

    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("true");
    expect(await screen.findByText("Order")).not.toBeNull();
    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("false");
    expect(screen.getByText("common.edit")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
    expect(screen.getByText("common.delete")).not.toBeNull();

    fireEvent.click(screen.getByText("common.edit"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/object-types/object-1/edit",
    );

    fireEvent.click(screen.getByText("common.delete"));
    expect(mocks.modalConfirm).toHaveBeenCalledOnce();
  });

  it("shows relation type operations granted by the detail record", async () => {
    mocks.routeParams.current = { networkId: "network-1", relationTypeId: "relation-1" };
    mocks.getKnowledgeNetworkRelationTypeDetail.mockResolvedValue({
      color: "#126ee3",
      description: "Relation description",
      id: "relation-1",
      mappingMode: "direct",
      name: "Contains",
      operations: ["modify", "authorize", "delete"],
      propertyMappings: [],
      resourceMappings: [],
      sourceObjectTypeId: "object-1",
      sourceObjectTypeName: "Order",
      tags: [],
      targetObjectTypeId: "object-2",
      targetObjectTypeName: "Item",
      updateTime: "2026-08-20 16:09:36",
      updaterName: "admin",
    });

    render(<RelationTypeDetailScene />);

    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("true");
    expect(await screen.findByText("Contains")).not.toBeNull();
    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("false");
    expect(screen.getByText("common.edit")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.relationTypeMappingEntry")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
    expect(screen.getByText("common.delete")).not.toBeNull();

    fireEvent.click(screen.getByText("knowledgeNetwork.relationTypeMappingEntry"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/relation-types/relation-1/mapping",
    );
  });

  it("shows metric operations granted by the detail record", async () => {
    mocks.routeParams.current = { metricId: "metric-1", networkId: "network-1" };
    mocks.getKnowledgeNetworkMetric.mockResolvedValue({
      calculationFormula: {
        aggregation: { aggr: "count", property: "id" },
      },
      description: "Metric description",
      id: "metric-1",
      metricType: "atomic",
      name: "Order count",
      operations: ["modify", "authorize", "delete"],
      scopeRef: "subgraph-1",
      scopeType: "subgraph",
      tags: [],
      updateTime: "2026-08-20 16:09:36",
      updaterName: "admin",
    });

    render(<MetricDetailScene />);

    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("true");
    expect(await screen.findByText("Order count")).not.toBeNull();
    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("false");
    expect(screen.getByText("common.edit")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
    expect(screen.getByText("common.delete")).not.toBeNull();

    fireEvent.click(screen.getByText("common.edit"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/metric-1/edit",
    );
  });
});
