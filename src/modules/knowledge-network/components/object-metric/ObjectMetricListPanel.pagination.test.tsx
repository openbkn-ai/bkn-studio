/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Modal } from "antd";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

const mocks = vi.hoisted(() => ({
  canAuthorize: { current: true },
  checkDeletion: vi.fn(),
  createNextDraft: vi.fn(),
  deleteVersion: vi.fn(),
  getObjectDetail: vi.fn(),
  getObjectType: vi.fn(),
  listObjectTypes: vi.fn(),
  listObjectMetrics: vi.fn(),
  messageWarning: vi.fn(),
  navigate: vi.fn(),
  queryDrillThrough: vi.fn(),
  queryMetric: vi.fn(),
  searchParams: { current: "" },
  setSearchParams: vi.fn(),
  setPageSize: vi.fn(),
  trialMetric: vi.fn(),
  trialDrillThrough: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { total?: number }) =>
      key === "common.total" ? `total:${values?.total ?? 0}` : key,
  }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(mocks.searchParams.current), mocks.setSearchParams],
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn(), warning: mocks.messageWarning },
  }),
}));

vi.mock("@/modules/knowledge-network/components/shared/usePersistentPageSize", () => ({
  usePersistentPageSize: () => [10, mocks.setPageSize],
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricGraphCanvas", () => ({
  ObjectMetricGraphCanvas: ({
    metricType,
    objectTypeSearchEmpty,
    objectTypesLoading,
    onAuthorizeMetric,
    onEditMetric,
    onOpenMetric,
    onRestrictedObjectClick,
    restrictedObjectTypes,
    selectedObjectTypeName,
  }: {
    metricType?: string;
    objectTypeSearchEmpty?: boolean;
    objectTypesLoading?: boolean;
    onAuthorizeMetric?: (record: ObjectMetricRecordV1) => void;
    onEditMetric: (record: ObjectMetricRecordV1) => void;
    onOpenMetric: (record: ObjectMetricRecordV1) => void;
    onRestrictedObjectClick?: () => void;
    restrictedObjectTypes?: boolean;
    selectedObjectTypeName: string;
  }) => (
    <div
      data-metric-type={metricType ?? ""}
      data-object-search-empty={String(Boolean(objectTypeSearchEmpty))}
      data-object-types-loading={String(Boolean(objectTypesLoading))}
      data-restricted-object-types={String(Boolean(restrictedObjectTypes))}
      data-testid="metric-graph"
    >
      <div className="graphPanelTitle">
        <strong>{selectedObjectTypeName}</strong>
      </div>
      metric graph
      {onAuthorizeMetric ? (
        <button onClick={() => onAuthorizeMetric(metric(1))}>Authorize graph metric</button>
      ) : null}
      <button onClick={() => onOpenMetric(metric(1))}>Open graph metric</button>
      <button onClick={() => onEditMetric(metric(1))}>Edit graph metric</button>
      <button onClick={onRestrictedObjectClick}>Open restricted object</button>
    </div>
  ),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => mocks.canAuthorize.current,
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel",
  () => ({
    KnowledgeNetworkAuthorizationActionLabel: ({ children }: { children: ReactNode }) => children,
  }),
);

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricAuthorizeDrawer", () => ({
  ObjectMetricAuthorizeDrawer: ({
    metric,
    networkId,
    networkName,
    open,
  }: {
    metric?: ObjectMetricRecordV1;
    networkId: string;
    networkName?: string;
    open: boolean;
  }) =>
    open ? (
      <div
        data-metric-id={metric?.definition.id}
        data-network-id={networkId}
        data-network-name={networkName}
        data-testid="metric-authorization-drawer"
      />
    ) : null,
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer", () => ({
  ObjectMetricTrialDrawer: ({
    definition,
    mode,
    networkId,
    objectType,
    onClose,
    onDrillThrough,
    onRun,
  }: {
    definition: { name: string };
    mode: string;
    networkId?: string;
    objectType?: { id: string } | null;
    onClose: () => void;
    onDrillThrough: (query: Record<string, never>, bucketKey: string) => Promise<unknown>;
    onRun: (query: Record<string, never>) => Promise<unknown>;
  }) => (
    <div
      data-testid="list-metric-trial"
      data-mode={mode}
      data-name={definition.name}
      data-network-id={networkId}
      data-object-type={objectType?.id ?? ""}
    >
      <button onClick={() => void onRun({})}>Run trial</button>
      <button onClick={() => void onDrillThrough({}, "selected-bucket")}>View participants</button>
      <button onClick={onClose}>Close trial</button>
    </div>
  ),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  checkObjectMetricVersionDeletionV1: mocks.checkDeletion,
  createNextObjectMetricDraftV1: mocks.createNextDraft,
  deleteObjectMetricVersionV1: mocks.deleteVersion,
  deprecateObjectMetricV1: vi.fn(),
  listObjectMetricsV1: mocks.listObjectMetrics,
  queryObjectMetricDrillThroughV1: mocks.queryDrillThrough,
  queryObjectMetricDataV1: mocks.queryMetric,
  trialObjectMetricDrillThroughV1: mocks.trialDrillThrough,
  trialObjectMetricDataV1: mocks.trialMetric,
}));
vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectType: mocks.getObjectType,
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectDetail,
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypes,
}));

