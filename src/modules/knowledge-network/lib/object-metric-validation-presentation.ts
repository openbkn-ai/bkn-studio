/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricValidationIssueV1 } from "@/modules/knowledge-network/types/object-metric";

export type ObjectMetricValidationIssuePresentation = {
  location: string;
  problem: string;
  suggestion: string;
};

type PresentationContext = {
  aggregation?: string;
  calculationScope?: "object_instance" | "object_set";
};

const fieldLabels: ReadonlyArray<readonly [string, string]> = [
  ["specification.measure.expression", "取值表达式"],
  ["specification.measure.aggregation", "聚合方式"],
  ["specification.base_metric", "基础原子指标"],
  ["specification.expression", "指标运算公式"],
  ["specification.alignment.primary_dependency_alias", "主依赖指标"],
  ["specification.alignment.time_key", "结果时间属性"],
  ["specification.alignment", "结果对齐"],
  ["specification.dependencies", "依赖指标"],
  ["specification.business_qualifiers.event_time", "事件时间属性"],
  ["specification.business_qualifiers.relation_path", "关联实例条件"],
  ["specification.business_qualifiers.time_window", "时间范围"],
  ["specification.business_qualifiers", "业务限定"],
  ["result_semantics.value.physical_type", "结果数据类型"],
  ["result_semantics.value.semantic_type", "指标值类型"],
  ["result_semantics.value.unit", "单位"],
  ["result_semantics.no_data_policy", "无数据处理"],
  ["result_semantics.statistical_grain", "统计粒度"],
  ["query_capabilities.analysis_dimensions", "开放分析维度"],
  ["query_capabilities.time_dimensions", "可查询时间维度"],
  ["calculation_scope", "计算范围"],
  ["description", "业务定义"],
  ["name", "指标名称"],
  ["code", "指标编码"],
];

const aggregationLabels: Record<string, string> = {
  avg: "平均值",
  count: "非空值计数",
  count_distinct: "去重计数",
  count_rows: "计数",
  identity: "直接取值",
  max: "最大值",
  min: "最小值",
  sum: "求和",
};

function validationLocation(field: string) {
  return (
    fieldLabels.find(
      ([prefix]) =>
        field === prefix || field.startsWith(`${prefix}.`) || field.startsWith(`${prefix}[`),
    )?.[1] ?? "当前配置"
  );
}

function genericPresentation(
  issue: ObjectMetricValidationIssueV1,
): Omit<ObjectMetricValidationIssuePresentation, "location"> {
  if (issue.code.endsWith("_required")) {
    return {
      problem: "必填配置尚未完成",
      suggestion: "请补充该项配置后重新校验。",
    };
  }
  if (issue.code.includes("duplicate")) {
    return {
      problem: "存在重复配置",
      suggestion: "请删除重复项后重新校验。",
    };
  }
  if (issue.code.includes("mismatch")) {
    return {
      problem: "与其他配置不一致",
      suggestion: "请检查关联的计算范围、类型、单位或粒度设置。",
    };
  }
  if (issue.code.includes("forbidden") || issue.code.includes("not_allowed")) {
    return {
      problem: "不适用于当前指标配置",
      suggestion: "请移除该配置，或调整计算范围和指标类型。",
    };
  }
  if (issue.code.startsWith("invalid_")) {
    return {
      problem: "配置不符合指标规则",
      suggestion: "请检查该项的选择或填写内容后重新校验。",
    };
  }
  return {
    problem: "未通过指标规则校验",
    suggestion: "请检查该项配置；如果问题仍然存在，请联系管理员查看技术详情。",
  };
}

