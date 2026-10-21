/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

const mocks = vi.hoisted(() => ({
  createNextDraft: vi.fn(),
  getObjectDetail: vi.fn(),
  listObjectTypes: vi.fn(),
  listObjectMetrics: vi.fn(),
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
    message: { error: vi.fn(), success: vi.fn() },
  }),
}));

vi.mock("@/modules/knowledge-network/components/shared/usePersistentPageSize", () => ({
  usePersistentPageSize: () => [10, mocks.setPageSize],
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricGraphCanvas", () => ({
  ObjectMetricGraphCanvas: ({
    onEditMetric,
    onOpenMetric,
  }: {
    onEditMetric: (record: ObjectMetricRecordV1) => void;
    onOpenMetric: (record: ObjectMetricRecordV1) => void;
  }) => (
    <div>
      metric graph
      <button onClick={() => onOpenMetric(metric(1))}>Open graph metric</button>
      <button onClick={() => onEditMetric(metric(1))}>Edit graph metric</button>
    </div>
  ),
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
  createNextObjectMetricDraftV1: mocks.createNextDraft,
  deleteObjectMetricDraftV1: vi.fn(),
  deprecateObjectMetricV1: vi.fn(),
  listObjectMetricsV1: mocks.listObjectMetrics,
  queryObjectMetricDrillThroughV1: mocks.queryDrillThrough,
  queryObjectMetricDataV1: mocks.queryMetric,
  trialObjectMetricDrillThroughV1: mocks.trialDrillThrough,
  trialObjectMetricDataV1: mocks.trialMetric,
}));
vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
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
  mocks.createNextDraft.mockReset();
  mocks.getObjectDetail.mockReset();
  mocks.getObjectDetail.mockResolvedValue(null);
  mocks.listObjectTypes.mockReset();
  mocks.listObjectMetrics.mockReset();
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
      name: `订单指标 ${index}`,
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