import { ObjectMetricListPanel } from "./ObjectMetricListPanel";

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
  mocks.canAuthorize.current = true;
  mocks.checkDeletion.mockReset();
  mocks.checkDeletion.mockImplementation((_networkId: string, metricId: string, version: number) =>
    Promise.resolve({
      blockers: [],
      deletable: true,
      hidden_blocker_count: 0,
      metric_id: metricId,
      metric_name: "Metric",
      status: "draft",
      version,
    }),
  );
  mocks.createNextDraft.mockReset();
  mocks.deleteVersion.mockReset();
  mocks.getObjectDetail.mockReset();
  mocks.getObjectDetail.mockResolvedValue(null);
  mocks.getObjectType.mockReset();
  mocks.getObjectType.mockResolvedValue(null);
  mocks.listObjectTypes.mockReset();
  mocks.listObjectMetrics.mockReset();
  mocks.messageWarning.mockReset();
  mocks.navigate.mockReset();
  mocks.queryDrillThrough.mockReset();
  mocks.queryMetric.mockReset();
  mocks.searchParams.current = "";
  mocks.setSearchParams.mockReset();
  mocks.setPageSize.mockReset();
  mocks.trialMetric.mockReset();
  mocks.trialDrillThrough.mockReset();
});

mocks.getObjectDetail.mockResolvedValue(null);
mocks.getObjectType.mockResolvedValue(null);
mocks.checkDeletion.mockImplementation((_networkId: string, metricId: string, version: number) =>
  Promise.resolve({
    blockers: [],
    deletable: true,
    hidden_blocker_count: 0,
    metric_id: metricId,
    metric_name: "Metric",
    status: "draft",
    version,
  }),
);

function metric(index: number): ObjectMetricRecordV1 {
  return {
    branch: "main",
    create_time: 1,
    creator: { id: "tester", type: "user" },
    definition: {
      calculation_scope: "object_set",
      code: `order_metric_${index}`,
      description: `Metric ${index}`,
      id: `metric-${index}`,
      lifecycle: {
        aggregation_registry_version: "1.0",
        expression_language_version: "1.0",
        function_registry_version: "1.0",
        ontology_version: "current",
        status: "published",
        unit_registry_version: "1.0",
      },
      metric_type: "atomic",
      name: `订单对象指标 ${index}`,
      owner_object_type_id: "order",
      query_capabilities: { analysis_dimensions: [], time_dimensions: [] },
      result_semantics: {
        no_data_policy: "zero",
        partial_data_policy: "reject",
        statistical_grain: { group_by_dimensions: [] },
        value: { physical_type: "int64", semantic_type: "count" },
      },
      specification: { kind: "atomic", measure: { aggregation: "count_rows" } },
      version: 1,
    },
    kn_id: "network-1",
    update_time: 1,
    updater: { id: "tester", type: "user" },
  };
}

async function openMetricActionMenu(index = 0) {
  const actionButtons = await screen.findAllByRole("button", { name: "common.actions" });
  fireEvent.click(actionButtons[index]);
}