export function presentObjectMetricValidationIssue(
  issue: ObjectMetricValidationIssueV1,
  context: PresentationContext = {},
): ObjectMetricValidationIssuePresentation {
  const location = validationLocation(issue.field);

  switch (issue.code) {
    case "aggregation_input_type_invalid": {
      const aggregation = context.aggregation
        ? (aggregationLabels[context.aggregation] ?? "当前聚合方式")
        : "当前聚合方式";
      return {
        location,
        problem: `“${aggregation}”只能计算数值或时长，但当前取值表达式返回了其他类型。`,
        suggestion: "请选择数值或时长属性；如果源字段以文本存储，请先配置类型转换。",
      };
    }
    case "measure_expression_required":
    case "atomic_measure_property_required":
      return {
        location,
        problem: "尚未配置参与计算的对象属性。",
        suggestion: "请在计算逻辑中选择一个对象属性。",
      };
    case "atomic_result_type_mismatch":
    case "composite_result_type_mismatch":
    case "value_type_mismatch":
      return {
        location,
        problem: "结果数据类型与取值表达式的计算结果不一致。",
        suggestion: "请重新选择取值属性或计算方式，系统会自动更新结果数据类型。",
      };
    case "zero_no_data_policy_incompatible":
      return {
        location,
        problem: "当前结果类型不能在没有数据时返回 0。",
        suggestion: "请改为返回 null 或标记不可用。",
      };
    case "decimal_format_required":
    case "invalid_decimal_format":
      return {
        location,
        problem: "小数精度或保留位数配置不正确。",
        suggestion: "请展开“数值格式”，确认总位数不小于小数位数。",
      };
    case "semantic_unit_required":
    case "currency_unit_required":
    case "duration_unit_required":
    case "unit_code_required":
      return {
        location,
        problem: "当前指标值类型需要明确单位。",
        suggestion: "请填写与业务含义一致的标准单位，例如 CNY、%、min。",
      };
    case "fixed_dimension_not_analyzable":
      return {
        location,
        problem: "同一属性不能同时作为固定分组维度和开放分析维度。",
        suggestion: "请从其中一处移除该属性。",
      };
    case "base_metric_required":
      return {
        location,
        problem: "尚未选择基础原子指标。",
        suggestion: "请先选择当前对象类下一个已发布的原子指标版本。",
      };
    case "business_qualifier_required":
      return {
        location,
        problem: "当前衍生指标与基础指标没有区别。",
        suggestion:
          context.calculationScope === "object_instance"
            ? "请至少增加当前实例条件、关联实例条件或时间范围中的 1 项。"
            : "请至少增加当前实例条件、关联实例条件、时间范围、固定分组或时间粒度中的 1 项。",
      };
    case "event_time_required":
      return {
        location,
        problem: "时间口径缺少用于统计的时间属性。",
        suggestion: "请在时间范围中选择基础指标已开放的日期或日期时间属性。",
      };
    case "rolling_window_invalid":
      return {
        location,
        problem: "“最近一段时间”的长度或单位无效。",
        suggestion: "请填写大于 0 的整数，并重新选择分钟、小时、日、周、月、季度或年。",
      };
    case "calendar_window_invalid":
      return {
        location,
        problem: "时间范围缺少有效的自然周期。",
        suggestion: "请重新选择本周、本月、本季度或本年；系统会统一使用 UTC。",
      };
    case "week_start_required":
    case "invalid_week_start":
      return {
        location,
        problem: "按周统计时缺少每周起始日。",
        suggestion: "请重新选择按周时间范围；系统会统一按周一开始。",
      };
    case "fixed_window_invalid":
      return {
        location,
        problem: "指定日期区间的开始时间或结束时间无效。",
        suggestion: "请确保开始时间早于结束时间，然后重新选择日期区间。",
      };
    case "invalid_timezone":
      return {
        location,
        problem: "旧配置中的统计时区无法被服务端识别。",
        suggestion: "请重新选择一次时间范围；系统会将统计时区统一更新为 UTC。",
      };
    case "invalid_time_window":
      return {
        location,
        problem: "当前时间范围模式不受服务端支持。",
        suggestion: "请重新选择时间范围；如果仍然出现，请刷新页面以加载最新配置。",
      };
    case "unbounded_window_fields_forbidden":
    case "rolling_window_fields_forbidden":
    case "calendar_window_fields_forbidden":
    case "fixed_window_fields_forbidden":
      return {
        location,
        problem: "时间范围中混入了其他模式的旧配置。",
        suggestion: "请重新选择一次时间范围，系统会自动清理不适用的字段。",
      };
    case "derived_event_time_not_in_base":
      return {
        location,
        problem: "所选时间属性不在基础指标开放的时间范围内。",
        suggestion: "请重新选择时间属性，或先在基础原子指标中开放该时间属性。",
      };
    case "derived_analysis_capability_not_in_base":
      return {
        location,
        problem: "所选分析维度未由基础指标开放。",
        suggestion: "请删除该维度，或先在基础原子指标中开放该分析维度。",
      };
    case "derived_time_capability_not_in_base":
      return {
        location,
        problem: "所选可查询时间维度未由基础指标开放。",
        suggestion: "请删除该时间维度，或先在基础原子指标中开放它。",
      };
    case "derived_value_semantics_mismatch":
      return {
        location,
        problem: "指标值类型或单位与基础指标不一致。",
        suggestion: "请重新选择基础指标，系统会自动恢复其指标值类型和单位。",
      };
    case "derived_scope_mismatch":
      return {
        location,
        problem: "计算范围与基础指标不一致。",
        suggestion: "请重新选择基础指标，系统会自动恢复其计算范围。",
      };
    case "composite_dependencies_required":
      return {
        location,
        problem: "复合指标至少需要 2 个依赖指标。",
        suggestion: "请在计算逻辑中继续添加并选择依赖指标。",
      };
    case "dependency_metric_required":
      return {
        location,
        problem: "存在尚未选择指标的依赖项。",
        suggestion: "请选择一个已发布指标，或删除这条空依赖。",
      };
    case "dependency_alias_required":
      return {
        location,
        problem: "公式符号不能为空。",
        suggestion: "请为每个依赖保留一个公式符号，例如 metric_1。",
      };
    case "dependency_alias_duplicate":
      return {
        location,
        problem: "多个依赖使用了相同的公式符号。",
        suggestion: "请把公式符号改成互不重复的名称。",
      };
    case "dependency_not_referenced":
      return {
        location,
        problem: "有依赖指标没有参与公式计算。",
        suggestion: "请在公式中使用该指标，或删除不需要的依赖。",
      };
    case "unknown_dependency_alias":
      return {
        location,
        problem: "公式引用了已经不存在的依赖指标。",
        suggestion: "请重新选择公式中的指标；如果刚删除过依赖，可重新生成公式。",
      };
    case "rollup_aggregation_required":
      return {
        location,
        problem: "该依赖需要先汇总到复合指标的对象或统计粒度。",
        suggestion: "请展开对应依赖的“高级依赖设置”，选择求和、平均值等汇总方式。",
      };
    case "rollup_aggregation_forbidden":
      return {
        location,
        problem: "该依赖已经与结果处于同一对象和粒度，不需要再次汇总。",
        suggestion: "请清除该依赖的汇总方式；同对象、同粒度场景由系统直接对齐。",
      };
    case "instance_related_set_alignment_forbidden":
      return {
        location,
        problem: "单个实例结果不能直接对齐一组关联实例。",
        suggestion: "请改为对齐唯一关联实例，或将计算范围改为实例集合。",
      };
    case "related_dependency_time_series_unsupported":
      return {
        location,
        problem: "当前版本不能把跨对象依赖直接生成时间序列。",
        suggestion: "请移除结果时间粒度，或改用同一对象下的依赖指标。",
      };
    case "primary_dependency_required":
    case "primary_dependency_unknown":
      return {
        location,
        problem: "尚未明确要保留哪个依赖指标的全部实例。",
        suggestion: "请在高级结果对齐中重新选择主依赖指标。",
      };
    case "metric_dependency_cycle":
      return {
        location,
        problem: "当前依赖关系形成了循环，指标将无法确定计算顺序。",
        suggestion: "请移除直接或间接依赖当前指标的指标。",
      };
    default:
      return { location, ...genericPresentation(issue) };
  }
}