describe("ObjectMetricListPanel pagination", () => {
  it("exposes AI creation on the metric list and opens the chosen type with the designer", async () => {
    mocks.searchParams.current = "objectTypeId=order&view=list";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    render(<ObjectMetricListPanel canModify networkId="network-1" />);

    const aiCreate = await screen.findByRole("button", { name: /AI 创建/ });
    expect(aiCreate).toBeEnabled();
    fireEvent.mouseEnter(aiCreate);
    fireEvent.click(await screen.findByRole("menuitem", { name: "AI 创建衍生指标" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/create?objectTypeId=order&metricType=derived&ai=1",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?objectTypeId=order&view=list",
        },
      },
    );
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
      render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);
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

  it("does not load unfiltered metrics when no object type matches the sidebar search", async () => {
    mocks.searchParams.current = "view=list&objectQuery=missing";
    mocks.listObjectTypes.mockResolvedValue({ entries: [], totalCount: 0 });

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => expect(mocks.listObjectTypes).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("[class*=tableLoading]")).toBeNull());
    expect(mocks.listObjectMetrics).not.toHaveBeenCalled();
  });

  it("opens the graph-selected version and returns to the graph", async () => {
    mocks.searchParams.current = "objectTypeId=order";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    render(<ObjectMetricListPanel canModify networkId="network-1" />);
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
    mocks.searchParams.current = "objectTypeId=order&view=list";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);
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
    mocks.searchParams.current = "objectTypeId=order&view=list";
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

    render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "试算" }));
    const drawer = await screen.findByTestId("list-metric-trial");
    expect(drawer).toHaveAttribute("data-mode", mode);
    expect(drawer).toHaveAttribute("data-name", "订单指标 1");
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
    mocks.searchParams.current = "objectTypeId=order&view=list";
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 1 });

    const { container } = render(<ObjectMetricListPanel canModify networkId="network-1" />);

    expect(await screen.findByText("订单指标 1")).toBeInTheDocument();
    const widths = [...container.querySelectorAll<HTMLTableColElement>("colgroup col")]
      .slice(0, 7)
      .map((column) => column.style.width);
    expect(widths).toEqual(["280px", "100px", "112px", "90px", "152px", "300px", "212px"]);
    expect(screen.getByRole("columnheader", { name: "业务定义" })).toBeInTheDocument();
  });

  it("loads binding status once for the selected object class", async () => {
    mocks.searchParams.current = "objectTypeId=order&view=list";
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
          displayName: "指标属性",
          metricBinding: { metric_ref: { metric_id: "metric-1", version: 1 } },
        },
      ],
    });
    render(<ObjectMetricListPanel canModify networkId="network-1" />);
    expect(await screen.findByText("指标属性 · v1")).toHaveAttribute("title", "指标属性 · v1");
    expect(screen.getByText("未绑定")).toBeInTheDocument();
    expect(mocks.getObjectDetail).toHaveBeenCalledTimes(1);
    const deprecateButtons = screen.getAllByRole("button", { name: "废弃" });
    expect(deprecateButtons[0]).toBeDisabled();
    expect(deprecateButtons[1]).toBeEnabled();
  });
  it("restores a selected object outside the first sidebar page from a direct detail return", async () => {
    mocks.searchParams.current = "objectTypeId=remote&view=list";
    mocks.getObjectDetail.mockResolvedValue({ id: "remote", name: "远端对象" });
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 21,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => {
      expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe(
        "远端对象",
      );
    });
    expect(container.querySelector('[class*="toolbarIdentity"]')?.textContent).toBe("远端对象");
    expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({ ownerObjectTypeId: "remote" }),
    );
  });

  it("restores the selected object, view and page from the list URL", async () => {
    mocks.searchParams.current = "objectTypeId=order&objectPage=2&view=list&metricPage=2";
    mocks.getObjectDetail.mockResolvedValue({ id: "order", name: "销售订单" });
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 21,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [metric(1)], total_count: 21 });

    render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    expect(await screen.findByText("订单指标 1")).toBeInTheDocument();
    expect(screen.getByTitle("销售订单").className).toMatch(/selected/);
    expect(mocks.listObjectTypes).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({ offset: 20 }),
      { skipErrorToast: true },
    );
    expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({ offset: 10, ownerObjectTypeId: "order" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/metric-1/detail?version=1",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?objectTypeId=order&objectPage=2&view=list&metricPage=2",
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

    render(<ObjectMetricListPanel canModify networkId="network-1" />);

    fireEvent.click(screen.getByText(/^(列表|list)$/i));
    expect(await screen.findByText("订单指标 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑指标 订单指标 1" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑指标 订单指标 2" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/metric-2/edit",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?objectTypeId=order&view=list",
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

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    expect(container.querySelector('[class*="toolbarLeft"] .ant-segmented')).not.toBeNull();
    expect(container.querySelector('[class*="toolbarRight"] .ant-segmented')).toBeNull();

    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ limit: 20, offset: 0 }),
        { skipErrorToast: true },
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText("订单共有 25 个指标（不受类型筛选影响）").textContent).toBe(
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
        ownerObjectTypeId: "order",
      });
    });
    expect(await screen.findByText("订单指标 1")).not.toBeNull();
    expect(screen.queryByText("订单指标 11")).toBeNull();
    expect(screen.getByText("订单指标 1").getAttribute("title")).toBe("订单指标 1");
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
        ownerObjectTypeId: "order",
      });
    });
    expect(await screen.findByText("订单指标 11")).not.toBeNull();
    expect(screen.queryByText("订单指标 1")).toBeNull();
    expect(container.querySelectorAll(".ant-table-tbody > tr.ant-table-row")).toHaveLength(10);

    const objectList = container.querySelector<HTMLElement>("[class*=objectList]");
    expect(objectList).not.toBeNull();
    objectList!.scrollTop = 200;
    fireEvent.change(screen.getByPlaceholderText("搜索当前对象的指标名称或编码"), {
      target: { value: "订单指标 2" },
    });
    await waitFor(
      () => {
        expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
          keyword: "订单指标 2",
          limit: 10,
          metricType: undefined,
          offset: 0,
          ownerObjectTypeId: "order",
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
            { length: query.namePattern ? Math.min(20, 25 - query.offset) : 20 },
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

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => {
      expect(container.querySelectorAll("[class*=objectButton]")).toHaveLength(20);
    });
    expect(screen.getByText(/10000/)).not.toBeNull();
    await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(20));
    expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 1, offset: 0, ownerObjectTypeId: "object-0" },
      { skipErrorToast: true },
    );
    expect(screen.getByLabelText("对象 0共有 0 个指标（不受类型筛选影响）").textContent).toBe("0");

    const objectList = container.querySelector<HTMLElement>("[class*=objectList]")!;
    objectList.scrollTop = 200;
    fireEvent.change(screen.getByPlaceholderText("搜索对象类"), { target: { value: "目标" } });
    expect(objectList.scrollTop).toBe(0);
    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ limit: 20, namePattern: "目标", offset: 0 }),
        { skipErrorToast: true },
      );
    });
    expect(await screen.findByTitle("目标对象 2")).not.toBeNull();
    fireEvent.click(screen.getByTitle("目标对象 2"));
    expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe(
      "目标对象 2",
    );
    mocks.listObjectTypes.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /刷新|Refresh/ }));
      await Promise.resolve();
    });
    expect(mocks.listObjectTypes).toHaveBeenCalled();
    expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe(
      "目标对象 2",
    );

    fireEvent.click(
      container.querySelector('[class*="objectPagination"] .ant-pagination-next button')!,
    );
    expect(await screen.findByTitle("目标对象 21")).not.toBeNull();
    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ namePattern: "目标", offset: 20 }),
        { skipErrorToast: true },
      );
    });
    expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe(
      "目标对象 2",
    );
  });

  it("collapses the object catalog and restores it without losing the current selection", async () => {
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 22 });

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    expect(await screen.findByTitle("销售订单")).not.toBeNull();
    expect(container.querySelector(".ant-pagination")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "收起对象类列表" }));
    expect(screen.queryByPlaceholderText("搜索对象类")).toBeNull();
    expect(screen.getByRole("button", { name: "展开对象类列表" })).not.toBeNull();
    expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe("销售订单");

    fireEvent.click(screen.getByRole("button", { name: "展开对象类列表" }));
    expect(screen.getByPlaceholderText("搜索对象类")).not.toBeNull();
    expect(screen.getByTitle("销售订单")).not.toBeNull();
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

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);
    fireEvent.change(screen.getByPlaceholderText("搜索对象类"), { target: { value: "目标" } });
    await act(async () => {
      resolveInitial({ entries: [{ id: "old", name: "旧对象" }], totalCount: 1 });
      await Promise.resolve();
    });
    expect(screen.queryByTitle("旧对象")).toBeNull();
    expect(await screen.findByTitle("目标对象")).not.toBeNull();
    expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe("目标对象");
  });

  it("limits count requests to four in flight and distinguishes a pending count from zero", async () => {
    const resolveCounts: Array<(value: { entries: []; total_count: number }) => void> = [];
    mocks.listObjectTypes.mockResolvedValue({
      entries: Array.from({ length: 20 }, (_, index) => ({
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

    render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(4));
    expect(screen.getByTitle("对象 0").textContent).toContain("…");
    resolveCounts[0]({ entries: [], total_count: 7 });
    await waitFor(() => {
      expect(screen.getByLabelText("对象 0共有 7 个指标（不受类型筛选影响）").textContent).toBe(
        "7",
      );
      expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(5);
    });
  });
});
