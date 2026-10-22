/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/relation-type";

const mocks = vi.hoisted(() => ({
  getMetric: vi.fn(),
  listMetrics: vi.fn(),
  listRelations: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/object-metric.service", () => ({
  getObjectMetricV1: mocks.getMetric,
  listObjectMetricsV1: mocks.listMetrics,
}));
vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  listKnowledgeNetworkRelationTypePage: mocks.listRelations,
}));
vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel",
  () => ({
    KnowledgeNetworkAuthorizationActionLabel: ({ children }: { children: ReactNode }) => children,
  }),
);

import { ObjectMetricGraphCanvas } from "./ObjectMetricGraphCanvas";

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
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => new DOMRect(0, 0, 120, 32),
  });
});
beforeEach(() => {
  mocks.getMetric.mockResolvedValue(undefined);
});
afterAll(() => {
  window.matchMedia = originalMatchMedia;
  Reflect.deleteProperty(SVGElement.prototype, "getBBox");
});

afterEach(() => {
  cleanup();
  mocks.getMetric.mockReset();
  mocks.listMetrics.mockReset();
  mocks.listRelations.mockReset();
});

function relation(index: number): KnowledgeNetworkRelationTypeRecord {
  return {
    id: `relation-${index}`,
    name: `关系 ${index}`,
    sourceObjectTypeId: "order",
    sourceObjectTypeName: "销售订单",
    targetObjectTypeId: `neighbor-${index}`,
    targetObjectTypeName: `关联对象 ${index}`,
  } as KnowledgeNetworkRelationTypeRecord;
}

function metric(id: string, relationId?: string): ObjectMetricRecordV1 {
  return {
    definition: {
      id,
      version: 1,
      metric_type: relationId ? "derived" : "atomic",
      owner_object_type_id: "order",
      name: `指标 ${id}`,
      code: id,
      description: `Description for ${id}`,
      lifecycle: { status: "published" },
      specification: relationId
        ? {
            kind: "derived",
            base_metric: { metric_id: "base", version: 1 },
            business_qualifiers: {
              relation_path: {
                alias: "path",
                cardinality_policy: "preserve_root",
                purpose: "qualify_root",
                steps: [
                  {
                    direction: "outgoing",
                    relation_type_id: relationId,
                    target_object_type_id: "related",
                  },
                ],
              },
            },
          }
        : { kind: "atomic", measure: { aggregation: "count_rows" } },
    },
  } as ObjectMetricRecordV1;
}

function renderGraph(
  onSelectObject = vi.fn(),
  onOpenMetric = vi.fn(),
  actionProps: Partial<Parameters<typeof ObjectMetricGraphCanvas>[0]> = {},
) {
  return render(
    <ObjectMetricGraphCanvas
      networkId="network-1"
      onOpenMetric={onOpenMetric}
      onSelectObject={onSelectObject}
      refreshVersion={0}
      selectedObjectTypeId="order"
      selectedObjectTypeName="销售订单"
      {...actionProps}
    />,
  );
}

function neighborCountRequestIds() {
  return mocks.listMetrics.mock.calls.flatMap(([, rawQuery]) => {
    const query = rawQuery as { ownerObjectTypeId?: string };
    return query.ownerObjectTypeId?.startsWith("neighbor-") ? [query.ownerObjectTypeId] : [];
  });
}

