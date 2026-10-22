/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import type {
  ObjectMetricDataV1,
  ObjectMetricQueryRequestV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricAnalysisPanel", () => ({
  ObjectMetricAnalysisPanel: ({
    identityLabels,
    pathControls,
    propertyLabels,
    result,
    resultTable,
    selectionControls,
  }: {
    identityLabels: Record<string, string>;
    pathControls?: ReactNode;
    propertyLabels: Record<string, string>;
    result: ObjectMetricDataV1;
    resultTable?: ReactNode;
    selectionControls?: ReactNode;
  }) => (
    <section aria-label="图表与数据">
      <div
        data-testid="analysis-labels"
        data-identity-labels={JSON.stringify(identityLabels)}
        data-property-labels={JSON.stringify(propertyLabels)}
      />
      {pathControls}
      {selectionControls}
      {result.entries.length ? resultTable : null}
    </section>
  ),
}));

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

describe("ObjectMetricTrialDrawer", () => {
  it("sends final-value HAVING and ORDER BY through the shared trial query", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    definition.result_semantics.value.physical_type = "int64";
    const onRun = vi.fn().mockResolvedValue({
      entries: [],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "summary",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "no_data",
      empty_reason: "filtered_out",
    } satisfies ObjectMetricDataV1);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    const havingRow = screen.getByRole("group", { name: "结果筛选" });
    const orderRow = screen.getByRole("group", { name: "结果排序" });
    expect(within(havingRow).getByRole("combobox", { name: "结果筛选" })).toBeInTheDocument();
    expect(within(orderRow).getByRole("combobox", { name: "结果排序" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "结果筛选" }));
    fireEvent.click(await screen.findByText("大于"));
    expect(within(havingRow).getByRole("textbox", { name: "比较值" })).toBeInTheDocument();
    expect(within(orderRow).queryByRole("textbox", { name: "比较值" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "比较值" }), { target: { value: "10" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "结果排序" }));
    fireEvent.click(await screen.findByText("指标值"));
    expect(within(orderRow).getByRole("combobox", { name: "排序方向" })).toBeInTheDocument();
    expect(within(havingRow).queryByRole("combobox", { name: "排序方向" })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "排序方向" }));
    fireEvent.click(await screen.findByText("降序"));
    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith(
        expect.objectContaining({
          group_by: [],
          having: { operator: "gt", value: 10, unit_code: undefined },
          order_by: [{ field: "value", dimension: undefined, direction: "desc" }],
        }),
      ),
    );
    expect(await screen.findByText("存在计算结果，但均不满足结果筛选条件。")).toBeInTheDocument();
  }, 20_000);

  it("clears dimension sorting when the selected group is removed", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    definition.query_capabilities.analysis_dimensions = [
      { object_type_id: "order", property_name: "status" },
    ];
    const onRun = vi.fn().mockResolvedValue({
      entries: [],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "summary",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "no_data",
    } satisfies ObjectMetricDataV1);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    const groupSelect = screen
      .getByText("按维度分组")
      .closest(".ant-form-item")
      ?.querySelector(".ant-select-selector");
    expect(groupSelect).not.toBeNull();
    fireEvent.mouseDown(groupSelect!);
    fireEvent.click(await screen.findByText("status"));
    const orderRow = screen.getByRole("group", { name: "结果排序" });
    fireEvent.mouseDown(within(orderRow).getByRole("combobox", { name: "结果排序" }));
    const orderOption = Array.from(
      document.querySelectorAll(
        ".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content",
      ),
    ).find((item) => item.textContent === "status");
    expect(orderOption).not.toBeNull();
    fireEvent.click(orderOption!);
    expect(within(orderRow).getByRole("combobox", { name: "排序方向" })).toBeInTheDocument();

    const removeGroup = groupSelect!
      .closest(".ant-form-item")
      ?.querySelector(".ant-select-selection-item-remove");
    expect(removeGroup).not.toBeNull();
    fireEvent.click(removeGroup!);
    expect(within(orderRow).getByText("默认顺序")).toBeInTheDocument();
    expect(within(orderRow).queryByRole("combobox", { name: "排序方向" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    await waitFor(() => expect(onRun).toHaveBeenCalledOnce());
    expect(onRun.mock.calls[0][0]).toMatchObject({ group_by: [] });
    expect(onRun.mock.calls[0][0]).not.toHaveProperty("order_by");
  }, 20_000);

  it("keeps relation aliases distinct when selecting same-named dimensions", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    definition.query_capabilities.analysis_dimensions = [
      { object_type_id: "person", relation_path_alias: "buyer", property_name: "region" },
      { object_type_id: "person", relation_path_alias: "seller", property_name: "region" },
    ];
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          dimension_cells: [
            {
              ref: {
                object_type_id: "person",
                relation_path_alias: "buyer",
                property_name: "region",
              },
              value: "East",
            },
            {
              ref: {
                object_type_id: "person",
                relation_path_alias: "seller",
                property_name: "region",
              },
              value: "West",
            },
          ],
          dimensions: { "person.region": "West" },
          status: "ok",
          value: 1,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    const dimensionSelect = document.querySelector(".ant-drawer-body .ant-select-selector");
    expect(dimensionSelect).not.toBeNull();
    fireEvent.mouseDown(dimensionSelect!);
    fireEvent.click(await screen.findByText("region (buyer)"));
    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        group_by: [
          { object_type_id: "person", relation_path_alias: "buyer", property_name: "region" },
        ],
        instance_identities: undefined,
        time: undefined,
      }),
    );
    expect(await screen.findByRole("columnheader", { name: "region (buyer)" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "region (seller)" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "East" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "West" })).toBeInTheDocument();
  });

  it("uses the same trial workspace for published metrics", () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "销售订单数";
    definition.calculation_scope = "object_set";
    definition.lifecycle.status = "published";

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="published"
        onClose={vi.fn()}
        onRun={vi.fn()}
        open
      />,
    );

    expect(screen.getByText("试算 · 销售订单数")).toBeInTheDocument();
    expect(screen.getByText("设置试算条件并点击试算，即可查看指标结果。")).toBeInTheDocument();
    const runButton = screen.getByRole("button", { name: "试算" });
    expect(
      screen.getByRole("heading", { name: "试算条件" }).parentElement?.parentElement,
    ).toContainElement(runButton);
    expect(runButton).toHaveAttribute("form", document.querySelector("form")?.id);
    expect(screen.getByRole("dialog").closest(".ant-drawer")?.className).toContain(
      "analysisDrawer",
    );
  });

  it("shows business labels instead of internal enum values in calculation context", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    if (definition.specification.kind !== "atomic") throw new Error("expected atomic metric");
    definition.specification.measure.aggregation = "count";
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          bucket_key: "confirmed-orders",
          available_actions: ["context"],
          dimension_cells: [
            { ref: { object_type_id: "order", property_name: "status" }, value: "已确认" },
          ],
          status: "ok",
          value: 5,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 1,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="published"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    fireEvent.click(await screen.findByRole("row", { name: /已确认.*5/ }));
    fireEvent.click(screen.getByRole("button", { name: "查看计算口径" }));

    expect(await screen.findByText("非空计数")).toBeInTheDocument();
    expect(screen.getByText("实例集合")).toBeInTheDocument();
    expect(screen.queryByText("count")).not.toBeInTheDocument();
    expect(screen.queryByText("object_set")).not.toBeInTheDocument();
  });

  it("links participants by exact identity instead of a sample-row key", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          bucket_key: "all-orders",
          available_actions: ["participants", "context"],
          status: "ok",
          value: 10,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "summary",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);
    const onDrillThrough = vi.fn().mockResolvedValue({
      participants: [{ instance_identity: { order_id: 10361 }, role: "owner" }],
      bucket_value: "10",
      status: "ok",
    });
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        networkId="kn-1"
        objectType={
          {
            dataProperties: [{ name: "order_id", displayName: "订单 ID" }],
            primaryKeys: ["order_id"],
          } as ObjectTypeDetail
        }
        onClose={vi.fn()}
        onDrillThrough={onDrillThrough}
        onRun={onRun}
        open
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    fireEvent.click(await screen.findByRole("row", { name: /10/ }));
    fireEvent.click(screen.getByRole("button", { name: "查看参与实例" }));

    const link = await screen.findByRole("link", { name: /10361/ });
    expect(screen.getByRole("columnheader", { name: "实例" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "参与角色" })).not.toBeInTheDocument();
    expect(screen.queryByText("归属对象")).not.toBeInTheDocument();
    expect(screen.queryByText("当前数据可能已变化，明细与原图表值可能不同。")).toBeNull();
    expect(link).toHaveAttribute("target", "_blank");
    const target = new URL(link.getAttribute("href") ?? "", "http://localhost");
    expect(target.searchParams.get("sampleRow")).toBeNull();
    expect(JSON.parse(target.searchParams.get("metricInstance") ?? "null")).toEqual({
      order_id: 10361,
    });
  });

  it("shows newly loaded participant rows after loading another server page", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          bucket_key: "all-orders",
          available_actions: ["participants"],
          status: "ok",
          value: 120,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "summary",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);
    const onDrillThrough = vi
      .fn()
      .mockResolvedValueOnce({
        participants: Array.from({ length: 100 }, (_, index) => ({
          instance_identity: { order_id: `order-${index}` },
          role: "owner",
        })),
        next_cursor: "next-page",
        status: "ok",
      })
      .mockResolvedValueOnce({
        participants: Array.from({ length: 20 }, (_, index) => ({
          instance_identity: { order_id: `order-${index + 100}` },
          role: "owner",
        })),
        status: "ok",
      });
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onDrillThrough={onDrillThrough}
        onRun={onRun}
        open
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    fireEvent.click(await screen.findByRole("row", { name: /120/ }));
    fireEvent.click(screen.getByRole("button", { name: "查看参与实例" }));
    expect(await screen.findByText("order_id: order-0")).toBeInTheDocument();
    expect(screen.queryByText("order_id: order-100")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(await screen.findByText("order_id: order-100")).toBeInTheDocument();
    expect(onDrillThrough).toHaveBeenCalledTimes(2);
    expect(onDrillThrough.mock.calls[1][2]).toBe("next-page");
  });

  it("filters only the selected bucket and restores the prior result without a new request", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    const base: ObjectMetricDataV1 = {
      entries: [
        {
          bucket_key: "bucket-east",
          available_actions: ["filter", "drill", "participants", "context"],
          dimension_cells: [
            { ref: { object_type_id: "order", property_name: "region" }, value: "east" },
          ],
          dimensions: { "order.region": "east" },
          status: "ok",
          value: 10,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    };
    const onRun = vi
      .fn<(query: ObjectMetricQueryRequestV1) => Promise<ObjectMetricDataV1>>()
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({
        ...base,
        entries: [{ status: "ok", value: 10, dimensions: { "order.region": "east" } }],
      });
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    fireEvent.click(await screen.findByRole("row", { name: /east/ }));
    fireEvent.click(screen.getByRole("button", { name: "按此值筛选" }));
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(2));
    expect(onRun.mock.calls[1][0]).toMatchObject({
      bucket_selection: { bucket_key: "bucket-east", parent_query: onRun.mock.calls[0][0] },
    });
    fireEvent.click(screen.getByRole("button", { name: "初始结果" }));
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it("stops at a bucket that adds no new filter condition", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    const entry: ObjectMetricDataV1["entries"][number] = {
      available_actions: ["filter", "context"],
      bucket_key: "first-bucket",
      dimension_cells: [
        { ref: { object_type_id: "order", property_name: "status" }, value: "执行中" },
      ],
      status: "ok",
      value: 1,
    };
    const base: ObjectMetricDataV1 = {
      entries: [entry],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    };
    const onRun = vi
      .fn<(query: ObjectMetricQueryRequestV1) => Promise<ObjectMetricDataV1>>()
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({
        ...base,
        entries: [{ ...entry, bucket_key: "same-bucket-from-next-query" }],
      });
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    fireEvent.click(await screen.findByRole("row", { name: /执行中.*1/ }));
    fireEvent.click(screen.getByRole("button", { name: "按此值筛选" }));
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(2));
    await screen.findByRole("button", { name: "返回上一级" });
    fireEvent.click(await screen.findByRole("row", { name: /执行中.*1/ }));

    expect(screen.queryByRole("button", { name: "按此值筛选" })).not.toBeInTheDocument();
    expect(screen.getByText("已到当前分析的最细层级")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回上一级" })).toBeEnabled();
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it("shows how to select a group before exposing drill actions and highlights the selected row", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    definition.result_semantics.statistical_grain.group_by_dimensions = [
      { object_type_id: "order", property_name: "status" },
    ];
    definition.query_capabilities.analysis_dimensions = [
      { object_type_id: "order", property_name: "product_code" },
    ];
    const base: ObjectMetricDataV1 = {
      entries: [
        {
          bucket_key: "confirmed-orders",
          available_actions: ["drill", "context"],
          dimension_cells: [
            { ref: { object_type_id: "order", property_name: "status" }, value: "已确认" },
          ],
          status: "ok",
          value: 784,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    };
    const onRun = vi
      .fn<(query: ObjectMetricQueryRequestV1) => Promise<ObjectMetricDataV1>>()
      .mockResolvedValue(base);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    expect(
      await screen.findByText("点击图表中的数据点或数据表行，查看可用的分析操作。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "分析路径" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "继续下钻" })).not.toBeInTheDocument();

    const row = screen.getByRole("row", { name: /已确认.*784/ });
    expect(row).toHaveAttribute("aria-selected", "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(
      screen.queryByText("点击图表中的数据点或数据表行，查看可用的分析操作。"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("当前分组: status: 已确认")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "图表与数据" })).getByText(
        "当前分组: status: 已确认",
      ),
    ).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择下钻维度" }));
    fireEvent.click(await screen.findByText("product_code"));
    fireEvent.click(screen.getByRole("button", { name: "继续下钻" }));
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(2));
    expect(onRun.mock.calls[1][0]).toMatchObject({
      group_by: [{ object_type_id: "order", property_name: "product_code" }],
      bucket_selection: { bucket_key: "confirmed-orders", parent_query: onRun.mock.calls[0][0] },
    });
    const path = await screen.findByRole("navigation", { name: "分析路径" });
    expect(
      within(screen.getByRole("region", { name: "图表与数据" })).getByRole("navigation", {
        name: "分析路径",
      }),
    ).toBe(path);
    expect(within(path).getByRole("button", { name: "初始结果" })).toBeInTheDocument();
    const currentLevel = within(path).getByText("当前").parentElement;
    expect(currentLevel).toHaveAttribute("aria-current", "step");
    expect(currentLevel).toHaveTextContent("status: 已确认");
    fireEvent.click(within(path).getByRole("button", { name: "返回上一级" }));
    expect(screen.queryByRole("navigation", { name: "分析路径" })).not.toBeInTheDocument();
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it("paginates large trial results while keeping later rows accessible", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    const onRun = vi.fn().mockResolvedValue({
      entries: Array.from({ length: 51 }, (_, index) => ({
        dimensions: { row: `row-${index}` },
        status: "ok" as const,
        value: index,
      })),
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    expect(await screen.findByText("row-0")).toBeInTheDocument();
    expect(screen.getByText("本次返回 51 组结果")).toBeInTheDocument();
    expect(screen.getByText("本地分页 · 每页 50 条")).toBeInTheDocument();
    expect(screen.queryByText("row: row-50")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("2"));
    expect(await screen.findByText("row-50")).toBeInTheDocument();
  });

  it("shows only the newly selected dimension at each analysis path level", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    definition.query_capabilities.analysis_dimensions = [
      { object_type_id: "order", property_name: "product_code" },
    ];
    const statusCell = {
      ref: { object_type_id: "order", property_name: "status" },
      value: "已确认",
    };
    const base: ObjectMetricDataV1 = {
      entries: [
        {
          available_actions: ["drill"],
          bucket_key: "status-bucket",
          dimension_cells: [statusCell],
          status: "ok",
          value: 784,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    };
    const onRun = vi
      .fn<(query: ObjectMetricQueryRequestV1) => Promise<ObjectMetricDataV1>>()
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({
        ...base,
        entries: [
          {
            available_actions: ["filter"],
            bucket_key: "product-bucket",
            dimension_cells: [
              statusCell,
              {
                ref: { object_type_id: "order", property_name: "product_code" },
                value: "382-000005",
              },
            ],
            status: "ok",
            value: 40,
          },
        ],
      })
      .mockResolvedValueOnce({ ...base, entries: [] });
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    fireEvent.click(await screen.findByRole("row", { name: /已确认.*784/ }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择下钻维度" }));
    fireEvent.click(await screen.findByText("product_code"));
    fireEvent.click(screen.getByRole("button", { name: "继续下钻" }));
    fireEvent.click(await screen.findByRole("row", { name: /382-000005.*40/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "按此值筛选" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "按此值筛选" }));
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(3));

    const path = await screen.findByRole("navigation", { name: "分析路径" });
    await waitFor(() => {
      expect(within(path).getByRole("button", { name: "status: 已确认" })).toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("region", { name: "图表与数据" })).getByRole("navigation", {
        name: "分析路径",
      }),
    ).toBe(path);
    expect(within(path).getByText("当前").parentElement).toHaveTextContent(
      "product_code: 382-000005",
    );
    expect(within(path).getByText("当前").parentElement).not.toHaveTextContent("status");
  }, 20_000);

  it("shows only populated result columns for grouped identity data", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          dimensions: { status: "执行中", order_id: "U00-000170" },
          status: "ok",
          value: 1,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    expect(await screen.findByRole("columnheader", { name: "status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "order_id" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "维度" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "指标值" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "实例 ID" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "时间（UTC）" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "结果状态" })).not.toBeInTheDocument();
  });

  it("shows each structured analysis dimension in its own result column", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          dimension_cells: [
            { ref: { object_type_id: "order", property_name: "status" }, value: "已确认" },
            { ref: { object_type_id: "order", property_name: "product_code" }, value: "P-001" },
          ],
          status: "ok",
          value: 21,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);
    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    expect(await screen.findByRole("columnheader", { name: "status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "product_code" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /已确认.*P-001.*21/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "维度" })).not.toBeInTheDocument();
  });

  it("keeps a related dimension's technical name when it matches an owner property", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.calculation_scope = "object_set";
    definition.query_capabilities.analysis_dimensions = [
      { object_type_id: "coupon", property_name: "status" },
    ];
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          dimensions: { status: "可用" },
          instance_identity: { status: "已支付" },
          status: "ok",
          value: 1,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={
          {
            id: "order",
            dataProperties: [{ displayName: "订单状态", name: "status" }],
            logicProperties: [],
            primaryKeys: [],
          } as unknown as ObjectTypeDetail
        }
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    expect(await screen.findByRole("columnheader", { name: "status" })).toBeInTheDocument();
    expect(screen.getByText("可用")).toBeInTheDocument();
    expect(screen.getByText("订单状态: 已支付")).toBeInTheDocument();
    expect(screen.queryByText("订单状态: 可用")).not.toBeInTheDocument();
    expect(screen.getByTestId("analysis-labels")).toHaveAttribute(
      "data-identity-labels",
      '{"status":"订单状态"}',
    );
    expect(screen.getByTestId("analysis-labels")).toHaveAttribute("data-property-labels", "{}");
  });

  it("uses business names in dimension choices and results but sends technical names to the API", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单数";
    definition.calculation_scope = "object_set";
    definition.query_capabilities.analysis_dimensions = [
      { object_type_id: "order", property_name: "status" },
    ];
    const onRun = vi.fn().mockResolvedValue({
      entries: [
        {
          dimensions: { status: "已支付" },
          instance_identity: { order_id: 1001 },
          status: "ok",
          value: 1,
        },
      ],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "grouped",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "ok",
    } satisfies ObjectMetricDataV1);

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={
          {
            id: "order",
            dataProperties: [
              { displayName: "订单主键", name: "order_id" },
              { displayName: "订单状态", name: "status" },
            ],
            logicProperties: [],
            primaryKeys: ["order_id"],
          } as unknown as ObjectTypeDetail
        }
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    const dimensionSelect = document.querySelector(".ant-drawer-body .ant-select-selector");
    expect(dimensionSelect).not.toBeNull();
    fireEvent.mouseDown(dimensionSelect!);
    fireEvent.click(await screen.findByText("订单状态"));
    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        group_by: [{ object_type_id: "order", property_name: "status" }],
        instance_identities: undefined,
        time: undefined,
      }),
    );
    expect(await screen.findByRole("columnheader", { name: "订单状态" })).toBeInTheDocument();
    expect(screen.getByText("已支付")).toBeInTheDocument();
    expect(screen.getByText("订单主键: 1001")).toBeInTheDocument();
    expect(screen.getByText("耗时 1 ms")).toBeInTheDocument();
    expect(document.querySelector(".ant-alert-success")).toBeNull();
    expect(screen.getByText("计算成功")).toBeInTheDocument();
    expect(screen.queryByText(/status: 已支付|order_id: 1001/)).not.toBeInTheDocument();
  });

  it("runs an unpublished definition with the entered instance identity", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单支付额";
    definition.calculation_scope = "object_instance";
    const result: ObjectMetricDataV1 = {
      entries: [],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "object_value",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 3,
      status: "no_data",
    };
    const onRun = vi.fn().mockResolvedValue(result);

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={
          {
            dataProperties: [{ displayName: "订单主键", name: "order_id", type: "int64" }],
            primaryKeys: ["order_id"],
          } as ObjectTypeDetail
        }
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    expect(screen.queryByText("读取真实数据；试算不会保存或修改指标。")).not.toBeInTheDocument();
    expect(screen.getByText("试算 · 订单支付额")).toBeInTheDocument();
    expect(screen.getByText("试算条件")).toBeInTheDocument();
    expect(screen.getByText("设置试算条件并点击试算，即可查看指标结果。")).toBeInTheDocument();
    const runButton = screen.getByRole("button", { name: "试算" });
    expect(
      screen.getByRole("heading", { name: "试算条件" }).parentElement?.parentElement,
    ).toContainElement(runButton);
    expect(screen.getByRole("dialog").closest(".ant-drawer")?.className).toContain(
      "analysisDrawer",
    );
    expect(screen.queryByText("按分析维度拆解（可选）")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "结果筛选" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "结果排序" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("订单主键"), {
      target: { value: "1001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        group_by: [],
        instance_identities: [{ order_id: 1001 }],
        time: undefined,
      }),
    );
    expect(await screen.findByText("无数据")).toBeInTheDocument();
    expect(screen.getByText("分析结果")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "指标值" })).not.toBeInTheDocument();
  });

  it("trials a draft derived metric and keeps its fixed time window immutable", () => {
    const definition = createObjectMetricDefinitionV1("derived", "order");
    definition.name = "本季度订单支付额";
    definition.calculation_scope = "object_instance";
    if (definition.specification.kind !== "derived") throw new Error("expected derived metric");
    definition.specification.business_qualifiers.time_window = {
      end_at: 1_800_000_000_000,
      mode: "fixed_range",
      start_at: 1_700_000_000_000,
      timezone: "UTC",
    };

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={
          {
            dataProperties: [{ displayName: "订单主键", name: "order_id", type: "int64" }],
            primaryKeys: ["order_id"],
          } as ObjectTypeDetail
        }
        onClose={vi.fn()}
        onRun={vi.fn()}
        open
      />,
    );

    expect(screen.queryByText("读取真实数据；试算不会保存或修改指标。")).not.toBeInTheDocument();
    expect(screen.getByText("本次试算使用当前配置中的固定时间范围")).toBeInTheDocument();
    expect(screen.queryByText("查询时间范围（可选）")).not.toBeInTheDocument();
  });

  it("only offers a runtime date range when its event-time dimension is unambiguous", () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    const props = {
      definition,
      mode: "draft" as const,
      onClose: vi.fn(),
      onRun: vi.fn(),
      open: true,
    };
    const { rerender } = render(<ObjectMetricTrialDrawer {...props} />);
    expect(screen.queryByText("查询时间范围（可选）")).not.toBeInTheDocument();
    expect(
      screen.getByText("指标未开放可查询时间维度，本次分析不按时间范围筛选。"),
    ).toBeInTheDocument();

    definition.query_capabilities.time_dimensions = [
      { object_type_id: "order", property_name: "signed_at" },
    ];
    rerender(<ObjectMetricTrialDrawer {...props} />);
    expect(screen.getByText("查询时间范围（可选）")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("开始日期时间")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("结束日期时间")).toBeInTheDocument();

    definition.query_capabilities.time_dimensions.push({
      object_type_id: "order",
      property_name: "created_at",
    });
    rerender(<ObjectMetricTrialDrawer {...props} />);
    expect(screen.queryByText("查询时间范围（可选）")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "指标开放了多个时间属性，无法确定查询时间范围作用于哪一个；请在下一版本中只保留一个。",
      ),
    ).toBeInTheDocument();
  });

  it("builds a complete composite identity and converts each primary-key type", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "shipment");
    definition.name = "包裹金额";
    definition.calculation_scope = "object_instance";
    const onRun = vi.fn().mockResolvedValue({
      entries: [],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "object_value",
        owner_object_type_id: "shipment",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 1,
      status: "no_data",
    } satisfies ObjectMetricDataV1);

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={
          {
            dataProperties: [
              { displayName: "批次", name: "batch_id", type: "int64" },
              { displayName: "是否拆分", name: "split", type: "boolean" },
            ],
            primaryKeys: ["batch_id", "split"],
          } as ObjectTypeDetail
        }
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    fireEvent.change(screen.getByLabelText("批次"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("是否拆分"), {
      target: { value: "false" },
    });
    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        group_by: [],
        instance_identities: [{ batch_id: 42, split: false }],
        time: undefined,
      }),
    );
  });

  it("shows partial execution warnings without presenting them as a successful complete result", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单总额";
    definition.calculation_scope = "object_set";
    const onRun = vi.fn().mockResolvedValue({
      entries: [{ status: "ok", value: 660 }],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "summary",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 12,
      status: "partial",
      warnings: ["结果达到最大行数，仅返回部分数据"],
    } satisfies ObjectMetricDataV1);

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={null}
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    expect(await screen.findByText("部分结果")).toBeInTheDocument();
    expect(screen.getByText("结果达到最大行数，仅返回部分数据")).toBeInTheDocument();
    expect(screen.getByText("耗时 12 ms")).toBeInTheDocument();
  });

  it("renders time-series entry timestamps in UTC", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "季度订单数";
    definition.calculation_scope = "object_set";
    const onRun = vi.fn().mockResolvedValue({
      entries: [{ status: "ok", time: Date.parse("2021-01-01T00:00:00Z"), value: 124 }],
      model: {
        metric_id: "trial",
        name: definition.name,
        output_shape: "summary",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: 0,
      },
      overall_ms: 8,
      status: "ok",
    } satisfies ObjectMetricDataV1);

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={null}
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    expect(await screen.findByText("2021-01-01 00:00:00")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "时间（UTC）" })).toBeInTheDocument();
  });

  it("blocks an instance trial when the object type has no primary key", () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单金额";
    definition.calculation_scope = "object_instance";

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="draft"
        objectType={{ dataProperties: [], primaryKeys: [] } as unknown as ObjectTypeDetail}
        onClose={vi.fn()}
        onRun={vi.fn()}
        open
      />,
    );

    expect(screen.getByText("对象类尚未配置主键，无法定位单个实例")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "试算" })).toBeDisabled();
  });

  it("identifies the published version and keeps empty results distinct from zero", async () => {
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单支付额";
    definition.version = 5;
    definition.lifecycle.status = "published";
    const onRun = vi.fn().mockResolvedValue({
      entries: [],
      model: {
        metric_id: definition.id,
        name: definition.name,
        output_shape: "summary",
        owner_object_type_id: "order",
        value: definition.result_semantics.value,
        version: definition.version,
      },
      overall_ms: 4,
      status: "no_data",
    } satisfies ObjectMetricDataV1);

    render(
      <ObjectMetricTrialDrawer
        definition={definition}
        mode="published"
        onClose={vi.fn()}
        onRun={onRun}
        open
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "试算 · 订单支付额 已发布 · v5" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "试算" }));
    expect(await screen.findByText("无数据")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
