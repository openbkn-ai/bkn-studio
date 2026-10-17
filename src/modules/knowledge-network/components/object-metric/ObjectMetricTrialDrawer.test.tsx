/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import type { ObjectMetricDataV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricAnalysisPanel", () => ({
  ObjectMetricAnalysisPanel: ({
    identityLabels,
    propertyLabels,
  }: {
    identityLabels: Record<string, string>;
    propertyLabels: Record<string, string>;
  }) => (
    <div
      data-testid="analysis-labels"
      data-identity-labels={JSON.stringify(identityLabels)}
      data-property-labels={JSON.stringify(propertyLabels)}
    />
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
    expect(await screen.findByText("status: 可用")).toBeInTheDocument();
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
        analysis_dimensions: [{ object_type_id: "order", property_name: "status" }],
        instance_identities: undefined,
        time: undefined,
      }),
    );
    expect(await screen.findByText("订单状态: 已支付")).toBeInTheDocument();
    expect(screen.getByText("订单主键: 1001")).toBeInTheDocument();
    expect(screen.getByText("耗时 1 ms")).toBeInTheDocument();
    expect(document.querySelector(".ant-alert-success")).toBeNull();
    expect(screen.getByRole("cell", { name: "计算成功" })).toBeInTheDocument();
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
    expect(screen.queryByText("按分析维度拆解（可选）")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("订单主键"), {
      target: { value: "1001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        analysis_dimensions: [],
        instance_identities: [{ order_id: 1001 }],
        time: undefined,
      }),
    );
    expect(await screen.findByText("无数据")).toBeInTheDocument();
    expect(screen.getByText("试算结果")).toBeInTheDocument();
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
        analysis_dimensions: [],
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