describe("ObjectMetricGraphCanvas", () => {
  it("shows authorized owner names without exposing object details when object types are restricted", async () => {
    const first = metric("restricted-1");
    first.definition.owner_object_type_id = "hidden-owner-1";
    first.owner_object_type_name = "销售订单";
    const second = metric("restricted-2");
    second.definition.owner_object_type_id = "hidden-owner-2";
    second.owner_object_type_name = "客户";
    mocks.listMetrics.mockResolvedValue({ entries: [first, second], total_count: 2 });
    const onRestrictedObjectClick = vi.fn();

    renderGraph(vi.fn(), vi.fn(), {
      onRestrictedObjectClick,
      restrictedObjectTypes: true,
      selectedObjectTypeId: "",
      selectedObjectTypeName: "",
    });

    const lockedOwners = await screen.findAllByRole("button", {
      name: /详情不可查看|details unavailable/i,
    });
    expect(lockedOwners).toHaveLength(2);
    expect(screen.getByRole("button", { name: /销售订单/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /客户/ })).toBeInTheDocument();
    expect(mocks.listRelations).not.toHaveBeenCalled();
    expect(mocks.listMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 6, metricType: undefined, offset: 0 },
      { skipErrorToast: true },
    );
    expect(screen.queryByText("hidden-owner-1")).not.toBeInTheDocument();
    expect(screen.queryByText("hidden-owner-2")).not.toBeInTheDocument();

    fireEvent.click(lockedOwners[0]);
    expect(onRestrictedObjectClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".ant-drawer-open")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /原子指标：指标 restricted-1|Atomic metric: 指标 restricted-1/i,
      }),
    );
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).not.toBeNull());
    expect(document.querySelector(".ant-drawer-open")).toHaveTextContent("销售订单");
  });

  it("groups metrics owned by the same restricted object type under one locked node", async () => {
    const first = metric("restricted-1");
    first.owner_object_type_name = "销售订单";
    const second = metric("restricted-2");
    second.owner_object_type_name = "销售订单";
    mocks.listMetrics.mockResolvedValue({ entries: [first, second], total_count: 2 });

    renderGraph(vi.fn(), vi.fn(), {
      restrictedObjectTypes: true,
      selectedObjectTypeId: "",
      selectedObjectTypeName: "",
    });

    expect(await screen.findAllByRole("button", { name: /销售订单/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /指标 restricted-1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /指标 restricted-2/ })).toBeInTheDocument();
  });

  it("paginates authorized metrics in the restricted-object graph", async () => {
    const records = Array.from({ length: 7 }, (_, index) => metric(`restricted-${index + 1}`));
    mocks.listMetrics.mockImplementation(
      (_networkId: string, query: { limit: number; offset: number }) =>
        Promise.resolve({
          entries: records.slice(query.offset, query.offset + query.limit),
          total_count: records.length,
        }),
    );
    const { container } = renderGraph(vi.fn(), vi.fn(), {
      restrictedObjectTypes: true,
      selectedObjectTypeId: "",
      selectedObjectTypeName: "",
    });

    expect(
      await screen.findByRole("button", {
        name: /原子指标：指标 restricted-1|Atomic metric: 指标 restricted-1/i,
      }),
    ).toBeInTheDocument();
    fireEvent.click(container.querySelector(".ant-pagination-next button")!);

    expect(
      await screen.findByRole("button", {
        name: /原子指标：指标 restricted-7|Atomic metric: 指标 restricted-7/i,
      }),
    ).toBeInTheDocument();
    expect(mocks.listMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 6, metricType: undefined, offset: 6 },
      { skipErrorToast: true },
    );
  });

  it("does not treat an empty object-type search as a permission restriction", () => {
    renderGraph(vi.fn(), vi.fn(), {
      objectTypeSearchEmpty: true,
      selectedObjectTypeId: "",
      selectedObjectTypeName: "",
    });

    expect(
      screen.getByText(/没有符合当前搜索条件的对象类|No object types match the current search/),
    ).toBeInTheDocument();
    expect(mocks.listMetrics).not.toHaveBeenCalled();
  });

  it("does not load object details before the visible object list is ready", () => {
    renderGraph(vi.fn(), vi.fn(), { objectTypesLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(mocks.listRelations).not.toHaveBeenCalled();
    expect(mocks.listMetrics).not.toHaveBeenCalled();
  });

  it("renders the object title and overview actions in one toolbar", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 2 });
    mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });

    const { container } = renderGraph();
    await waitFor(() => expect(mocks.listRelations).toHaveBeenCalled());

    const toolbar = container.querySelector('[class*="explorerToolbar"]');
    expect(toolbar?.querySelector('[class*="graphPanelTitle"] strong')).toHaveTextContent(
      "销售订单",
    );
    expect(toolbar?.textContent).toMatch(/0 个指标.*2 条关系|0 metrics.*2 relations/);
  });

  it("reuses a previously loaded owner's metric scan when returning to that object", async () => {
    const ownerMetricCache = new Map();
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });
    const props = {
      networkId: "network-1",
      onOpenMetric: vi.fn(),
      onSelectObject: vi.fn(),
      ownerMetricCache,
      refreshVersion: 0,
      selectedObjectTypeName: "销售订单",
    };
    const { rerender } = render(
      <ObjectMetricGraphCanvas {...props} selectedObjectTypeId="order" />,
    );
    await waitFor(() => expect(ownerMetricCache.size).toBe(1));

    rerender(<ObjectMetricGraphCanvas {...props} selectedObjectTypeId="other" />);
    await waitFor(() => expect(ownerMetricCache.size).toBe(2));

    rerender(<ObjectMetricGraphCanvas {...props} selectedObjectTypeId="order" />);
    await waitFor(() => expect(mocks.listMetrics).toHaveBeenCalledTimes(2));
    expect(
      mocks.listMetrics.mock.calls.filter(
        ([, query]) => (query as { ownerObjectTypeId?: string }).ownerObjectTypeId === "order",
      ),
    ).toHaveLength(1);
  });

  it("shows each neighboring object's own metric count without changing the relation count", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockImplementation(
      (_networkId: string, query: { ownerObjectTypeId: string }) =>
        Promise.resolve(
          query.ownerObjectTypeId === "neighbor-1"
            ? { entries: [], total_count: 7 }
            : { entries: [metric("uses-relation", "relation-1")], total_count: 1 },
        ),
    );

    const { container } = renderGraph();
    const neighbor = await screen.findByRole("button", { name: "关联对象 1" });
    await waitFor(() => {
      expect(neighbor.querySelector("[class*=relatedCount]")).toHaveTextContent("7");
    });
    expect(neighbor.getAttribute("aria-description")).toContain("7");
    expect(container.querySelector("[class*=relationCountAction] text")).toHaveTextContent("1");
    expect(container.querySelector("[class*=ownerCount]")).toHaveTextContent("1");
    expect(mocks.listMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 1, metricType: undefined, offset: 0, ownerObjectTypeId: "neighbor-1" },
      { skipErrorToast: true },
    );
  });

  it("applies the metric-type filter to neighbor counts and hides stale counts while reloading", async () => {
    let resolveDerived!: (value: { entries: []; total_count: number }) => void;
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockImplementation(
      (_networkId: string, query: { metricType?: string; ownerObjectTypeId: string }) => {
        if (query.ownerObjectTypeId === "neighbor-1") {
          return query.metricType === "derived"
            ? new Promise((resolve) => {
                resolveDerived = resolve;
              })
            : Promise.resolve({ entries: [], total_count: 3 });
        }
        return Promise.resolve({ entries: [], total_count: 0 });
      },
    );
    const props = {
      networkId: "network-1",
      onOpenMetric: vi.fn(),
      onSelectObject: vi.fn(),
      refreshVersion: 0,
      selectedObjectTypeId: "order",
      selectedObjectTypeName: "销售订单",
    };
    const { rerender } = render(<ObjectMetricGraphCanvas {...props} metricType="atomic" />);
    const neighbor = await screen.findByRole("button", { name: "关联对象 1" });
    await waitFor(() =>
      expect(neighbor.querySelector("[class*=relatedCount]")).toHaveTextContent("3"),
    );

    rerender(<ObjectMetricGraphCanvas {...props} metricType="derived" />);
    expect(neighbor.querySelector("[class*=relatedCount]")).toHaveTextContent("…");
    await waitFor(() => expect(resolveDerived).toBeTypeOf("function"));
    resolveDerived({ entries: [], total_count: 0 });
    await waitFor(() =>
      expect(neighbor.querySelector("[class*=relatedCount]")).toHaveTextContent("0"),
    );
    expect(mocks.listMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 1, metricType: "derived", offset: 0, ownerObjectTypeId: "neighbor-1" },
      { skipErrorToast: true },
    );
  });

  it("deduplicates a neighbor shared by two relations and marks a failed count as unavailable", async () => {
    const second = relation(2);
    second.targetObjectTypeId = "neighbor-1";
    second.targetObjectTypeName = "关联对象 1";
    mocks.listRelations.mockResolvedValue({ entries: [relation(1), second], totalCount: 2 });
    mocks.listMetrics.mockImplementation(
      (_networkId: string, query: { ownerObjectTypeId: string }) =>
        query.ownerObjectTypeId === "neighbor-1"
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({ entries: [], total_count: 0 }),
    );

    renderGraph();
    const neighbor = await screen.findByRole("button", { name: "关联对象 1" });
    await waitFor(() =>
      expect(neighbor.querySelector("[class*=relatedCount]")).toHaveTextContent("—"),
    );
    expect(neighbor.getAttribute("aria-description")).toMatch(/加载失败|Could not load/);
    expect(neighborCountRequestIds()).toEqual(["neighbor-1"]);
  });

  it("queries only visible neighbors and reuses their counts when returning to a relation page", async () => {
    const relations = Array.from({ length: 8 }, (_, index) => relation(index + 1));
    mocks.listRelations.mockImplementation(
      (_networkId: string, query: { limit: number; offset: number }) =>
        Promise.resolve({
          entries: relations.slice(query.offset, query.offset + query.limit),
          totalCount: relations.length,
        }),
    );
    mocks.listMetrics.mockImplementation(
      (_networkId: string, query: { ownerObjectTypeId: string }) =>
        Promise.resolve({
          entries: [],
          total_count: Number(query.ownerObjectTypeId.split("-")[1]) || 0,
        }),
    );

    const { container } = renderGraph();
    await waitFor(() => expect(neighborCountRequestIds()).toHaveLength(6));
    expect(neighborCountRequestIds().sort()).toEqual(
      Array.from({ length: 6 }, (_, index) => `neighbor-${index + 1}`),
    );

    fireEvent.click(container.querySelector(".ant-pagination-next button")!);
    await waitFor(() => expect(neighborCountRequestIds()).toHaveLength(8));
    expect(
      screen.getByRole("button", { name: "关联对象 7" }).getAttribute("aria-description"),
    ).toContain("7");

    fireEvent.click(container.querySelector(".ant-pagination-prev button")!);
    await screen.findByRole("button", { name: "关联对象 1" });
    expect(neighborCountRequestIds()).toHaveLength(8);
  });

  it("limits simultaneous neighbor-count requests to three", async () => {
    mocks.listRelations.mockResolvedValue({
      entries: Array.from({ length: 6 }, (_, index) => relation(index + 1)),
      totalCount: 6,
    });
    mocks.listMetrics.mockImplementation(
      (_networkId: string, query: { ownerObjectTypeId: string }) =>
        query.ownerObjectTypeId === "order"
          ? Promise.resolve({ entries: [], total_count: 0 })
          : new Promise(() => {}),
    );

    renderGraph();

    await waitFor(() => expect(neighborCountRequestIds()).toHaveLength(3));
  });

  it("fills the graph canvas with its centered loading state", () => {
    mocks.listRelations.mockReturnValue(new Promise(() => {}));
    mocks.listMetrics.mockReturnValue(new Promise(() => {}));

    const { container } = renderGraph();
    const loading = screen.getByRole("status");

    expect(loading.className).toContain("loading");
    expect(loading.querySelector(".ant-spin")).toBeInTheDocument();
    expect(loading.parentElement).toBe(container.querySelector("[class*=canvasContent]"));
  });

  it("places dependent metrics to the right and clusters shared upstream metrics", async () => {
    const atomics = ["a", "b", "c", "d", "e", "f"].map((id) => metric(id));
    const children = ["child-1", "child-2"].map((id) => {
      const child = metric(id, "relation-1");
      if (child.definition.specification.kind !== "derived") throw new Error("derived fixture");
      child.definition.specification.base_metric = { metric_id: "a", version: 1 };
      return child;
    });
    const shared = metric("shared");
    shared.definition.metric_type = "composite";
    shared.definition.specification = {
      kind: "composite",
      dependencies: ["a", "d"].map((id) => ({
        alias: id,
        metric_ref: { metric_id: id, version: 1 },
        object_alignment: { mode: "same_object", deduplication: "none" },
        evaluation_context: { window: "inherited", filter_context: { mode: "inherit" } },
      })),
      expression: { node_type: "dependency", dependency_alias: "a" },
      alignment: {
        result_owner_object_type_id: "order",
        group_by_dimensions: [],
        grain_policy: "same_grain",
        result_set_policy: "intersection",
        time_alignment: "same_time_window",
      },
      zero_division_policy: "unavailable",
      null_policy: "propagate",
    };
    const records = [...atomics, ...children, shared];
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: records, total_count: records.length });
    renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 9 个|Expand metrics owned by 销售订单 \(9 total\)/,
      }),
    );
    const position = (id: string) => {
      const node = screen.getByRole("button", { name: new RegExp(`指标 ${id}[，,]`) });
      const match = node?.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
      if (!match) throw new Error(`missing position for ${id}`);
      return { x: Number(match[1]), y: Number(match[2]) };
    };
    expect(position("a").x).toBeLessThan(position("child-1").x);
    expect(position("a").x).toBeLessThan(position("shared").x);
    expect(position("d").x).toBeLessThan(position("shared").x);
    expect(Math.abs(position("a").y - position("d").y)).toBeLessThanOrEqual(84);
    expect(Math.abs(position("child-1").y - position("child-2").y)).toBeLessThanOrEqual(84);
  });

  it("captures the metric count itself so a pointer click can expand it", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [metric("local")], total_count: 1 });
    const { container } = renderGraph();
    const count = await screen.findByRole("button", {
      name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
    });
    const owner = container.querySelector<SVGGElement>('g[class*="ownerNode"]')!;
    const countCapture = vi.fn();
    const ownerCapture = vi.fn();
    Object.defineProperty(count, "setPointerCapture", { configurable: true, value: countCapture });
    Object.defineProperty(owner, "setPointerCapture", { configurable: true, value: ownerCapture });
    const svg = container.querySelector<SVGSVGElement>('svg[class*="graph"]')!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(count, { button: 0, clientX: 500, clientY: 280, pointerId: 1 });
    expect(countCapture).toHaveBeenCalledWith(1);
    expect(ownerCapture).not.toHaveBeenCalled();
    fireEvent.pointerUp(count, { clientX: 500, clientY: 280, pointerId: 1 });
    fireEvent.click(count);
    expect(container.querySelectorAll('g[class*="metricNode"][role="button"]')).toHaveLength(1);
  });

  it("keeps object-node clicks on the node after pointer capture", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });
    const selectObject = vi.fn();
    const { container } = renderGraph(selectObject);
    await screen.findByRole("button", { name: "关联对象 1" });

    const svg = container.querySelector<SVGSVGElement>('svg[class*="graph"]')!;
    const related = screen.getByRole("button", { name: "关联对象 1" });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const nodeCapture = vi.fn();
    const canvasCapture = vi.fn();
    Object.defineProperty(related, "setPointerCapture", { configurable: true, value: nodeCapture });
    Object.defineProperty(svg, "setPointerCapture", { configurable: true, value: canvasCapture });

    fireEvent.pointerDown(related, { button: 0, clientX: 830, clientY: 280, pointerId: 1 });
    expect(nodeCapture).toHaveBeenCalledWith(1);
    expect(canvasCapture).not.toHaveBeenCalled();
    fireEvent.pointerUp(related, { clientX: 830, clientY: 280, pointerId: 1 });
    fireEvent.click(related);
    expect(selectObject).toHaveBeenCalledWith("neighbor-1", "关联对象 1");
  });

  it("drags object nodes with their edges and labels without activating the node", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });
    const selectObject = vi.fn();
    const { container } = renderGraph(selectObject);
    await screen.findByLabelText(
      /关系 1，没有指标明确使用这条关系|关系 1, no metric explicitly uses this relation/,
    );
    expect(container.querySelector('[class*="relationCountAction"]')).toBeNull();

    const svg = container.querySelector<SVGSVGElement>('svg[class*="graph"]')!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const related = screen.getByRole("button", { name: "关联对象 1" });
    const edge = container.querySelector<SVGPathElement>('path[class*="edge"]')!;
    const edgeLabel = container.querySelector<SVGGElement>('g[class*="edgeLabel"]')!;
    const originalEdge = edge.getAttribute("d");
    const originalLabel = edgeLabel.getAttribute("transform");

    fireEvent.pointerDown(related, { button: 0, clientX: 830, clientY: 280, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 710, clientY: 340, pointerId: 1 });
    expect(related.getAttribute("transform")).toBe("translate(710 340)");
    expect(edge.getAttribute("d")).not.toBe(originalEdge);
    expect(edgeLabel.getAttribute("transform")).not.toBe(originalLabel);
    fireEvent.pointerUp(svg, { clientX: 710, clientY: 340, pointerId: 1 });
    fireEvent.click(related);
    expect(selectObject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /重置布局|Reset layout/ }));
    expect(related.getAttribute("transform")).toBe("translate(830 280)");
    expect(edge.getAttribute("d")).toBe(originalEdge);

    const owner = screen.getByRole("button", { name: /销售订单，共 0 个指标|销售订单, 0 metrics/ });
    fireEvent.pointerDown(owner, { button: 0, clientX: 500, clientY: 280, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: 550, clientY: 310, pointerId: 2 });
    expect(owner.getAttribute("transform")).toBe("translate(550 310)");
    expect(edge.getAttribute("d")).not.toBe(originalEdge);
    fireEvent.pointerUp(svg, { clientX: 550, clientY: 310, pointerId: 2 });
    fireEvent.click(owner);
    expect(document.querySelector(".ant-drawer-open")).toBeNull();
  });

  it("draws one related object node when several relation types connect the same object", async () => {
    const second = relation(2);
    second.targetObjectTypeId = "neighbor-1";
    second.targetObjectTypeName = "关联对象 1";
    mocks.listRelations.mockResolvedValue({ entries: [relation(1), second], totalCount: 2 });
    mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });
    const { container } = renderGraph();

    await screen.findByLabelText(
      /关系 2，没有指标明确使用这条关系|关系 2, no metric explicitly uses this relation/,
    );
    expect(container.querySelectorAll('g[class*="relatedNode"]')).toHaveLength(1);
    expect(container.querySelectorAll('g[class*="edgeLabel"]')).toHaveLength(2);
  });

  it("uses compact graph nodes and edges instead of cards or a metric cloud", async () => {
    const relations = Array.from({ length: 8 }, (_, index) => relation(index + 1));
    const records = [metric("related", "relation-1"), metric("local")];
    mocks.listRelations.mockImplementation(
      (_networkId: string, query: { limit: number; offset: number }) =>
        Promise.resolve({
          entries: relations.slice(query.offset, query.offset + query.limit),
          totalCount: relations.length,
        }),
    );
    mocks.listMetrics.mockResolvedValue({ entries: records, total_count: records.length });
    const selectObject = vi.fn();
    const { container } = renderGraph(selectObject);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /关系 1，1 个指标|关系 1, 1 metrics/ }),
      ).not.toBeNull();
    });
    expect(mocks.listMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 50, metricType: undefined, offset: 0, ownerObjectTypeId: "order" },
      { skipErrorToast: true },
    );
    expect(container.querySelectorAll('g[class*="relatedNode"]')).toHaveLength(6);
    expect(container.querySelectorAll('g[class*="edgeLabel"]')).toHaveLength(6);
    expect(container.querySelector('g[class*="ownerNode"] circle')?.getAttribute("r")).toBe("23");
    expect(
      [...container.querySelectorAll('g[class*="relatedNode"] circle')].every(
        (circle) => circle.getAttribute("r") === "18",
      ),
    ).toBe(true);
    expect(container.querySelector('[class*="ownerNode"] text')?.textContent).toBe("2");
    expect(container.querySelector('[class*="relationCountAction"] text')?.textContent).toMatch(
      /1 个指标|1 metrics/,
    );
    expect(screen.queryByText("指标 related")).toBeNull();
    expect(screen.queryByText("指标 local")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /销售订单，共 2 个指标|销售订单, 2 metrics/ }),
    );
    expect(
      screen.getByRole("button", { name: /原子指标：指标 local|Atomic metric: 指标 local/ }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /返回对象关系|Back to object relations/ }));
    expect(screen.getByText(/1.?–.?6.*8/)).not.toBeNull();

    fireEvent.click(container.querySelector(".ant-pagination-next button")!);
    expect(
      await screen.findByLabelText(
        /关系 7，没有指标明确使用这条关系|关系 7, no metric explicitly uses this relation/,
      ),
    ).not.toBeNull();
    expect(container.querySelectorAll('g[class*="relatedNode"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "关联对象 7" }));
    expect(selectObject).toHaveBeenCalledWith("neighbor-7", "关联对象 7");
  });

  it("expands metric types and only their declared visible dependencies", async () => {
    const base = metric("base");
    const derived = metric("derived", "relation-1");
    const composite = metric("composite");
    base.definition.version = 2;
    derived.definition.version = 2;
    if (derived.definition.specification.kind !== "derived") throw new Error("derived fixture");
    derived.definition.specification.base_metric = { metric_id: "base", version: 2 };
    composite.definition.metric_type = "composite";
    composite.definition.specification = {
      kind: "composite",
      dependencies: [
        {
          alias: "base",
          metric_ref: { metric_id: "base", version: 2 },
          object_alignment: { mode: "same_object", deduplication: "none" },
          evaluation_context: { window: "inherited", filter_context: { mode: "inherit" } },
        },
        {
          alias: "derived",
          metric_ref: { metric_id: "derived", version: 2 },
          object_alignment: { mode: "same_object", deduplication: "none" },
          evaluation_context: { window: "inherited", filter_context: { mode: "inherit" } },
        },
      ],
      expression: { node_type: "dependency", dependency_alias: "derived" },
      alignment: {
        result_owner_object_type_id: "order",
        group_by_dimensions: [],
        grain_policy: "same_grain",
        result_set_policy: "intersection",
        time_alignment: "same_time_window",
      },
      zero_division_policy: "unavailable",
      null_policy: "propagate",
    };
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockResolvedValue({ entries: [base, derived, composite], total_count: 3 });
    const { container } = renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 3 个|Expand metrics owned by 销售订单 \(3 total\)/,
      }),
    );
    expect(container.querySelectorAll('g[class*="metricNode"][role="button"]')).toHaveLength(3);
    expect(
      [...container.querySelectorAll('g[class*="metricNode"][role="button"]')].every(
        (node) => node.querySelectorAll("circle").length === 1,
      ),
    ).toBe(true);
    expect(document.querySelector(".ant-drawer-open")).toBeNull();
    expect(container.querySelectorAll('path[class*="metricDependencyEdge"]')).toHaveLength(3);
    expect(container.querySelectorAll('line[class*="metricSpoke"]')).toHaveLength(1);
    const metricX = (name: string) => {
      const node = screen.getByRole("button", { name: new RegExp(`指标 ${name}[，,]`) });
      return Number(node.getAttribute("transform")?.match(/translate\(([-\d.]+)/)?.[1]);
    };
    expect(metricX("base")).toBeLessThan(metricX("derived"));
    expect(metricX("derived")).toBeLessThan(metricX("composite"));
    expect(screen.queryByRole("button", { name: "关联对象 1" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /原子指标：指标 base|Atomic metric: 指标 base/ }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /衍生指标：指标 derived|Derived metrics: 指标 derived/ }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: /复合指标：指标 composite|Composite metric: 指标 composite/,
      }),
    ).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /复合指标：指标 composite|Composite metric: 指标 composite/,
      }),
    );
    expect(container.querySelectorAll('path[class*="metricDependencyEdge"]')).toHaveLength(3);
    expect(container.querySelectorAll('path[class*="metricDependencyEdgeSelected"]')).toHaveLength(
      2,
    );
    expect(container.querySelectorAll('path[class*="metricDependencyEdgeDimmed"]')).toHaveLength(1);
    expect(container.querySelectorAll('g[class*="metricNodeDimmed"]')).toHaveLength(0);
    expect(screen.getByText("指标 base · v2、指标 derived · v2")).not.toBeNull();
    expect(screen.queryByText(/@v1/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /返回对象关系|Back to object relations/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /展开明确使用关系 1的指标，共 1 个|Expand metrics explicitly using 关系 1 \(1 total\)/,
      }),
    );
    expect(container.querySelectorAll('g[class*="metricNode"][role="button"]')).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /原子指标：指标 base|Atomic metric: 指标 base/ }),
    ).not.toBeNull();
    expect(container.querySelectorAll('path[class*="metricDependencyEdge"]')).toHaveLength(1);
    expect(container.querySelectorAll('line[class*="metricSpoke"]')).toHaveLength(1);
    expect(document.querySelector(".ant-drawer-open")).toBeNull();
  });

  it("connects a dependency by metric identity while keeping its pinned version in details", async () => {
    const latestBase = metric("base");
    latestBase.definition.version = 2;
    const historicalBase = metric("base");
    historicalBase.definition.name = "旧版订单数";
    const derived = metric("derived", "relation-1");
    if (derived.definition.specification.kind !== "derived") throw new Error("derived fixture");
    derived.definition.specification.base_metric = { metric_id: "base", version: 1 };
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [latestBase, derived], total_count: 2 });
    mocks.getMetric.mockResolvedValue(historicalBase);
    const { container } = renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 2 个|Expand metrics owned by 销售订单 \(2 total\)/,
      }),
    );
    expect(container.querySelectorAll('path[class*="metricDependencyEdge"]')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", {
        name: /衍生指标：指标 derived|Derived metrics: 指标 derived/,
      }),
    );

    expect(await screen.findByText("旧版订单数 · v1")).toBeInTheDocument();
    expect(mocks.getMetric).toHaveBeenCalledWith("network-1", "base", 1, {
      skipErrorToast: true,
    });
    expect(screen.queryByText("base · v1")).not.toBeInTheDocument();
    expect(container.querySelectorAll('path[class*="metricDependencyEdge"]')).toHaveLength(1);
  });

  it("shows an unavailable dependency without exposing its ID when the fetched version is wrong", async () => {
    const latestBase = metric("base");
    latestBase.definition.version = 2;
    const derived = metric("derived", "relation-1");
    if (derived.definition.specification.kind !== "derived") throw new Error("derived fixture");
    derived.definition.specification.base_metric = { metric_id: "base", version: 1 };
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [latestBase, derived], total_count: 2 });
    mocks.getMetric.mockResolvedValue(latestBase);
    renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 2 个|Expand metrics owned by 销售订单 \(2 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /衍生指标：指标 derived|Derived metrics: 指标 derived/,
      }),
    );

    expect(await screen.findByText("依赖指标 1 · v1 不可访问")).toBeInTheDocument();
    expect(screen.queryByText("base · v1")).not.toBeInTheDocument();
  });

  it("progressively expands metric nodes from an in-graph aggregate", async () => {
    const records = Array.from({ length: 7 }, (_, index) => metric(`metric-${index + 1}`));
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: records, total_count: records.length });
    const { container } = renderGraph();

    const count = await screen.findByRole("button", {
      name: /展开销售订单的指标，共 7 个|Expand metrics owned by 销售订单 \(7 total\)/,
    });
    fireEvent.click(count);
    expect(container.querySelectorAll('g[class*="metricNode"][role="button"]')).toHaveLength(6);
    expect(container.querySelector('[class*="expansionToolbar"]')).toBeNull();
    const more = screen.getByRole("button", {
      name: /继续展开原子指标的剩余 1 个指标|Expand the remaining 1 Atomic metric/,
    });
    expect(more.querySelector("text")?.textContent).toBe("+1");
    const svg = container.querySelector<SVGSVGElement>('svg[class*="graph"]')!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const originalMorePosition = more.getAttribute("transform")!;
    const morePosition = originalMorePosition.match(/translate\(([\d.]+) ([\d.]+)\)/)!;
    fireEvent.pointerDown(more, {
      button: 0,
      clientX: Number(morePosition[1]),
      clientY: Number(morePosition[2]),
      pointerId: 4,
    });
    fireEvent.pointerMove(svg, {
      clientX: Number(morePosition[1]) + 30,
      clientY: Number(morePosition[2]) + 20,
      pointerId: 4,
    });
    expect(more.getAttribute("transform")).not.toBe(originalMorePosition);
    fireEvent.pointerUp(svg, { pointerId: 4 });
    fireEvent.click(more);
    expect(container.querySelectorAll('g[class*="metricNode"][role="button"]')).toHaveLength(6);
    fireEvent.click(more);
    expect(container.querySelectorAll('g[class*="metricNode"][role="button"]')).toHaveLength(7);
    expect(
      screen.queryByRole("button", {
        name: /继续展开原子指标的剩余|Expand the remaining.*Atomic metric/,
      }),
    ).toBeNull();
    fireEvent.click(count);
    expect(container.querySelectorAll('g[class*="metricNode"][role="button"]')).toHaveLength(0);
  });

  it("restores the relation layout and zoom after leaving metric focus", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockResolvedValue({ entries: [metric("local")], total_count: 1 });
    const { container } = renderGraph();
    const related = await screen.findByRole("button", { name: "关联对象 1" });
    const svg = container.querySelector<SVGSVGElement>('svg[class*="graph"]')!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(related, { button: 0, clientX: 830, clientY: 280, pointerId: 3 });
    fireEvent.pointerMove(svg, { clientX: 750, clientY: 330, pointerId: 3 });
    fireEvent.pointerUp(svg, { clientX: 750, clientY: 330, pointerId: 3 });
    const relationPosition = related.getAttribute("transform");
    fireEvent.click(screen.getByRole("button", { name: /放大图谱|Zoom in/ }));
    const relationView = svg.getAttribute("viewBox");

    fireEvent.click(
      screen.getByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    expect(screen.queryByRole("button", { name: "关联对象 1" })).toBeNull();
    expect(svg.getAttribute("viewBox")).toBe("0 0 1000 560");

    fireEvent.click(screen.getByRole("button", { name: /返回对象关系|Back to object relations/ }));
    expect(screen.getByRole("button", { name: "关联对象 1" }).getAttribute("transform")).toBe(
      relationPosition,
    );
    expect(svg.getAttribute("viewBox")).toBe(relationView);
  });

  it("freely drags focus nodes and keeps their spokes connected without opening details", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [metric("metric")], total_count: 1 });
    const { container } = renderGraph();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    const svg = container.querySelector<SVGSVGElement>('svg[class*="graph"]')!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const node = screen.getByRole("button", {
      name: /原子指标：指标 metric|Atomic metric: 指标 metric/,
    });
    const owner = screen.getByRole("button", {
      name: /销售订单，共 1 个指标，点击展开指标图|销售订单, 1 metrics; click to expand the metric graph/,
    });
    const spoke = container.querySelector<SVGLineElement>('line[class*="metricSpoke"]')!;
    fireEvent.pointerDown(owner, { button: 0, clientX: 110, clientY: 280, pointerId: 3 });
    fireEvent.pointerMove(svg, { clientX: 160, clientY: 300, pointerId: 3 });
    expect(owner.getAttribute("transform")).toBe("translate(160 300)");
    expect(`${spoke.getAttribute("x1")},${spoke.getAttribute("y1")}`).toBe("160,300");
    fireEvent.pointerUp(svg, { clientX: 160, clientY: 300, pointerId: 3 });
    fireEvent.click(owner);
    expect(document.querySelector(".ant-drawer-open")).toBeNull();

    const originalNode = node.getAttribute("transform");
    const originalSpokeEnd = `${spoke.getAttribute("x2")},${spoke.getAttribute("y2")}`;
    const position = originalNode?.match(/translate\(([\d.]+) ([\d.]+)\)/);
    expect(position).not.toBeNull();
    const x = Number(position?.[1]);
    const y = Number(position?.[2]);

    fireEvent.pointerDown(node, { button: 0, clientX: x, clientY: y, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: x + 40, clientY: y - 40, pointerId: 2 });
    expect(node.getAttribute("transform")).not.toBe(originalNode);
    const movedPosition = node.getAttribute("transform")?.match(/translate\(([\d.]+) ([\d.]+)\)/);
    expect(movedPosition).not.toBeNull();
    expect(movedPosition?.slice(1)).toEqual([String(x + 40), String(y - 40)]);
    expect(`${spoke.getAttribute("x2")},${spoke.getAttribute("y2")}`).not.toBe(originalSpokeEnd);
    fireEvent.pointerUp(svg, { clientX: x + 40, clientY: y - 40, pointerId: 2 });
    fireEvent.click(node);
    expect(document.querySelector(".ant-drawer-open")).toBeNull();
  });

  it("expands relation metrics on the canvas and opens only metric details in a drawer", async () => {
    const related = metric("related", "relation-1");
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockResolvedValue({
      entries: [related, metric("local")],
      total_count: 2,
    });
    const openMetric = vi.fn();
    renderGraph(vi.fn(), openMetric);

    fireEvent.click(
      await screen.findByRole("button", { name: /关系 1，1 个指标|关系 1, 1 metrics/ }),
    );
    expect(
      screen.getByRole("button", {
        name: /衍生指标：指标 related|Derived metrics: 指标 related/,
      }),
    ).not.toBeNull();
    expect(screen.queryByText("指标 local")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: /衍生指标：指标 related|Derived metrics: 指标 related/,
      }),
    );
    const businessDefinition = screen.getByText("Description for related");
    expect(businessDefinition.closest(".ant-descriptions")).toBeNull();
    expect(businessDefinition.parentElement).toHaveTextContent("业务定义");
    expect(
      screen.getByText("关系 1", { selector: ".ant-descriptions-item-content" }),
    ).not.toBeNull();
    expect(openMetric).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^(详情|Details)$/ }));
    expect(openMetric).toHaveBeenCalledWith(related);
  });

  it("offers draft actions for the selected graph version without switching to the list", async () => {
    const draft = metric("working");
    draft.definition.version = 2;
    draft.definition.lifecycle.status = "draft";
    draft.definition.result_semantics = {
      statistical_grain: { group_by_dimensions: [] },
      value: {
        physical_type: "int64",
        semantic_type: "count",
        unit: {
          system: "registered",
          quantity_kind: "count",
          code: "times",
          display_symbol: "次",
          scale_factor: 1,
        },
      },
      no_data_policy: "zero",
      partial_data_policy: "reject",
    };
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [draft], total_count: 1 });
    const onOpenMetric = vi.fn();
    const onTrialMetric = vi.fn();
    const onEditMetric = vi.fn();
    const onDeleteVersion = vi.fn();
    renderGraph(vi.fn(), onOpenMetric, {
      canDelete: true,
      canModify: true,
      onDeleteVersion,
      onEditMetric,
      onTrialMetric,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /原子指标：指标 working|Atomic metric: 指标 working/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    const drawer = screen.getByRole("dialog", { name: "指标详情" });
    const actions = drawer.querySelector<HTMLElement>("[class*=drawerActions]");
    const descriptions = drawer.querySelector<HTMLElement>(".ant-descriptions");
    expect(actions).not.toBeNull();
    expect(descriptions).not.toBeNull();
    expect(
      actions!.compareDocumentPosition(descriptions!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(drawer).toHaveTextContent("版本v2");
    expect(drawer).toHaveTextContent("计算范围");
    expect(drawer).toHaveTextContent("计算口径计数");
    expect(drawer).toHaveTextContent("值类型整数 / 计数");
    expect(drawer).toHaveTextContent("单位次");
    expect(drawer).not.toHaveTextContent("逻辑属性");
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(screen.queryByRole("button", { name: "更多操作" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除指标版本" }));

    expect(onTrialMetric).toHaveBeenCalledWith(draft);
    expect(onEditMetric).toHaveBeenCalledWith(draft);
    expect(onOpenMetric).toHaveBeenCalledWith(draft);
    expect(onDeleteVersion).toHaveBeenCalledWith(draft);
  });

  it("opens authorization for the selected metric from the graph detail drawer", async () => {
    const selected = metric("authorized");
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [selected], total_count: 1 });
    const onAuthorizeMetric = vi.fn();
    renderGraph(vi.fn(), vi.fn(), { onAuthorizeMetric });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /原子指标：指标 authorized|Atomic metric: 指标 authorized/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "配置权限" }));

    expect(onAuthorizeMetric).toHaveBeenCalledWith(selected);
  });

  it("shows a registered transaction unit by its business name in the graph detail", async () => {
    const orderMetric = metric("transaction-count");
    orderMetric.definition.result_semantics = {
      statistical_grain: { group_by_dimensions: [] },
      value: {
        physical_type: "int64",
        semantic_type: "count",
        unit: {
          system: "registered",
          quantity_kind: "count",
          code: "transaction",
          scale_factor: 1,
        },
      },
      no_data_policy: "zero",
      partial_data_policy: "reject",
    };
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [orderMetric], total_count: 1 });
    renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /原子指标：指标 transaction-count|Atomic metric: 指标 transaction-count/,
      }),
    );

    const drawer = screen.getByRole("dialog", { name: "指标详情" });
    expect(drawer).toHaveTextContent("单位交易笔");
    expect(drawer).not.toHaveTextContent("单位transaction");
  });

  it("keeps mutating graph actions hidden without modify permission", async () => {
    const draft = metric("working");
    draft.definition.lifecycle.status = "draft";
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [draft], total_count: 1 });
    renderGraph(vi.fn(), vi.fn(), {
      onDeleteVersion: vi.fn(),
      onEditMetric: vi.fn(),
      onTrialMetric: vi.fn(),
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /原子指标：指标 working|Atomic metric: 指标 working/ }),
    );
    expect(screen.getByRole("button", { name: "试算" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更多操作" })).not.toBeInTheDocument();
  });

  it("disables deprecation when the selected published version backs a logic property", async () => {
    const published = metric("bound");
    published.definition.calculation_scope = "object_instance";
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [published], total_count: 1 });
    const onDeprecate = vi.fn();
    renderGraph(vi.fn(), vi.fn(), {
      canModify: true,
      onDeprecate,
      ownerObjectType: {
        logicProperties: [
          {
            displayName: "支付金额",
            name: "paid_amount",
            metricBinding: { metric_ref: { metric_id: "bound", version: 1 } },
          },
        ],
      } as ObjectTypeDetail,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /原子指标：指标 bound|Atomic metric: 指标 bound/ }),
    );
    expect(screen.getByText("支付金额 · v1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更多操作" })).not.toBeInTheDocument();
    expect(screen.getByText("废弃").closest("button")).toBeDisabled();
    expect(onDeprecate).not.toHaveBeenCalled();
  });

  it("distinguishes a logical property bound to another metric version", async () => {
    const draft = metric("bound");
    draft.definition.version = 2;
    draft.definition.calculation_scope = "object_instance";
    draft.definition.lifecycle.status = "draft";
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [draft], total_count: 1 });
    renderGraph(vi.fn(), vi.fn(), {
      ownerObjectType: {
        logicProperties: [
          {
            displayName: "支付金额",
            name: "paid_amount",
            metricBinding: { metric_ref: { metric_id: "bound", version: 1 } },
          },
        ],
      } as ObjectTypeDetail,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /原子指标：指标 bound|Atomic metric: 指标 bound/ }),
    );
    expect(screen.getByRole("dialog", { name: "指标详情" })).toHaveTextContent(
      "当前版本未绑定（支付金额 绑定 v1）",
    );
  });

  it("keeps the focused metric open when graph data refreshes", async () => {
    const original = metric("working");
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [original], total_count: 1 });
    const props = {
      networkId: "network-1",
      onOpenMetric: vi.fn(),
      onSelectObject: vi.fn(),
      selectedObjectTypeId: "order",
      selectedObjectTypeName: "销售订单",
    };
    const { rerender } = render(<ObjectMetricGraphCanvas {...props} refreshVersion={0} />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /原子指标：指标 working|Atomic metric: 指标 working/ }),
    );
    expect(screen.getByRole("dialog", { name: "指标详情" })).toBeInTheDocument();

    rerender(<ObjectMetricGraphCanvas {...props} refreshVersion={1} />);
    await waitFor(() => expect(mocks.listMetrics).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("dialog", { name: "指标详情" })).toBeInTheDocument();
    expect(screen.getByText("指标 working", { selector: "strong" })).toBeInTheDocument();
  });

  it("restores the selected graph metric after returning from its detail page", async () => {
    const first = metric("first");
    const selected = metric("selected");
    selected.definition.version = 2;
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [first, selected], total_count: 2 });

    renderGraph(vi.fn(), vi.fn(), {
      initialFocusedMetric: { id: "selected", objectTypeId: "order", version: 2 },
    });

    expect(await screen.findByRole("dialog", { name: "指标详情" })).toBeInTheDocument();
    expect(screen.getByText("指标 selected", { selector: "strong" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /原子指标：指标 selected|Atomic metric: 指标 selected/,
      }),
    ).toBeInTheDocument();
  });

  it("leaves absent relation and dependency fields blank in metric details", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [metric("local")], total_count: 1 });
    renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /原子指标：指标 local|Atomic metric: 指标 local/,
      }),
    );

    expect(screen.queryByText(/使用的关系|Relations used/)).toBeNull();
    expect(screen.queryByText(/直接依赖|Direct dependencies/)).toBeNull();
    expect(screen.getByRole("button", { name: /^(详情|Details)$/ })).not.toBeNull();
  });

  it("does not expose relation IDs from another graph page in metric details", async () => {
    const relations = Array.from({ length: 8 }, (_, index) => relation(index + 1));
    mocks.listRelations.mockImplementation(
      (_networkId: string, query: { limit: number; offset: number }) =>
        Promise.resolve({
          entries: relations.slice(query.offset, query.offset + query.limit),
          totalCount: relations.length,
        }),
    );
    mocks.listMetrics.mockResolvedValue({
      entries: [metric("off-page", "relation-7")],
      total_count: 1,
    });
    renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /衍生指标：指标 off-page|Derived metrics: 指标 off-page/,
      }),
    );

    expect(screen.queryByText(/使用的关系|Relations used/)).toBeNull();
    expect(screen.queryByText("relation-7")).toBeNull();
  });

  it("shows the full metric name when a truncated graph node is hovered", async () => {
    const longMetric = metric("very-long-metric-name");
    longMetric.definition.name = "很长的指标名称需要完整展示";
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    mocks.listMetrics.mockResolvedValue({ entries: [longMetric], total_count: 1 });
    renderGraph();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /展开销售订单的指标，共 1 个|Expand metrics owned by 销售订单 \(1 total\)/,
      }),
    );
    const node = screen.getByRole("button", {
      name: /原子指标：很长的指标名称需要完整展示|Atomic metric: 很长的指标名称需要完整展示/,
    });
    expect(node.textContent).toBe("很长的指标名称需要完…");

    fireEvent.mouseEnter(node);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("很长的指标名称需要完整展示");
  });

  it("does not treat partially scanned metrics as a complete relation count", async () => {
    const records = Array.from({ length: 205 }, (_, index) =>
      metric(`metric-${index}`, "relation-1"),
    );
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockImplementation(
      (_networkId: string, query: { limit: number; offset: number }) =>
        Promise.resolve({
          entries: records.slice(query.offset, query.offset + query.limit),
          total_count: records.length,
        }),
    );
    const { container } = renderGraph();

    await waitFor(() =>
      expect(mocks.listMetrics).toHaveBeenCalledWith(
        "network-1",
        { limit: 50, metricType: undefined, offset: 150, ownerObjectTypeId: "order" },
        { skipErrorToast: true },
      ),
    );
    expect(container.querySelector('[class*="ownerNode"] text')?.textContent).toBe("205");
    expect(container.querySelector('[class*="relationCountAction"] text')?.textContent).toMatch(
      /200\+ 个指标|200\+ metrics/,
    );
    expect(screen.getByText(/前 200 \/ 205|first 200 of 205/)).not.toBeNull();
  });

  it("does not display the previous object's relations while a new object loads", async () => {
    let resolveNext!: (value: {
      entries: KnowledgeNetworkRelationTypeRecord[];
      totalCount: number;
    }) => void;
    mocks.listRelations.mockImplementation(
      (_networkId: string, query: { boundObjectTypeId: string }) =>
        query.boundObjectTypeId === "order"
          ? Promise.resolve({ entries: [relation(1)], totalCount: 1 })
          : new Promise((resolve) => {
              resolveNext = resolve;
            }),
    );
    mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });
    const { rerender } = renderGraph();
    expect(
      await screen.findByLabelText(
        /关系 1，没有指标明确使用这条关系|关系 1, no metric explicitly uses this relation/,
      ),
    ).not.toBeNull();

    rerender(
      <ObjectMetricGraphCanvas
        networkId="network-1"
        onOpenMetric={vi.fn()}
        onSelectObject={vi.fn()}
        refreshVersion={0}
        selectedObjectTypeId="neighbor-2"
        selectedObjectTypeName="关联对象 2"
      />,
    );
    expect(
      screen.queryByLabelText(
        /关系 1，没有指标明确使用这条关系|关系 1, no metric explicitly uses this relation/,
      ),
    ).toBeNull();
    resolveNext({ entries: [], totalCount: 0 });
    expect(await screen.findByText(/没有匹配的关联关系|No matching relations/)).not.toBeNull();
  });
});