describe("ObjectMetricListPanel pagination", () => {
  it("enables the restricted-object graph only after an empty unfiltered object query", async () => {
    mocks.listObjectTypes.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    const graph = await screen.findByTestId("metric-graph");
    await waitFor(() => expect(graph).toHaveAttribute("data-restricted-object-types", "true"));
    expect(graph).toHaveAttribute("data-object-search-empty", "false");
    fireEvent.click(screen.getByRole("button", { name: "Open restricted object" }));
    expect(mocks.messageWarning).toHaveBeenCalledWith("你没有该对象类的查看权限。");
  });

  it("shows the projected owner name without exposing its id or linking to the graph", async () => {
    mocks.searchParams.current = "view=list";
    mocks.getObjectDetail.mockRejectedValue(new Error("forbidden"));
    mocks.listObjectTypes.mockResolvedValue({ entries: [], totalCount: 0 });
    const record = metric(1);
    record.owner_object_type_name = "销售订单";
    mocks.listObjectMetrics.mockResolvedValue({ entries: [record], total_count: 1 });

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    expect(await screen.findByText("销售订单")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "order" })).not.toBeInTheDocument();
  });

  it("uses neutral owner wording when the object detail request fails", async () => {
    mocks.searchParams.current = "view=list";
    mocks.getObjectDetail.mockRejectedValue(new Error("server unavailable"));
    mocks.listObjectTypes.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    expect(await screen.findByText("对象类信息不可用")).toBeInTheDocument();
    expect(screen.queryByText("order")).not.toBeInTheDocument();
  });

  it("opens authorization for a metric from list and graph views", async () => {
    mocks.searchParams.current = "view=list";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    render(
      <ObjectMetricListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="销售网络"
      />,
    );

    await openMetricActionMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "knowledgeNetwork.authorizeAction" }),
    );
    expect(screen.getByTestId("metric-authorization-drawer")).toHaveAttribute(
      "data-metric-id",
      "metric-1",
    );
    expect(screen.getByTestId("metric-authorization-drawer")).toHaveAttribute(
      "data-network-name",
      "销售网络",
    );

    fireEvent.click(screen.getByText(/^(图谱|graph)$/i));
    fireEvent.click(await screen.findByRole("button", { name: "Authorize graph metric" }));
    expect(screen.getByTestId("metric-authorization-drawer")).toHaveAttribute(
      "data-metric-id",
      "metric-1",
    );
  });

  it("hides metric authorization without knowledge-network authorize permission", async () => {
    mocks.searchParams.current = "view=list";
    mocks.canAuthorize.current = false;
    mocks.listObjectTypes.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    expect(await screen.findByText("订单对象指标 1")).toBeInTheDocument();
    await openMetricActionMenu();
    expect(
      screen.queryByRole("menuitem", { name: "knowledgeNetwork.authorizeAction" }),
    ).not.toBeInTheDocument();
  });

  it("hides the metric-type filter in graph mode and does not apply a list filter", async () => {
    mocks.searchParams.current = "metricType=atomic";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    const { container } = render(
      <ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />,
    );

    expect(await screen.findByTitle("销售订单")).not.toBeNull();
    expect(container.querySelector(".ant-select")).toBeNull();
    expect(screen.getByTestId("metric-graph")).toHaveAttribute("data-metric-type", "");
  });

  it("shows one creation entry with metric types and opens the chosen type with the designer", async () => {
    mocks.searchParams.current = "view=list&ownerObjectTypeId=order";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    render(<ObjectMetricListPanel canDelete canModify networkId="network-1" />);

    const aiCreate = await screen.findByRole("button", { name: /AI 创建/ });
    expect(aiCreate).toBeEnabled();
    expect(screen.queryByRole("button", { name: "新建对象指标" })).not.toBeInTheDocument();
    fireEvent.mouseEnter(aiCreate);
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "原子对象指标",
      "衍生对象指标",
      "复合对象指标",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "衍生对象指标" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/create?objectTypeId=order&metricType=derived",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?view=list&ownerObjectTypeId=order",
        },
      },
    );
  });

  it("asks for an owner object type before creating from the unfiltered list", async () => {
    mocks.searchParams.current = "view=list";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    render(<ObjectMetricListPanel canDelete canModify networkId="network-1" />);

    const aiCreate = await screen.findByRole("button", { name: /AI 创建/ });
    fireEvent.mouseEnter(aiCreate);
    fireEvent.click(await screen.findByRole("menuitem", { name: "原子对象指标" }));

    expect(await screen.findByText("选择对象指标所属对象类")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("loads sidebar counts only for object rows entering the viewport", async () => {
    let notifyVisibility: IntersectionObserverCallback | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          notifyVisibility = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      mocks.listObjectTypes.mockResolvedValue({
        entries: [
          { id: "object-1", name: "对象 1" },
          { id: "object-2", name: "对象 2" },
        ],
        totalCount: 2,
      });
      let resolveFirst: ((result: { entries: never[]; total_count: number }) => void) | undefined;
      mocks.listObjectMetrics.mockImplementation(
        (_networkId: string, query: { ownerObjectTypeId: string }) =>
          query.ownerObjectTypeId === "object-1"
            ? new Promise((resolve) => {
                resolveFirst = resolve;
              })
            : Promise.resolve({ entries: [], total_count: 7 }),
      );
      render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);
      const first = await screen.findByTitle("对象 1");
      await waitFor(() => expect(notifyVisibility).toBeDefined());
      expect(mocks.listObjectMetrics).not.toHaveBeenCalled();

      act(() => {
        notifyVisibility?.(
          [{ isIntersecting: true, target: first } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });
      await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(1));
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
        "network-1",
        { limit: 1, offset: 0, ownerObjectTypeId: "object-1" },
        { skipErrorToast: true },
      );
      expect(screen.getByTitle("对象 2").textContent).toContain("…");

      act(() => {
        notifyVisibility?.(
          [
            {
              isIntersecting: true,
              target: screen.getByTitle("对象 2"),
            } as unknown as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        );
      });
      await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(2));
      resolveFirst?.({ entries: [], total_count: 3 });
      await waitFor(() => expect(screen.getByTitle("对象 1").textContent).toContain("3"));
      expect(screen.getByTitle("对象 2").textContent).toContain("7");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("loads all metrics in list mode without requiring a graph object selection", async () => {
    mocks.searchParams.current = "view=list&objectQuery=missing";
    mocks.listObjectTypes.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    expect(await screen.findByText("订单对象指标 1")).toBeInTheDocument();
    expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({ ownerObjectTypeId: undefined }),
    );
  });

  it("opens the graph-selected version and returns to the graph", async () => {
    mocks.searchParams.current = "objectTypeId=order";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    render(<ObjectMetricListPanel canDelete canModify networkId="network-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Open graph metric" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/metric-1/detail?version=1",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?objectTypeId=order&graphMetricId=metric-1&graphMetricVersion=1",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit graph metric" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/metric-1/edit",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?objectTypeId=order&graphMetricId=metric-1&graphMetricVersion=1",
        },
      },
    );
  });

  it("keeps the list loader in the visible viewport instead of the horizontally scrollable table", () => {
    mocks.searchParams.current = "view=list&ownerObjectTypeId=order";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />,
    );
    const loading = container.querySelector<HTMLElement>("[class*=tableLoading]");
    const viewport = container.querySelector<HTMLElement>("[class*=tableViewport]");

    expect(loading).toBeInTheDocument();
    expect(loading?.querySelector(".ant-spin")).toBeInTheDocument();
    expect(loading?.parentElement).toBe(viewport?.parentElement);
    expect(viewport?.contains(loading)).toBe(false);
    expect(viewport?.querySelector(".ant-spin-spinning")).toBeNull();
  });

  it.each([
    ["published", "published", "queryMetric"],
    ["deprecated", "published", "queryMetric"],
    ["draft", "draft", "trialMetric"],
    ["validated", "draft", "trialMetric"],
  ] as const)("opens the %s metric trial from the list", async (status, mode, service) => {
    mocks.searchParams.current = "view=list&ownerObjectTypeId=order";
    const record = metric(1);
    record.definition.lifecycle.status = status;
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [record], total_count: 1 });
    mocks.getObjectDetail.mockResolvedValue({ id: "order", name: "销售订单" });
    mocks.queryMetric.mockResolvedValue({});
    mocks.trialMetric.mockResolvedValue({});

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    await openMetricActionMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "试算" }));
    const drawer = await screen.findByTestId("list-metric-trial");
    expect(drawer).toHaveAttribute("data-mode", mode);
    expect(drawer).toHaveAttribute("data-name", "订单对象指标 1");
    expect(drawer).toHaveAttribute("data-network-id", "network-1");
    expect(drawer).toHaveAttribute("data-object-type", "order");
    fireEvent.click(screen.getByRole("button", { name: "Run trial" }));
    if (service === "queryMetric") {
      expect(mocks.queryMetric).toHaveBeenCalledWith("network-1", "metric-1", 1, {});
      expect(mocks.trialMetric).not.toHaveBeenCalled();
    } else {
      expect(mocks.trialMetric).toHaveBeenCalledWith("network-1", record.definition, {});
      expect(mocks.queryMetric).not.toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole("button", { name: "View participants" }));
    if (service === "queryMetric") {
      expect(mocks.queryDrillThrough).toHaveBeenCalledWith(
        "network-1",
        "metric-1",
        1,
        {},
        "selected-bucket",
        undefined,
      );
      expect(mocks.trialDrillThrough).not.toHaveBeenCalled();
    } else {
      expect(mocks.trialDrillThrough).toHaveBeenCalledWith(
        "network-1",
        record.definition,
        {},
        "selected-bucket",
        undefined,
      );
      expect(mocks.queryDrillThrough).not.toHaveBeenCalled();
    }
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close trial" }));
    expect(screen.queryByTestId("list-metric-trial")).not.toBeInTheDocument();
  });

  it("reserves enough width for business definitions while keeping compact status columns", async () => {
    mocks.searchParams.current = "view=list&ownerObjectTypeId=order";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    const { container } = render(
      <ObjectMetricListPanel canDelete canModify networkId="network-1" />,
    );

    expect(await screen.findByText("订单对象指标 1")).toBeInTheDocument();
    const widths = [...container.querySelectorAll<HTMLTableColElement>("colgroup col")]
      .slice(0, 8)
      .map((column) => column.style.width);
    expect(widths).toEqual(["280px", "72px", "100px", "180px", "112px", "90px", "152px", "300px"]);
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers.slice(0, 2)).toEqual(["对象指标", "common.actions"]);
    expect(screen.getByRole("columnheader", { name: "业务定义" })).toBeInTheDocument();
    expect(container.querySelector("table")).toHaveStyle({ width: "1286px" });
  });

  it("loads binding status once for the selected object class", async () => {
    mocks.searchParams.current = "view=list&ownerObjectTypeId=order";
    const first = metric(1);
    first.definition.calculation_scope = "object_instance";
    const second = metric(2);
    second.definition.calculation_scope = "object_instance";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [first, second], total_count: 2 });
    mocks.getObjectDetail.mockResolvedValue({
      id: "order",
      name: "销售订单",
      logicProperties: [
        {
          name: "metric_property",
          displayName: "对象指标属性",
          metricBinding: { metric_ref: { metric_id: "metric-1", version: 1 } },
        },
      ],
    });
    render(<ObjectMetricListPanel canDelete canModify networkId="network-1" />);
    expect(await screen.findByText("对象指标属性 · v1")).toHaveAttribute(
      "title",
      "对象指标属性 · v1",
    );
    expect(screen.getByText("未绑定")).toBeInTheDocument();
    expect(mocks.getObjectDetail).toHaveBeenCalledTimes(1);
    await openMetricActionMenu(0);
    expect(await screen.findByRole("menuitem", { name: "废弃" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
  it("restores a selected object outside the first sidebar page from a direct detail return", async () => {
    mocks.searchParams.current = "objectTypeId=remote";
    mocks.getObjectDetail.mockResolvedValue({ id: "remote", name: "远端对象" });
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 21,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    const { container } = render(
      <ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />,
    );

    await waitFor(() => {
      expect(container.querySelector('[class*="graphPanelTitle"] strong')?.textContent).toBe(
        "远端对象",
      );
    });
    expect(mocks.getObjectDetail).toHaveBeenCalledWith("network-1", "remote");
  });

  it("restores the owner filter and page from the all-metric list URL", async () => {
    mocks.searchParams.current = "view=list&ownerObjectTypeId=order&metricPage=2";
    mocks.getObjectDetail.mockResolvedValue({ id: "order", name: "销售订单" });
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 21,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 21 });

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    expect(await screen.findByText("订单对象指标 1")).toBeInTheDocument();
    expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({ offset: 10, ownerObjectTypeId: "order" }),
    );
    await openMetricActionMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "详情" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/metric-1/detail?version=1",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?view=list&ownerObjectTypeId=order&metricPage=2",
        },
      },
    );
  });

  it("does not silently create a draft when viewing a published metric", async () => {
    const published = metric(1);
    const draft = metric(2);
    draft.definition.lifecycle.status = "draft";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [published, draft], total_count: 2 });

    render(<ObjectMetricListPanel canDelete canModify networkId="network-1" />);

    fireEvent.click(screen.getByText(/^(列表|list)$/i));
    expect(await screen.findByText("订单对象指标 1")).toBeInTheDocument();
    await openMetricActionMenu(0);
    expect(screen.queryByRole("menuitem", { name: "common.edit" })).not.toBeInTheDocument();
    await openMetricActionMenu(1);
    fireEvent.click(await screen.findByRole("menuitem", { name: "common.edit" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/metric-2/edit",
      {
        state: {
          knowledgeNetworkReturnTo: "/knowledge-network/workspace/network-1/metrics?view=list",
        },
      },
    );
    expect(mocks.createNextDraft).not.toHaveBeenCalled();
  });

  it("requests the selected list page from the server", async () => {
    const records = Array.from({ length: 25 }, (_, index) => metric(index + 1));
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockImplementation(
      (_networkId: string, query: { limit?: number; offset?: number }) => {
        const offset = query.offset ?? 0;
        const limit = query.limit ?? 10;
        return Promise.resolve({
          entries: records.slice(offset, offset + limit),
          total_count: records.length,
        });
      },
    );

    const { container } = render(
      <ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />,
    );

    expect(container.querySelector('[class*="toolbarLeft"] .ant-segmented')).not.toBeNull();
    expect(container.querySelector('[class*="toolbarRight"] .ant-segmented')).toBeNull();

    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ limit: 10, offset: 0 }),
        { skipErrorToast: true },
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText("订单共有 25 个对象指标（不受类型筛选影响）").textContent).toBe(
        "25",
      );
    });
    fireEvent.click(screen.getByText(/^(列表|list)$/i));

    await waitFor(() => {
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
        keyword: undefined,
        limit: 10,
        metricType: undefined,
        offset: 0,
        ownerObjectTypeId: undefined,
        status: undefined,
      });
    });
    expect(await screen.findByText("订单对象指标 1")).not.toBeNull();
    expect(screen.queryByText("订单对象指标 11")).toBeNull();
    expect(screen.getByText("订单对象指标 1").getAttribute("title")).toBe("订单对象指标 1");
    expect(screen.queryByText("order_metric_1@v1")).toBeNull();
    expect(screen.getByText("total:25")).not.toBeNull();

    expect(container.querySelectorAll(".ant-table-tbody > tr.ant-table-row")).toHaveLength(10);
    fireEvent.click(screen.getByTitle("2"));

    await waitFor(() => {
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
        keyword: undefined,
        limit: 10,
        metricType: undefined,
        offset: 10,
        ownerObjectTypeId: undefined,
        status: undefined,
      });
    });
    expect(await screen.findByText("订单对象指标 11")).not.toBeNull();
    expect(screen.queryByText("订单对象指标 1")).toBeNull();
    expect(container.querySelectorAll(".ant-table-tbody > tr.ant-table-row")).toHaveLength(10);

    fireEvent.change(screen.getByPlaceholderText("搜索对象指标名称或编码"), {
      target: { value: "订单对象指标 2" },
    });
    await waitFor(
      () => {
        expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
          keyword: "订单对象指标 2",
          limit: 10,
          metricType: undefined,
          offset: 0,
          ownerObjectTypeId: undefined,
          status: undefined,
        });
      },
      { timeout: 5000 },
    );
  });

  it("pages a large object catalog and searches it on the server without loading metrics", async () => {
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });
    mocks.listObjectTypes.mockImplementation(
      (_networkId: string, query: { limit: number; offset: number; namePattern?: string }) =>
        Promise.resolve({
          entries: Array.from(
            { length: Math.min(query.limit, (query.namePattern ? 25 : 10000) - query.offset) },
            (_, index) => ({
              id: `object-${query.offset + index}`,
              name: query.namePattern
                ? `目标对象 ${query.offset + index + 1}`
                : `对象 ${query.offset + index}`,
            }),
          ),
          totalCount: query.namePattern ? 25 : 10000,
        }),
    );

    const { container } = render(
      <ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll("button[class*=objectButton]")).toHaveLength(10);
    });
    expect(screen.getByText(/10000/)).not.toBeNull();
    await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(10));
    expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 1, offset: 0, ownerObjectTypeId: "object-0" },
      { skipErrorToast: true },
    );
    expect(screen.getByLabelText("对象 0共有 0 个对象指标（不受类型筛选影响）").textContent).toBe(
      "0",
    );

    const objectList = container.querySelector<HTMLElement>(
      'div[class*="objectList"]:not([class*="objectListArea"])',
    )!;
    objectList.scrollTop = 200;
    fireEvent.change(screen.getByPlaceholderText("搜索对象类"), { target: { value: "目标" } });
    expect(objectList.scrollTop).toBe(0);
    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ limit: 10, namePattern: "目标", offset: 0 }),
        { skipErrorToast: true },
      );
    });
    expect(await screen.findByTitle("目标对象 2")).not.toBeNull();
    fireEvent.click(screen.getByTitle("目标对象 2"));
    expect(container.querySelector('[class*="graphPanelTitle"] strong')?.textContent).toBe(
      "目标对象 2",
    );
    mocks.listObjectTypes.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /刷新|Refresh/ }));
      await Promise.resolve();
    });
    expect(mocks.listObjectTypes).toHaveBeenCalled();
    expect(container.querySelector('[class*="graphPanelTitle"] strong')?.textContent).toBe(
      "目标对象 2",
    );

    fireEvent.click(
      container.querySelector('[class*="objectPagination"] .ant-pagination-next button')!,
    );
    expect(await screen.findByTitle("目标对象 11")).not.toBeNull();
    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ namePattern: "目标", offset: 10 }),
        { skipErrorToast: true },
      );
    });
    expect(container.querySelector('[class*="graphPanelTitle"] strong')?.textContent).toBe(
      "目标对象 2",
    );
  });

  it("uses the same two-row toolbar and graph layout as the object-type page", async () => {
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 22 });

    const { container } = render(
      <ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />,
    );

    expect(await screen.findByTitle("销售订单")).not.toBeNull();
    expect(container.querySelector(".ant-pagination")).toBeNull();
    expect(screen.getByPlaceholderText("搜索对象类")).not.toBeNull();
    expect(container.querySelector('[class*="viewModeRow"] .ant-segmented')).not.toBeNull();
    expect(
      container.querySelector('[class*="operationRow"] [placeholder="搜索对象类"]'),
    ).not.toBeNull();
    expect(container.querySelector('[class*="objectSidebarHeader"]')?.textContent).toContain(
      "对象类1",
    );
    expect(container.querySelector('[class*="graphPanelTitle"] strong')?.textContent).toBe(
      "销售订单",
    );
    expect(screen.queryByRole("button", { name: "收起对象类列表" })).toBeNull();
  });

  it("ignores an old object response while a new search is being debounced", async () => {
    let resolveInitial!: (value: {
      entries: { id: string; name: string }[];
      totalCount: number;
    }) => void;
    mocks.listObjectTypes.mockImplementation(
      (_networkId: string, query: { namePattern?: string }) =>
        query.namePattern
          ? Promise.resolve({ entries: [{ id: "target", name: "目标对象" }], totalCount: 1 })
          : new Promise((resolve) => {
              resolveInitial = resolve;
            }),
    );
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    const { container } = render(
      <ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />,
    );
    fireEvent.change(screen.getByPlaceholderText("搜索对象类"), { target: { value: "目标" } });
    await act(async () => {
      resolveInitial({ entries: [{ id: "old", name: "旧对象" }], totalCount: 1 });
      await Promise.resolve();
    });
    expect(screen.queryByTitle("旧对象")).toBeNull();
    expect(await screen.findByTitle("目标对象")).not.toBeNull();
    expect(container.querySelector('[class*="graphPanelTitle"] strong')?.textContent).toBe(
      "目标对象",
    );
  });

  it("shows reference details from the deletion preflight instead of opening confirmation", async () => {
    const warning = vi.spyOn(Modal, "warning").mockImplementation(() => undefined as never);
    const draft = metric(1);
    draft.definition.lifecycle.status = "draft";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [draft], total_count: 1 });
    mocks.checkDeletion.mockResolvedValue({
      blockers: [
        {
          field: "specification.base_metric",
          name: "下游成交额",
          resource_id: "dependent-metric",
          resource_type: "metric_version",
          version: 2,
        },
      ],
      deletable: false,
      hidden_blocker_count: 1,
      metric_id: draft.definition.id,
      metric_name: draft.definition.name,
      status: "draft",
      version: draft.definition.version,
    });

    render(<ObjectMetricListPanel canDelete canModify networkId="network-1" />);
    fireEvent.click(screen.getByText(/^(列表|list)$/i));
    expect(await screen.findByText("订单对象指标 1")).toBeInTheDocument();
    await openMetricActionMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除对象指标版本" }));

    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning.mock.calls[0]?.[0]?.title).toBe("无法删除对象指标版本");
    render(<div>{warning.mock.calls[0]?.[0]?.content}</div>);
    expect(screen.getByText(/下游成交额.*v2/)).toBeInTheDocument();
    expect(screen.getByText(/另有 1 个无权查看的引用/)).toBeInTheDocument();
    expect(mocks.deleteVersion).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it("prevents duplicate deletion preflights and explains a status blocker", async () => {
    const warning = vi.spyOn(Modal, "warning").mockImplementation(() => undefined as never);
    const draft = metric(1);
    draft.definition.lifecycle.status = "draft";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [draft], total_count: 1 });
    let resolveCheck!: (value: {
      blockers: [];
      deletable: false;
      hidden_blocker_count: 0;
      metric_id: string;
      metric_name: string;
      status: "published";
      version: number;
    }) => void;
    mocks.checkDeletion.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );

    render(<ObjectMetricListPanel canDelete canModify networkId="network-1" />);
    fireEvent.click(screen.getByText(/^(列表|list)$/i));
    expect(await screen.findByText("订单对象指标 1")).toBeInTheDocument();
    await openMetricActionMenu();
    const deleteItem = await screen.findByRole("menuitem", { name: "删除对象指标版本" });
    fireEvent.click(deleteItem);
    fireEvent.click(deleteItem);
    expect(mocks.checkDeletion).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "common.actions" })).toBeEnabled();
    await openMetricActionMenu();
    expect(await screen.findByRole("menuitem", { name: "详情" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /删除对象指标版本$/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    act(() => {
      resolveCheck({
        blockers: [],
        deletable: false,
        hidden_blocker_count: 0,
        metric_id: draft.definition.id,
        metric_name: draft.definition.name,
        status: "published",
        version: draft.definition.version,
      });
    });
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    render(<div>{warning.mock.calls[0]?.[0]?.content}</div>);
    expect(screen.getByText("状态为 published 的对象指标版本不可删除。")).toBeInTheDocument();
    warning.mockRestore();
  });

  it("limits count requests to four in flight and distinguishes a pending count from zero", async () => {
    const resolveCounts: Array<(value: { entries: []; total_count: number }) => void> = [];
    mocks.listObjectTypes.mockResolvedValue({
      entries: Array.from({ length: 10 }, (_, index) => ({
        id: `object-${index}`,
        name: `对象 ${index}`,
      })),
      totalCount: 20,
    });
    mocks.listObjectMetrics.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCounts.push(resolve);
        }),
    );

    render(<ObjectMetricListPanel canDelete={false} canModify={false} networkId="network-1" />);

    await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(4));
    expect(screen.getByTitle("对象 0").textContent).toContain("…");
    resolveCounts[0]({ entries: [], total_count: 7 });
    await waitFor(() => {
      expect(screen.getByLabelText("对象 0共有 7 个对象指标（不受类型筛选影响）").textContent).toBe(
        "7",
      );
      expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(5);
    });
  });
});
