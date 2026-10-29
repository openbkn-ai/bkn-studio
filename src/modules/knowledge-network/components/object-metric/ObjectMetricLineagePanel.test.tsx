/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { ObjectMetricLineagePanel } from "@/modules/knowledge-network/components/object-metric/ObjectMetricLineagePanel";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

function metric(
  id: string,
  name: string,
  specification: ObjectMetricRecordV1["definition"]["specification"],
): ObjectMetricRecordV1 {
  return {
    branch: "main",
    create_time: 0,
    creator: { id: "test", type: "user" },
    definition: {
      code: id,
      description: "",
      id,
      lifecycle: {
        aggregation_registry_version: "v1",
        expression_language_version: "v1",
        function_registry_version: "v1",
        ontology_version: "v1",
        status: "published",
        unit_registry_version: "v1",
      },
      metric_type: specification.kind,
      name,
      owner_object_type_id: "order",
      query_capabilities: { analysis_dimensions: [], time_dimensions: [] },
      result_semantics: {
        no_data_policy: "zero",
        partial_data_policy: "reject",
        statistical_grain: { group_by_dimensions: [] },
        value: { physical_type: "int64", semantic_type: "count" },
      },
      specification,
      version: 1,
    },
    kn_id: "test-network",
    update_time: 0,
    updater: { id: "test", type: "user" },
  };
}

describe("ObjectMetricLineagePanel", () => {
  it("keeps an atomic working copy compact instead of rendering three empty columns", () => {
    const current = metric("order_count", "订单数", {
      kind: "atomic",
      measure: { aggregation: "count_rows" },
    });
    current.definition.version = 2;
    current.definition.lifecycle.status = "draft";

    render(<ObjectMetricLineagePanel metric={current} metrics={[]} />);

    expect(screen.getByText("取值来源")).toBeInTheDocument();
    expect(screen.queryByText("@v2")).not.toBeInTheDocument();
    expect(screen.queryByText("上游 0")).not.toBeInTheDocument();
  });

  it("updates visible copy when the language changes", async () => {
    const current = metric("order_count", "Order count", {
      kind: "atomic",
      measure: { aggregation: "count_rows" },
    });
    try {
      await i18n.changeLanguage("zh-CN");
      render(<ObjectMetricLineagePanel metric={current} metrics={[]} />);
      expect(screen.getByRole("region", { name: "依赖与引用" })).toBeInTheDocument();
      await act(async () => {
        await i18n.changeLanguage("en-US");
      });
      expect(
        screen.getByRole("region", { name: "Dependencies and references" }),
      ).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("zh-CN");
    }
  });

  it("shows released references without a persistent warning or empty columns", () => {
    const current = metric("order_count", "订单数", {
      kind: "atomic",
      measure: { aggregation: "count_rows" },
    });
    const downstream = metric("completed_order_count", "已完成订单数", {
      base_metric: { metric_id: current.definition.id, version: 1 },
      business_qualifiers: {},
      kind: "derived",
    });
    render(
      <ObjectMetricLineagePanel
        metric={current}
        metrics={[downstream]}
        ownerObjectType={{
          dataProperties: [],
          id: "order",
          logicProperties: [],
          name: "销售订单",
        }}
      />,
    );

    expect(screen.getByText("已发布引用")).toBeInTheDocument();
    expect(screen.getByText("已完成订单数")).toBeInTheDocument();
    expect(screen.queryByText(/历史版本及未加载的引用尚未核实/)).not.toBeInTheDocument();
    expect(screen.queryByText(/展示当前版本的取值来源/)).not.toBeInTheDocument();
    expect(screen.queryByText("影响分析")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows atomic measure properties and does not claim zero downstream impact", () => {
    const current = metric("paid_amount", "支付金额", {
      kind: "atomic",
      measure: {
        aggregation: "sum",
        expression: {
          node_type: "property",
          property_ref: { object_type_id: "order", property_name: "paid_amount" },
        },
      },
    });
    render(
      <ObjectMetricLineagePanel
        metric={current}
        metrics={[]}
        ownerObjectType={{
          dataProperties: [{ displayName: "实付金额", name: "paid_amount" }],
          id: "order",
          logicProperties: [],
          name: "销售订单",
        }}
      />,
    );

    expect(screen.getByText("取值来源")).toBeInTheDocument();
    expect(screen.getByText("销售订单")).toBeInTheDocument();
    expect(screen.getByText("实付金额")).toBeInTheDocument();
    expect(screen.queryByText("下游 0")).not.toBeInTheDocument();
    expect(screen.queryByText(/历史版本及未加载的引用尚未核实/)).not.toBeInTheDocument();
  });

  it("uses the logical property's business name for an atomic measure source", () => {
    const current = metric("paid_amount", "支付金额", {
      kind: "atomic",
      measure: {
        aggregation: "sum",
        expression: {
          node_type: "property",
          property_ref: { object_type_id: "order", property_name: "paid_amount" },
        },
      },
    });

    render(
      <ObjectMetricLineagePanel
        metric={current}
        metrics={[]}
        ownerObjectType={{
          dataProperties: [],
          id: "order",
          logicProperties: [{ displayName: "实付金额", name: "paid_amount" }],
          name: "销售订单",
        }}
      />,
    );

    expect(screen.getByText("实付金额")).toBeInTheDocument();
    expect(screen.queryByText("paid_amount")).not.toBeInTheDocument();
  });

  it("separates draft references from released downstream impact", () => {
    const current = metric("order_count", "订单数", {
      kind: "atomic",
      measure: { aggregation: "count_rows" },
    });
    const released = metric("released_derived", "已发布衍生对象指标", {
      base_metric: { metric_id: current.definition.id, version: 1 },
      business_qualifiers: {},
      kind: "derived",
    });
    const draft = metric("draft_derived", "草稿衍生对象指标", {
      base_metric: { metric_id: current.definition.id, version: 1 },
      business_qualifiers: {},
      kind: "derived",
    });
    draft.definition.version = 2;
    draft.definition.lifecycle.status = "draft";

    render(<ObjectMetricLineagePanel metric={current} metrics={[released, draft]} />);

    expect(screen.getByText("已发布引用")).toBeInTheDocument();
    expect(screen.getByText("待发布引用")).toBeInTheDocument();
    expect(screen.getByText("已发布衍生对象指标")).toBeInTheDocument();
    expect(screen.getByText("草稿衍生对象指标")).toBeInTheDocument();
    expect(screen.queryByText("下游 2")).not.toBeInTheDocument();
  });

  it("opens the exact referenced version", () => {
    const base = metric("order_count", "订单数", {
      kind: "atomic",
      measure: { aggregation: "count_rows" },
    });
    const current = metric("completed_order_count", "已完成订单数", {
      base_metric: { metric_id: base.definition.id, version: 1 },
      business_qualifiers: {},
      kind: "derived",
    });
    const onOpenMetric = vi.fn();
    render(
      <ObjectMetricLineagePanel metric={current} metrics={[base]} onOpenMetric={onOpenMetric} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "订单数" }));
    expect(onOpenMetric).toHaveBeenCalledWith("order_count", 1);
    expect(screen.getByText("v1").parentElement).toContainElement(
      screen.getByRole("button", { name: "订单数" }),
    );
    expect(screen.queryByText("@v1")).not.toBeInTheDocument();
  });
});
