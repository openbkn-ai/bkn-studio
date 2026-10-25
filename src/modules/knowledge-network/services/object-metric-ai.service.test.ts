/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { parseObjectMetricAiIntent } from "@/modules/knowledge-network/services/object-metric-ai.service";

describe("parseObjectMetricAiIntent", () => {
  it("解析模型直接返回的 JSON", () => {
    expect(
      parseObjectMetricAiIntent(
        JSON.stringify({
          atomic: { aggregation: "sum", property_name: "payment_amount" },
          calculation_scope: "object_set",
          name: "订单实付金额",
        }),
      ),
    ).toMatchObject({
      atomic: { aggregation: "sum", property_name: "payment_amount" },
      calculation_scope: "object_set",
      name: "订单实付金额",
    });
  });

  it("兼容带代码围栏的模型输出", () => {
    expect(parseObjectMetricAiIntent('```json\n{"name":"订单数量"}\n```')).toEqual({
      name: "订单数量",
    });
  });

  it("拒绝没有 JSON 对象的输出", () => {
    expect(() => parseObjectMetricAiIntent("无法生成配置")).toThrow(
      "AI 未返回可识别的对象指标配置",
    );
  });

  it("筛选条件缺少 left 时跳过条件并返回业务提示", () => {
    const result = parseObjectMetricAiIntent(
      JSON.stringify({
        derived: {
          filters: {
            comparison_operator: "eq",
            node_type: "predicate",
            right: [{ source: "literal", value: "completed", value_type: "string" }],
          },
        },
        description: "统计已完成订单金额",
        name: "已完成订单金额",
      }),
    );

    expect(result.name).toBe("已完成订单金额");
    expect(result.derived?.filters).toBeUndefined();
    expect(result.notes).toContain("业务筛选条件缺少属性或有效判断方式，已跳过");
  });

  it("跳过不存在的属性但保留其他合法字段", () => {
    const result = parseObjectMetricAiIntent(
      JSON.stringify({
        derived: {
          filters: {
            comparison_operator: "eq",
            left: {
              property_ref: { object_type_id: "order", property_name: "missing_status" },
              source: "property",
            },
            node_type: "predicate",
            right: [{ source: "literal", value: "completed", value_type: "string" }],
          },
        },
        name: "已完成订单金额",
      }),
      { allowedProperties: new Set(["order_status"]) },
    );

    expect(result.name).toBe("已完成订单金额");
    expect(result.derived?.filters).toBeUndefined();
    expect(result.notes).toContain("业务条件引用了不可用属性“missing_status”，已跳过");
  });

  it("不会将不存在的度量属性和事件时间应用到表单", () => {
    const result = parseObjectMetricAiIntent(
      JSON.stringify({
        atomic: { aggregation: "sum", property_name: "missing_amount" },
        derived: { event_time: "missing_time" },
      }),
      { allowedProperties: new Set(["payment_amount", "created_at"]) },
    );

    expect(result.atomic?.aggregation).toBe("sum");
    expect(result.atomic?.property_name).toBeUndefined();
    expect(result.derived?.event_time).toBeUndefined();
    expect(result.notes).toEqual([
      "AI 引用了不可用的属性“missing_amount”，已跳过",
      "AI 引用了不可用的属性“missing_time”，已跳过",
    ]);
  });

  it("条件数组中部分无效时保留有效条件", () => {
    const result = parseObjectMetricAiIntent(
      JSON.stringify({
        derived: {
          filters: [
            { comparison_operator: "eq", property_name: "order_status", value: "completed" },
            { comparison_operator: "eq", value: "offline" },
          ],
        },
      }),
      { allowedProperties: new Set(["order_status"]) },
    );

    expect(result.derived?.filters).toMatchObject({
      comparison_operator: "eq",
      left: {
        property_ref: { property_name: "order_status" },
        source: "property",
      },
      node_type: "predicate",
      right: [{ source: "literal", value: "completed" }],
    });
    expect(result.notes).toContain("业务筛选条件缺少属性或有效判断方式，已跳过");
  });

  it("缺少 filters 时不产生无关提示", () => {
    const result = parseObjectMetricAiIntent(
      JSON.stringify({ derived: { base_metric_id: "metric-1" }, name: "订单金额" }),
    );

    expect(result.notes ?? []).toEqual([]);
  });

  it("跳过模型返回的不支持枚举值，并提示用户", () => {
    const result = parseObjectMetricAiIntent(
      JSON.stringify({
        derived: { time_window_mode: "last_month", time_window_unit: "day" },
        name: "订单数",
        query: { time_granularity: "weekly" },
        result: { no_data_policy: "zero", physical_type: "number" },
      }),
    );

    expect(result.derived?.time_window_mode).toBeUndefined();
    expect(result.derived?.time_window_unit).toBe("day");
    expect(result.query?.time_granularity).toBeUndefined();
    expect(result.result?.physical_type).toBeUndefined();
    expect(result.result?.no_data_policy).toBe("zero");
    expect(result.notes).toEqual([
      "AI 返回的 derived.time_window_mode 值“last_month”不受支持，已跳过",
      "AI 返回的 result.physical_type 值“number”不受支持，已跳过",
      "AI 返回的 query.time_granularity 值“weekly”不受支持，已跳过",
    ]);
  });
});
