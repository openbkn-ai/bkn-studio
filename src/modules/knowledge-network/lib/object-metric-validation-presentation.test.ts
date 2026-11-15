/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";

import { presentObjectMetricValidationIssue } from "@/modules/knowledge-network/lib/object-metric-validation-presentation";

describe("object metric validation presentation", () => {
  it("turns a numeric aggregation type error into business guidance", () => {
    const presentation = presentObjectMetricValidationIssue(
      {
        code: "aggregation_input_type_invalid",
        field: "specification.measure.expression",
        message: "sum and average require a numeric measure expression",
      },
      { aggregation: "sum" },
    );

    expect(presentation).toEqual({
      location: "取值表达式",
      problem: "“求和”只能计算数值或时长，但当前取值表达式返回了其他类型。",
      suggestion: "请选择数值或时长属性；如果源字段以文本存储，请先配置类型转换。",
    });
  });

  it("keeps unknown backend details collapsed behind a readable fallback", () => {
    const presentation = presentObjectMetricValidationIssue({
      code: "invalid_future_rule",
      field: "specification.future.internal_path",
      message: "internal validation detail",
    });

    expect(presentation.location).toBe("当前配置");
    expect(presentation.problem).not.toContain("specification.future.internal_path");
    expect(presentation.problem).not.toContain("internal validation detail");
    expect(presentation.technicalDetails).toEqual({
      code: "invalid_future_rule",
      field: "specification.future.internal_path",
      message: "internal validation detail",
    });
  });

  it("explains the exact amount and count conflict in an average-price formula", async () => {
    const issue = {
      code: "expression_unit_mismatch",
      field: "specification.expression",
      message: "addition, subtraction, and modulo require compatible units",
    };
    const context: NonNullable<Parameters<typeof presentObjectMetricValidationIssue>[1]> = {
      metricName: "商品销售均价",
      expression: {
        node_type: "binary",
        operator: "add",
        left: { node_type: "dependency", dependency_alias: "amount" },
        right: { node_type: "dependency", dependency_alias: "quantity" },
      },
      dependencies: {
        amount: {
          name: "实付总金额",
          value: {
            physical_type: "decimal",
            semantic_type: "amount",
            unit: { code: "CNY", quantity_kind: "currency", scale_factor: 1, system: "ISO_4217" },
          },
        },
        quantity: {
          name: "销售件数",
          value: {
            physical_type: "int64",
            semantic_type: "count",
            unit: {
              code: "piece",
              quantity_kind: "custom",
              scale_factor: 1,
              system: "registered",
            },
          },
        },
      },
    };
    const presentation = presentObjectMetricValidationIssue(issue, context);

    expect(presentation.problem).toBe("实付总金额与销售件数的单位不同，不能直接相加。");
    expect(presentation.detail).toContain("实付总金额（元 · CNY） + 销售件数（件 · piece）");
    expect(presentation.suggestion).toContain("实付总金额 ÷ 销售件数");
    expect(presentation.focusPath).toBe("specification.expression");

    try {
      await i18n.changeLanguage("en-US");
      expect(presentObjectMetricValidationIssue(issue, context).suggestion).toContain(
        "实付总金额 ÷ 销售件数",
      );
    } finally {
      await i18n.changeLanguage("zh-CN");
    }
  });

  it("locates a nested conflict and does not recommend division for unrelated metrics", () => {
    const presentation = presentObjectMetricValidationIssue(
      {
        code: "expression_unit_mismatch",
        field: "specification.expression.right",
        message: "incompatible units",
      },
      {
        metricName: "库存合计",
        expression: {
          node_type: "binary",
          operator: "multiply",
          left: { node_type: "literal", value_type: "int64", value: 2 },
          right: {
            node_type: "binary",
            operator: "add",
            left: { node_type: "dependency", dependency_alias: "amount" },
            right: { node_type: "dependency", dependency_alias: "quantity" },
          },
        },
        dependencies: {
          amount: {
            name: "金额",
            value: {
              physical_type: "decimal",
              semantic_type: "amount",
              unit: { code: "CNY", quantity_kind: "currency", scale_factor: 1, system: "ISO_4217" },
            },
          },
          quantity: {
            name: "件数",
            value: {
              physical_type: "int64",
              semantic_type: "count",
              unit: {
                code: "piece",
                quantity_kind: "custom",
                scale_factor: 1,
                system: "registered",
              },
            },
          },
        },
      },
    );

    expect(presentation.focusPath).toBe("specification.expression.right");
    expect(presentation.detail).toContain("金额（元 · CNY） + 件数（件 · piece）");
    expect(presentation.suggestion).not.toContain("÷");
  });

  it("keeps other known unit errors specific", () => {
    expect(
      presentObjectMetricValidationIssue({
        code: "function_argument_unit_mismatch",
        field: "specification.expression.right",
        message: "function arguments must have compatible units",
      }),
    ).toMatchObject({
      problem: "函数使用的参数单位不一致。",
      focusPath: "specification.expression.right",
    });
    expect(
      presentObjectMetricValidationIssue({
        code: "composite_result_unit_mismatch",
        field: "result_semantics.value.unit",
        message: "declared result unit does not match the expression",
      }).problem,
    ).toBe("公式结果单位与“结果与分析”中配置的单位不一致。");
  });

  it("explains why a derived metric needs a business qualifier", () => {
    expect(
      presentObjectMetricValidationIssue({
        code: "business_qualifier_required",
        field: "specification.business_qualifiers",
        message: "derived metrics require at least one business qualifier",
      }),
    ).toEqual({
      location: "业务限定",
      problem: "当前衍生对象指标与基础对象指标没有区别。",
      suggestion: "请至少增加当前实例条件、关联实例条件、时间范围、固定分组或时间粒度中的 1 项。",
    });
  });

  it("explains an invalid calendar time window with an actionable correction", () => {
    expect(
      presentObjectMetricValidationIssue({
        code: "calendar_window_invalid",
        field: "specification.business_qualifiers.time_window",
        message: "calendar window requires period and timezone",
      }),
    ).toEqual({
      location: "时间范围",
      problem: "时间范围缺少有效的自然周期。",
      suggestion: "请重新选择本周、本月、本季度或本年；系统会统一使用 UTC。",
    });
  });

  it("guides the user when a derived event time is unavailable", () => {
    expect(
      presentObjectMetricValidationIssue({
        code: "derived_event_time_not_in_base",
        field: "specification.business_qualifiers.event_time",
        message: "event time must be in base metric",
      }),
    ).toEqual({
      location: "事件时间属性",
      problem: "所选时间属性不在基础对象指标开放的时间范围内。",
      suggestion: "请重新选择时间属性，或先在基础原子对象指标中开放该时间属性。",
    });
  });

  it("explains how to complete an unfinished composite dependency", () => {
    expect(
      presentObjectMetricValidationIssue({
        code: "dependency_metric_required",
        field: "specification.dependencies[1].metric_ref",
        message: "a published dependency metric version is required",
      }),
    ).toEqual({
      location: "依赖对象指标",
      problem: "存在尚未选择对象指标的依赖项。",
      suggestion: "请选择一个已发布对象指标，或删除这条空依赖。",
    });
  });

  it("explains a stale composite formula reference", () => {
    expect(
      presentObjectMetricValidationIssue({
        code: "unknown_dependency_alias",
        field: "specification.expression",
        message: 'dependency alias "metric_2" is not declared',
      }),
    ).toEqual({
      location: "对象指标运算公式",
      problem: "公式引用了已经不存在的依赖对象指标。",
      suggestion: "请重新选择公式中的对象指标；如果刚删除过依赖，可重新生成公式。",
    });
  });

  it("explains that a same-grain dependency must not be rolled up again", () => {
    expect(
      presentObjectMetricValidationIssue({
        code: "rollup_aggregation_forbidden",
        field: "specification.dependencies[0].rollup_aggregation",
        message: "technical detail",
      }),
    ).toEqual({
      location: "依赖对象指标",
      problem: "该依赖已经与结果处于同一对象和粒度，不需要再次汇总。",
      suggestion: "请清除该依赖的汇总方式；同对象、同粒度场景由系统直接对齐。",
    });
  });
});
