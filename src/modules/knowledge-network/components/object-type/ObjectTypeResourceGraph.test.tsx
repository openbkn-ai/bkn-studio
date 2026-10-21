/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
  ObjectTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { KnowledgeNetworkGraphSelection } from "@/modules/knowledge-network/lib/knowledge-network-navigation";

const mocks = vi.hoisted(() => ({
  getActionDetail: vi.fn(),
  getObjectType: vi.fn(),
  listActions: vi.fn(),
  listMetrics: vi.fn(),
  listRelations: vi.fn(),
  resolveActionSource: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/action-type-tool.service", () => ({
  needsActionTypeActionSourceDisplayResolution: (source?: {
    boxId?: string;
    boxName?: string;
    mcpId?: string;
    mcpName?: string;
    toolId?: string;
    toolName?: string;
    type?: string;
  }) => {
    if (!source || source.type === "manual") return false;
    if (source.type === "mcp") {
      return Boolean(source.mcpId && (!source.mcpName || (source.toolId && !source.toolName)));
    }
    return Boolean(source.boxId && (!source.boxName || (source.toolId && !source.toolName)));
  },
  resolveActionTypeActionSourceDisplayWithTimeout: mocks.resolveActionSource,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkActionTypeDetail: mocks.getActionDetail,
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectType,
  listKnowledgeNetworkActionTypePage: mocks.listActions,
  listKnowledgeNetworkRelationTypePage: mocks.listRelations,
  listObjectMetricsV1: mocks.listMetrics,
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel",
  () => ({
    KnowledgeNetworkAuthorizationActionLabel: ({ children }: PropsWithChildren) => children,
  }),
);

vi.mock("@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction", () => ({
  ResourcePermissionRequestAction: ({ resourceID }: { resourceID: string }) => (
    <button data-resource-id={resourceID} type="button">
      申请权限
    </button>
  ),
}));

vi.mock("@/modules/knowledge-network/components/shared/resource-permission-request", () => ({
  canRequestResourcePermission: () => true,
}));

import { ObjectTypeResourceGraph } from "./ObjectTypeResourceGraph";

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

const objectType = {
  color: "#1677ff",
  conceptGroupIds: [],
  conceptGroupNames: [],
  dataProperties: [
    {
      displayKey: false,
      displayName: "订单金额",
      incrementalKey: false,
      name: "amount",
      primaryKey: false,
      type: "decimal",
    },
  ],
  description: "销售订单对象",
  displayKey: "id",
  hasIndex: true,
  id: "order",
  incrementalKey: "",
  logicProperties: [],
  name: "销售订单",
  operations: ["view_detail", "modify", "delete"],
  primaryKeys: ["id"],
  tags: [],
  updateTime: "",
  updaterName: "",
} as ObjectTypeDetail;

const relation = {
  color: "#1677ff",
  description: "订单所属客户",
  id: "order-customer",
  mappingMode: "direct",
  name: "客户关系",
  operations: ["view_detail", "modify", "delete"],
  sourceObjectTypeId: "order",
  sourceObjectTypeName: "销售订单",
  tags: [],
  targetObjectTypeId: "customer",
  targetObjectTypeName: "客户",
  updateTime: "",
  updaterName: "",
} as KnowledgeNetworkRelationTypeRecord;

const metric = {
  definition: {
    calculation_scope: "object_instance",
    code: "order_amount",
    description: "订单金额汇总",
    id: "order-amount",
    metric_type: "atomic",
    name: "订单金额",
    owner_object_type_id: "order",
    lifecycle: { status: "draft" },
    version: 1,
  },
} as ObjectMetricRecordV1;

const action = {
  actionKind: "update",
  color: "#faad14",
  description: "更新订单状态",
  id: "update-order",
  name: "更新订单",
  objectTypeId: "order",
  objectTypeName: "销售订单",
  operations: ["modify", "execute"],
  tags: [],
  updateTime: "",
  updaterName: "",
} as KnowledgeNetworkActionTypeRecord;

const customer = {
  ...objectType,
  color: "#722ed1",
  description: "下单客户实体",
  id: "customer",
  name: "客户",
  operations: ["modify"],
} as ObjectTypeDetail;

function renderGraph(
  metricsAvailable = true,
  options: {
    allowAuthorizeObject?: boolean;
    allowDeleteRelation?: boolean;
    allowEditObject?: boolean;
    canAuthorizeObject?: boolean;
    canModify?: boolean;
    canRequestObjectPermission?: boolean;
    enableActionOperations?: boolean;
    initialSelectedResource?: KnowledgeNetworkGraphSelection;
    objectType?: ObjectTypeDetail;
    permissionRequestsEnabled?: boolean;
    resourceScope?: "all" | "relations" | "actions";
  } = {},
) {
  const handlers = {
    onAuthorizeObject: vi.fn(),
    onAuthorizeAction: vi.fn(),
    onAuthorizeRelation: vi.fn(),
    onDeleteObject: vi.fn(),
    onDeleteAction: vi.fn(),
    onDeleteRelation: vi.fn(),
    onExecuteAction: vi.fn(),
    onEditObject: vi.fn(),
    onEditAction: vi.fn(),
    onOpenAction: vi.fn(),
    onOpenMetric: vi.fn(),
    onOpenObject: vi.fn(),
    onOpenRelation: vi.fn(),
    onOpenRelationMapping: vi.fn(),
    onSelectObject: vi.fn(),
    onTrialMetric: vi.fn(),
  };
  render(
    <ObjectTypeResourceGraph
      allowAuthorizeObject={options.allowAuthorizeObject}
      allowDeleteRelation={options.allowDeleteRelation}
      allowEditObject={options.allowEditObject}
      canAuthorizeObject={options.canAuthorizeObject ?? true}
      canModify={options.canModify ?? true}
      canRequestObjectPermission={options.canRequestObjectPermission ?? true}
      initialSelectedResource={options.initialSelectedResource}
      metricsAvailable={metricsAvailable}
      networkId="network-1"
      networkName="销售网络"
      objectType={options.objectType ?? objectType}
      permissionRequestsEnabled={options.permissionRequestsEnabled}
      refreshVersion={0}
      resourceScope={options.resourceScope}
      {...handlers}
      onAuthorizeAction={options.enableActionOperations ? handlers.onAuthorizeAction : undefined}
      onDeleteAction={options.enableActionOperations ? handlers.onDeleteAction : undefined}
      onEditAction={options.enableActionOperations ? handlers.onEditAction : undefined}
    />,
  );
  return handlers;
}

beforeEach(() => {
  mocks.resolveActionSource.mockResolvedValue({
    boxId: "box-id",
    boxName: "订单工具箱",
    toolId: "tool-id",
    toolName: "订单核对工具",
    type: "tool",
  });
  mocks.getActionDetail.mockResolvedValue({
    ...action,
    affect: { comment: "同步订单核对结果", objectTypeId: "order" },
    condition: { field: "amount", operation: ">", value: "100" },
    executionConfig: {
      actionSource: { toolId: "tool-1", toolName: "订单核对工具", type: "tool" },
      parameters: [
        { name: "orderId", sourcePropertyName: "id", valueFrom: "property" },
        { name: "operator", valueFrom: "input" },
      ],
      sourceName: "订单核对工具",
      sourceType: "tool",
    },
  });
  mocks.getObjectType.mockResolvedValue(customer);
  mocks.listRelations.mockResolvedValue({ entries: [relation], totalCount: 1 });
  mocks.listMetrics.mockResolvedValue({ entries: [metric], total_count: 1 });
  mocks.listActions.mockResolvedValue({ entries: [action], totalCount: 1 });
});

afterEach(() => {
  cleanup();
  mocks.listActions.mockReset();
  mocks.listMetrics.mockReset();
  mocks.listRelations.mockReset();
  mocks.getObjectType.mockReset();
  mocks.getActionDetail.mockReset();
  mocks.resolveActionSource.mockReset();
});

describe("ObjectTypeResourceGraph", () => {
  it.each([
    ["relations", "1 个关系类"],
    ["actions", "1 个行动类"],
  ] as const)("shows the total for the %s graph scope", async (resourceScope, summary) => {
    renderGraph(false, { resourceScope });

    expect(await screen.findByText(summary)).toBeInTheDocument();
  });

  it("groups metrics and actions in the overview and expands one resource group at a time", async () => {
    renderGraph();

    expect(await screen.findByRole("button", { name: "关系类 客户关系" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对象类 客户" })).toBeInTheDocument();
    const metricGroup = screen.getByRole("button", { name: "展开 指标 1" });
    const actionGroup = screen.getByRole("button", { name: "展开 行动类 1" });
    expect(metricGroup).toHaveAttribute("aria-pressed", "false");
    expect(actionGroup).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "指标 订单金额" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "行动类 更新订单" })).not.toBeInTheDocument();

    fireEvent.click(metricGroup);
    expect(screen.getByRole("button", { name: "收起 指标 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "指标 订单金额" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "行动类 更新订单" })).not.toBeInTheDocument();

    fireEvent.click(actionGroup);
    const actionNode = screen.getByRole("button", { name: "行动类 更新订单" });
    expect(actionNode).toBeInTheDocument();
    expect(actionNode.querySelector("circle")).not.toBeNull();
    expect(actionNode.querySelector("path")).toBeNull();
    expect(screen.queryByRole("button", { name: "指标 订单金额" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起 行动类 1" }));
    expect(screen.queryByRole("button", { name: "行动类 更新订单" })).not.toBeInTheDocument();
    expect(screen.queryByText("关系类 1 · 指标 1 · 行动类 1")).not.toBeInTheDocument();
    const graph = screen.getByRole("img", { name: "销售订单的对象类关联图谱" });
    expect(within(graph).queryByText(/^O$/)).not.toBeInTheDocument();
    expect(within(graph).queryByText(/^M$/)).not.toBeInTheDocument();
    expect(within(graph).queryByText(/^A$/)).not.toBeInTheDocument();
    const relationEdge = document.querySelector('[data-graph-edge="relation"]');
    expect(relationEdge).toHaveAttribute("data-source-object-type-id", "order");
    expect(relationEdge).toHaveAttribute("data-target-object-type-id", "customer");
    expect(relationEdge).toHaveAttribute("marker-end");

    expect(mocks.listRelations).toHaveBeenCalledWith("network-1", {
      boundObjectTypeId: "order",
      direction: "asc",
      limit: 12,
      offset: 0,
      sort: "name",
    });
    expect(mocks.listMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 12, offset: 0, ownerObjectTypeId: "order" },
      { skipErrorToast: true },
    );
    expect(mocks.listActions).toHaveBeenCalledWith("network-1", {
      direction: "asc",
      limit: 12,
      objectTypeId: "order",
      offset: 0,
      sort: "name",
    });
  });

  it("keeps additional relation types in the relation filter without showing a limit notice", async () => {
    const relations = Array.from({ length: 5 }, (_, index) => ({
      ...relation,
      id: `relation-${index + 1}`,
      name: `关系 ${index + 1}`,
      targetObjectTypeId: `target-${index + 1}`,
      targetObjectTypeName: `对象 ${index + 1}`,
    }));
    mocks.listRelations.mockResolvedValue({ entries: relations, totalCount: relations.length });
    renderGraph();

    await screen.findByRole("button", { name: "关系类 关系 4" });
    expect(screen.queryByText(/全部视图展示前/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "对象类 对象 5" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("关系类 5"));
    expect(screen.getByRole("button", { name: "对象类 对象 5" })).toBeInTheDocument();
  });

  it("shows a legend for the visible resource types and follows the active filter", async () => {
    renderGraph();

    await screen.findByRole("button", { name: "关系类 客户关系" });
    const legend = screen.getByLabelText("图例");
    ["当前对象类", "关联对象类", "关系类", "指标", "行动类"].forEach((label) =>
      expect(within(legend).getByText(label)).toBeInTheDocument(),
    );
    expect(within(legend).queryByText("原子指标")).not.toBeInTheDocument();
    expect(within(legend).queryByText("衍生指标")).not.toBeInTheDocument();
    expect(within(legend).queryByText("复合指标")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开 指标 1" }));
    expect(within(legend).getByText("原子指标")).toBeInTheDocument();

    fireEvent.click(screen.getByText("行动类 1"));
    expect(within(legend).getByText("当前对象类")).toBeInTheDocument();
    expect(within(legend).getByText("行动类")).toBeInTheDocument();
    expect(within(legend).queryByText("关联对象类")).not.toBeInTheDocument();
    expect(within(legend).queryByText("原子指标")).not.toBeInTheDocument();
  });

  it("opens the selected resource and keeps metric requests disabled without the capability", async () => {
    const handlers = renderGraph(false);

    fireEvent.click(await screen.findByRole("button", { name: "展开 行动类 1" }));
    await screen.findByRole("button", { name: "行动类 更新订单" });
    expect(mocks.listMetrics).not.toHaveBeenCalled();
    expect(screen.queryByRole("radio", { name: /指标/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "行动类 更新订单" }));
    expect(await screen.findByText("更新订单状态")).toBeInTheDocument();
    const drawer = screen.getByRole("dialog", { name: "行动类详情" });
    const actions = drawer.querySelector<HTMLElement>("[class*=drawerActions]");
    const descriptions = drawer.querySelector<HTMLElement>(".ant-descriptions");
    const description = within(drawer).getByText("描述").parentElement;
    expect(actions).not.toBeNull();
    expect(descriptions).not.toBeNull();
    expect(description).not.toBeNull();
    expect(within(drawer).getByRole("row", { name: "资源类型 行动类" })).toBeInTheDocument();
    expect(within(drawer).getByRole("row", { name: "业务动作 编辑" })).toBeInTheDocument();
    expect(
      within(drawer).getByRole("row", { name: "触发条件 订单金额 大于 100" }),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole("row", { name: "执行来源类型 工具" })).toBeInTheDocument();
    expect(
      within(drawer).getByRole("row", { name: "执行来源名称 订单核对工具" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("row", { name: /执行参数 2 个执行参数 · 1 个动态参数/ }),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole("row", { name: "影响对象类 销售订单" })).toBeInTheDocument();
    expect(
      within(drawer).getByRole("row", { name: "影响说明 同步订单核对结果" }),
    ).toBeInTheDocument();
    expect(
      actions!.compareDocumentPosition(descriptions!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      descriptions!.compareDocumentPosition(description!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行管理" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "执行管理" }));
    expect(handlers.onExecuteAction).toHaveBeenCalledWith(action);
    expect(within(drawer).queryByText("业务定义")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(handlers.onOpenAction).toHaveBeenCalledWith(action);
  });

  it("resolves action source and condition business names instead of showing internal IDs", async () => {
    mocks.getActionDetail.mockResolvedValue({
      ...action,
      condition: { field: "amount", operation: ">", value: "100" },
      executionConfig: {
        actionSource: { boxId: "box-id", toolId: "tool-id", type: "tool" },
        parameters: [],
        sourceName: "42c042b3-d547-4b21-aec9-a0ebdd65b21cd",
        sourceType: "tool",
      },
    });
    renderGraph();

    fireEvent.click(await screen.findByRole("button", { name: "展开 行动类 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "行动类 更新订单" }));
    const drawer = screen.getByRole("dialog", { name: "行动类详情" });

    expect(await within(drawer).findByText("订单工具箱/订单核对工具")).toHaveAttribute(
      "title",
      "订单工具箱/订单核对工具",
    );
    expect(within(drawer).getByText("订单金额 大于 100")).toBeInTheDocument();
    expect(
      within(drawer).queryByText("42c042b3-d547-4b21-aec9-a0ebdd65b21cd"),
    ).not.toBeInTheDocument();
  });

  it("loads an affected object business name outside the visible relation page", async () => {
    mocks.getActionDetail.mockResolvedValue({
      ...action,
      affect: { objectTypeId: "shipment" },
      executionConfig: {
        actionSource: { type: "manual" },
        parameters: [],
        sourceType: "manual",
      },
    });
    mocks.getObjectType.mockImplementation((_networkId: string, objectTypeId: string) =>
      Promise.resolve(
        objectTypeId === "shipment" ? { ...customer, id: "shipment", name: "发货单" } : objectType,
      ),
    );
    renderGraph();

    fireEvent.click(await screen.findByRole("button", { name: "展开 行动类 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "行动类 更新订单" }));
    const drawer = screen.getByRole("dialog", { name: "行动类详情" });

    expect(await within(drawer).findByText("发货单")).toBeInTheDocument();
    expect(within(drawer).queryByText("shipment")).not.toBeInTheDocument();
  });

  it("lays the current object on the left and action types in a right-hand column", async () => {
    const notifyAction = {
      ...action,
      actionKind: "notify",
      id: "notify-order",
      name: "短信推送",
    } as KnowledgeNetworkActionTypeRecord;
    mocks.listActions.mockResolvedValue({ entries: [action, notifyAction], totalCount: 2 });
    renderGraph();

    fireEvent.click(await screen.findByText("行动类 2"));
    const ownerNode = screen.getByRole("button", { name: "当前对象类 销售订单" });
    const updateNode = screen.getByRole("button", { name: "行动类 更新订单" });
    const notifyNode = screen.getByRole("button", { name: "行动类 短信推送" });
    const coordinate = (node: HTMLElement) => {
      const match = node.getAttribute("transform")?.match(/\(([-\d.]+) ([-\d.]+)/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    };
    const owner = coordinate(ownerNode);
    const update = coordinate(updateNode);
    const notify = coordinate(notifyNode);

    expect(owner.x).toBeLessThan(update.x);
    expect(owner.x).toBeLessThan(notify.x);
    expect(update.x).toBe(notify.x);
    expect(update.y).not.toBe(notify.y);
  });

  it("opens the current object node drawer and navigates to its details", async () => {
    const handlers = renderGraph();

    fireEvent.click(await screen.findByRole("button", { name: "当前对象类 销售订单" }));
    expect(await screen.findByText("销售订单对象")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "以此对象类为中心" })).not.toBeInTheDocument();
    const drawer = screen.getByRole("dialog", { name: "对象类详情" });
    expect(within(drawer).getByText("描述")).toBeInTheDocument();
    expect(within(drawer).queryByText("业务定义")).not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /编\s*辑/ })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "申请权限" })).toHaveAttribute(
      "data-resource-id",
      "network-1/order",
    );
    expect(within(drawer).getByRole("button", { name: "配置权限" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /删\s*除/ })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "配置权限" }));
    expect(handlers.onAuthorizeObject).toHaveBeenCalledWith(objectType);
    fireEvent.click(within(drawer).getByRole("button", { name: /删\s*除/ }));
    expect(handlers.onDeleteObject).toHaveBeenCalledWith(objectType);

    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(handlers.onOpenObject).toHaveBeenCalledWith("order");
  });

  it("hides object operations that are not available to the current user", async () => {
    const viewOnlyObject = {
      ...objectType,
      operations: ["view_detail"],
    } as ObjectTypeDetail;
    renderGraph(true, {
      canAuthorizeObject: false,
      canModify: false,
      canRequestObjectPermission: false,
      objectType: viewOnlyObject,
    });

    fireEvent.click(await screen.findByRole("button", { name: "当前对象类 销售订单" }));
    const drawer = screen.getByRole("dialog", { name: "对象类详情" });
    expect(within(drawer).getByRole("button", { name: "详情" })).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "申请权限" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "配置权限" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /删\s*除/ })).not.toBeInTheDocument();
  });

  it("can restrict object nodes to detail-only without hiding relation authorization", async () => {
    const handlers = renderGraph(true, {
      allowAuthorizeObject: false,
      allowDeleteRelation: true,
      allowEditObject: false,
    });

    fireEvent.click(await screen.findByRole("button", { name: "当前对象类 销售订单" }));
    let drawer = screen.getByRole("dialog", { name: "对象类详情" });
    expect(within(drawer).getByRole("button", { name: "详情" })).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "配置权限" })).not.toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    fireEvent.click(await screen.findByRole("button", { name: "关系类 客户关系" }));
    drawer = screen.getByRole("dialog", { name: "关系类详情" });
    fireEvent.click(within(drawer).getByRole("button", { name: "配置权限" }));
    expect(handlers.onAuthorizeRelation).toHaveBeenCalledWith(relation);
  });

  it("aligns action graph operations with the list", async () => {
    const fullAccessAction = {
      ...action,
      operations: ["view_detail", "modify", "execute", "delete"],
    } as KnowledgeNetworkActionTypeRecord;
    mocks.listActions.mockResolvedValue({ entries: [fullAccessAction], totalCount: 1 });
    mocks.getActionDetail.mockResolvedValue({
      ...fullAccessAction,
      executionConfig: {
        actionSource: { type: "manual" },
        parameters: [],
        sourceType: "manual",
      },
    });
    const handlers = renderGraph(true, {
      enableActionOperations: true,
      permissionRequestsEnabled: true,
      resourceScope: "actions",
    });

    fireEvent.click(await screen.findByRole("button", { name: "行动类 更新订单" }));
    const drawer = screen.getByRole("dialog", { name: "行动类详情" });

    expect(within(drawer).getByRole("button", { name: "详情" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "申请权限" })).toHaveAttribute(
      "data-resource-id",
      "network-1/update-order",
    );
    expect(within(drawer).getByRole("button", { name: /编\s*辑/ })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "执行管理" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "配置权限" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /删\s*除/ })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: /编\s*辑/ }));
    expect(handlers.onEditAction).toHaveBeenCalledWith(fullAccessAction);
    fireEvent.click(within(drawer).getByRole("button", { name: "执行管理" }));
    expect(handlers.onExecuteAction).toHaveBeenCalledWith(fullAccessAction);
    fireEvent.click(within(drawer).getByRole("button", { name: "配置权限" }));
    expect(handlers.onAuthorizeAction).toHaveBeenCalledWith(fullAccessAction);
    fireEvent.click(within(drawer).getByRole("button", { name: /删\s*除/ }));
    expect(handlers.onDeleteAction).toHaveBeenCalledWith(fullAccessAction);
  });

  it("restores the selected action drawer after returning to the graph", async () => {
    renderGraph(true, {
      initialSelectedResource: { id: action.id, kind: "action" },
      resourceScope: "actions",
    });

    const drawer = await screen.findByRole("dialog", { name: "行动类详情" });
    expect(within(drawer).getByText("更新订单")).toBeInTheDocument();
  });

  it("aligns relation graph operations with the list while keeping edit removed", async () => {
    const handlers = renderGraph(true, {
      allowDeleteRelation: true,
      permissionRequestsEnabled: true,
    });

    fireEvent.click(await screen.findByRole("button", { name: "关系类 客户关系" }));
    const drawer = screen.getByRole("dialog", { name: "关系类详情" });
    expect(within(drawer).getByRole("row", { name: "起点对象类 销售订单" })).toBeInTheDocument();
    expect(within(drawer).getByRole("row", { name: "终点对象类 客户" })).toBeInTheDocument();
    expect(within(drawer).getByText("描述")).toBeInTheDocument();
    expect(within(drawer).queryByText("业务定义")).not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "申请权限" })).toHaveAttribute(
      "data-resource-id",
      "network-1/order-customer",
    );
    expect(within(drawer).getByRole("button", { name: "映射配置" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "配置权限" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /删\s*除/ })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "映射配置" }));
    expect(handlers.onOpenRelationMapping).toHaveBeenCalledWith(relation);
    fireEvent.click(within(drawer).getByRole("button", { name: "配置权限" }));
    expect(handlers.onAuthorizeRelation).toHaveBeenCalledWith(relation);
    fireEvent.click(within(drawer).getByRole("button", { name: /删\s*除/ }));
    expect(handlers.onDeleteRelation).toHaveBeenCalledWith(relation);

    fireEvent.click(within(drawer).getByRole("button", { name: "详情" }));
    expect(handlers.onOpenRelation).toHaveBeenCalledWith(relation);
    expect(within(drawer).queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();
  });

  it("shows metric metadata and edit action in the metric drawer", async () => {
    const handlers = renderGraph();

    fireEvent.click(await screen.findByRole("button", { name: "展开 指标 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "指标 订单金额" }));
    expect(await screen.findByText("v1")).toBeInTheDocument();
    expect(screen.getByText("草稿")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: "资源类型 指标" })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /指标编码 order_amount/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: "指标类型 原子指标" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: "所属对象类 销售订单" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: "计算范围 单个实例" })).toBeInTheDocument();
    expect(screen.getByText("业务定义")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "试算" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    expect(handlers.onTrialMetric).toHaveBeenCalledWith(metric);
    expect(screen.queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /删\s*除/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "废弃" })).not.toBeInTheDocument();
  });

  it("moves the graph focus immediately when a neighboring object is clicked", async () => {
    const handlers = renderGraph();

    fireEvent.click(await screen.findByRole("button", { name: "对象类 客户" }));

    expect(handlers.onSelectObject).toHaveBeenCalledWith("customer");
    expect(mocks.getObjectType).not.toHaveBeenCalled();
    expect(handlers.onOpenObject).not.toHaveBeenCalled();
  });

  it("keeps the relation label attached to the edge when a neighboring object is moved", async () => {
    renderGraph();

    const relationLabel = await screen.findByRole("button", { name: "关系类 客户关系" });
    const neighborNode = screen.getByRole("button", { name: "对象类 客户" });
    const graph = screen.getByRole("img", { name: "销售订单的对象类关联图谱" });
    vi.spyOn(graph, "getBoundingClientRect").mockReturnValue({
      bottom: 620,
      height: 620,
      left: 0,
      right: 1120,
      top: 0,
      width: 1120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const initialLabelPosition = relationLabel.getAttribute("transform");

    fireEvent.pointerDown(neighborNode, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(graph, { clientX: 120, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(graph, { pointerId: 1 });

    expect(relationLabel.getAttribute("transform")).not.toBe(initialLabelPosition);
  });

  it("moves metric and action group nodes with their lines when either line is dragged", async () => {
    renderGraph();

    const metricGroup = await screen.findByRole("button", { name: "展开 指标 1" });
    const actionGroup = screen.getByRole("button", { name: "展开 行动类 1" });
    const graph = screen.getByRole("img", { name: "销售订单的对象类关联图谱" });
    vi.spyOn(graph, "getBoundingClientRect").mockReturnValue({
      bottom: 620,
      height: 620,
      left: 0,
      right: 1120,
      top: 0,
      width: 1120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    for (const [handleName, group] of [
      ["metric-group", metricGroup],
      ["action-group", actionGroup],
    ] as const) {
      const handle = document.querySelector(`[data-graph-edge-drag-handle="${handleName}"]`);
      expect(handle).not.toBeNull();
      const initialPosition = group.getAttribute("transform");
      const initialLine = handle?.getAttribute("d");

      fireEvent.pointerDown(handle!, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(graph, { clientX: 112, clientY: 62, pointerId: 1 });
      fireEvent.pointerUp(graph, { pointerId: 1 });

      expect(group.getAttribute("transform")).not.toBe(initialPosition);
      expect(handle?.getAttribute("d")).not.toBe(initialLine);
    }
  });

  it("registers graph wheel zoom as a non-passive native listener", () => {
    const listener = vi.spyOn(SVGSVGElement.prototype, "addEventListener");
    try {
      renderGraph();
      expect(listener).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    } finally {
      listener.mockRestore();
    }
  });

  it("lays metrics out from left to right by their dependency depth", async () => {
    const derivedMetric = {
      ...metric,
      definition: {
        ...metric.definition,
        id: "average-order-amount",
        metric_type: "derived",
        name: "平均订单金额",
        specification: {
          base_metric: { metric_id: "order-amount", version: 1 },
          kind: "derived",
        },
        version: 2,
      },
    } as ObjectMetricRecordV1;
    const compositeMetric = {
      ...metric,
      definition: {
        ...metric.definition,
        id: "order-forecast-score",
        metric_type: "composite",
        name: "订单预测评分",
        specification: {
          dependencies: [
            {
              metric_ref: { metric_id: "average-order-amount", version: 2 },
            },
          ],
          kind: "composite",
        },
        version: 3,
      },
    } as ObjectMetricRecordV1;
    mocks.listMetrics.mockResolvedValue({
      entries: [metric, derivedMetric, compositeMetric],
      total_count: 3,
    });
    renderGraph();

    fireEvent.click(await screen.findByText("指标 3"));
    const ownerNode = screen.getByRole("button", { name: "当前对象类 销售订单" });
    const atomicNode = screen.getByRole("button", { name: "指标 订单金额" });
    const derivedNode = screen.getByRole("button", { name: "指标 平均订单金额" });
    const compositeNode = screen.getByRole("button", { name: "指标 订单预测评分" });
    const x = (node: HTMLElement) =>
      Number(node.getAttribute("transform")?.match(/\(([-\d.]+)/)?.[1]);

    expect(x(ownerNode)).toBeLessThan(x(atomicNode));
    expect(x(atomicNode)).toBeLessThan(x(derivedNode));
    expect(x(derivedNode)).toBeLessThan(x(compositeNode));
    expect(atomicNode.querySelector("circle")).not.toBeNull();
    expect(derivedNode.querySelector("circle")).not.toBeNull();
    expect(compositeNode.querySelector("circle")).not.toBeNull();
    expect(derivedNode.querySelector("rect, path")).toBeNull();
    expect(compositeNode.querySelector("rect, path")).toBeNull();
    const legend = screen.getByLabelText("图例");
    ["原子指标", "衍生指标", "复合指标", "指标依赖"].forEach((label) =>
      expect(within(legend).getByText(label)).toBeInTheDocument(),
    );
    expect(document.querySelector("[class*=metricDependencyEdge]")).toHaveAttribute("marker-end");
  });

  it("uses the metric dependency layout when expanding metrics in the overview", async () => {
    const derivedMetric = {
      ...metric,
      definition: {
        ...metric.definition,
        id: "average-order-amount",
        metric_type: "derived",
        name: "平均订单金额",
        specification: {
          base_metric: { metric_id: "order-amount", version: 1 },
          kind: "derived",
        },
        version: 2,
      },
    } as ObjectMetricRecordV1;
    const compositeMetric = {
      ...metric,
      definition: {
        ...metric.definition,
        id: "order-forecast-score",
        metric_type: "composite",
        name: "订单预测评分",
        specification: {
          dependencies: [
            {
              metric_ref: { metric_id: "average-order-amount", version: 2 },
            },
          ],
          kind: "composite",
        },
        version: 3,
      },
    } as ObjectMetricRecordV1;
    mocks.listMetrics.mockResolvedValue({
      entries: [metric, derivedMetric, compositeMetric],
      total_count: 3,
    });
    renderGraph();

    fireEvent.click(await screen.findByRole("button", { name: "展开 指标 3" }));
    const metricGroup = screen.getByRole("button", { name: "收起 指标 3" });
    const atomicNode = screen.getByRole("button", { name: "指标 订单金额" });
    const derivedNode = screen.getByRole("button", { name: "指标 平均订单金额" });
    const compositeNode = screen.getByRole("button", { name: "指标 订单预测评分" });
    const x = (node: HTMLElement) =>
      Number(node.getAttribute("transform")?.match(/\(([-\d.]+)/)?.[1]);

    expect(x(metricGroup)).toBeLessThan(x(atomicNode));
    expect(x(atomicNode)).toBeLessThan(x(derivedNode));
    expect(x(derivedNode)).toBeLessThan(x(compositeNode));
    expect(document.querySelectorAll("[class*=metricDependencyEdge]")).toHaveLength(2);
    const metricSpokes = document.querySelectorAll('[data-graph-edge="metric-spoke"]');
    expect(metricSpokes).toHaveLength(1);
    expect(metricSpokes[0]).toHaveAttribute("data-target-metric-id", "order-amount");
  });

  it("keeps available resources visible when one resource request fails", async () => {
    mocks.listRelations.mockRejectedValue(new Error("关系类服务不可用"));
    renderGraph();

    expect(await screen.findByText("部分关联资源加载失败")).toBeInTheDocument();
    expect(screen.getByText("关系类服务不可用")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "展开 指标 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "展开 行动类 1" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "展开 指标 1" }));
    expect(screen.getByRole("button", { name: "指标 订单金额" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开 行动类 1" }));
    expect(screen.getByRole("button", { name: "行动类 更新订单" })).toBeInTheDocument();
  });
});
