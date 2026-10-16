/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/relation-type";

const mocks = vi.hoisted(() => ({
  listMetrics: vi.fn(),
  listRelations: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/object-metric.service", () => ({
  listObjectMetricsV1: mocks.listMetrics,
}));
vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  listKnowledgeNetworkRelationTypePage: mocks.listRelations,
}));

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
afterAll(() => {
  window.matchMedia = originalMatchMedia;
  Reflect.deleteProperty(SVGElement.prototype, "getBBox");
});

afterEach(() => {
  cleanup();
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

function renderGraph(onSelectObject = vi.fn(), onOpenMetric = vi.fn()) {
  return render(
    <ObjectMetricGraphCanvas
      networkId="network-1"
      onOpenMetric={onOpenMetric}
      onSelectObject={onSelectObject}
      refreshVersion={0}
      selectedObjectTypeId="order"
      selectedObjectTypeName="销售订单"
    />,
  );
}

describe("ObjectMetricGraphCanvas", () => {
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
    composite.definition.metric_type = "composite";
    composite.definition.specification = {
      kind: "composite",
      dependencies: [
        {
          alias: "base",
          metric_ref: { metric_id: "base", version: 1 },
          object_alignment: { mode: "same_object", deduplication: "none" },
          evaluation_context: { window: "inherited", filter_context: { mode: "inherit" } },
        },
        {
          alias: "derived",
          metric_ref: { metric_id: "derived", version: 1 },
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
    expect(screen.getByText("指标 base、指标 derived")).not.toBeNull();

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
    fireEvent.pointerDown(owner, { button: 0, clientX: 500, clientY: 280, pointerId: 3 });
    fireEvent.pointerMove(svg, { clientX: 550, clientY: 300, pointerId: 3 });
    expect(owner.getAttribute("transform")).toBe("translate(550 300)");
    expect(`${spoke.getAttribute("x1")},${spoke.getAttribute("y1")}`).toBe("550,300");
    fireEvent.pointerUp(svg, { clientX: 550, clientY: 300, pointerId: 3 });
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
    mocks.listRelations.mockResolvedValue({ entries: [relation(1)], totalCount: 1 });
    mocks.listMetrics.mockResolvedValue({
      entries: [metric("related", "relation-1"), metric("local")],
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
    expect(screen.getByText("Description for related")).not.toBeNull();
    expect(
      screen.getByText("关系 1", { selector: ".ant-descriptions-item-content" }),
    ).not.toBeNull();
    expect(openMetric).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /查看指标详情|View metric details/ }));
    expect(openMetric).toHaveBeenCalledWith("related");
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

    const relationRow = screen
      .getByText(/使用的关系|Relations used/)
      .closest(".ant-descriptions-item");
    const dependencyRow = screen
      .getByText(/直接依赖|Direct dependencies/)
      .closest(".ant-descriptions-item");
    expect(relationRow?.querySelector(".ant-descriptions-item-content")).toBeNull();
    expect(dependencyRow?.querySelector(".ant-descriptions-item-content")).toBeNull();
    expect(screen.getByRole("button", { name: /查看指标详情|View metric details/ })).not.toBeNull();
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

    const relationRow = screen
      .getByText(/使用的关系|Relations used/)
      .closest(".ant-descriptions-item");
    expect(relationRow?.querySelector(".ant-descriptions-item-content")).toBeNull();
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

    await waitFor(() => expect(mocks.listMetrics).toHaveBeenCalledTimes(4));
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
