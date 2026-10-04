/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  LeftOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Result,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { ObjectMetricConditionBuilder } from "@/modules/knowledge-network/components/object-metric/ObjectMetricConditionBuilder";
import { AtomicInstanceExpressionBuilder } from "@/modules/knowledge-network/components/object-metric/AtomicInstanceExpressionBuilder";
import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import {
  ObjectMetricExpressionEditor,
  type ObjectMetricExpressionPropertyOption,
} from "@/modules/knowledge-network/components/object-metric/ObjectMetricExpressionEditor";
import {
  createObjectMetricDefinitionV1,
  expressionLabel,
  expressionReferencesProperty,
  inferCompositeExpressionValueV1,
  replaceObjectMetricDependencyAliases,
} from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import {
  expressionValueType,
  normalizeExpressionValueType,
  type ExpressionValueType,
} from "@/modules/knowledge-network/components/object-metric/object-metric-expression-registry";
import { objectMetricQueryCapabilities } from "@/modules/knowledge-network/lib/object-metric-query-capabilities";
import { presentObjectMetricValidationIssue } from "@/modules/knowledge-network/lib/object-metric-validation-presentation";
import { availableRelationTypesFrom } from "@/modules/knowledge-network/lib/object-metric-relation-path";
import {
  buildObjectMetricTimeWindow,
  DEFAULT_OBJECT_METRIC_TIMEZONE,
  objectMetricTimeWindowBusinessLabel,
  objectMetricTimeWindowPeriod,
  objectMetricTimeWindowSelection,
  type ObjectMetricTimeWindowSelection,
} from "@/modules/knowledge-network/lib/object-metric-time-window";
import {
  objectMetricUnitOptions,
  objectMetricUnitSelectionLocked,
  type ObjectMetricUnitQuantityKind,
} from "@/modules/knowledge-network/lib/object-metric-unit-catalog";
import { objectMetricFormErrorCount } from "@/modules/knowledge-network/lib/object-metric-form-validation";
import {
  createObjectMetricDraftV1,
  getObjectMetricCapabilitiesV1,
  getKnowledgeNetworkMetricDependencyProperties,
  getObjectMetricV1,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
  listObjectMetricsV1,
  previewObjectMetricV1,
  publishObjectMetricV1,
  trialObjectMetricDataV1,
  updateObjectMetricDraftV1,
  validateObjectMetricV1,
  validateObjectMetricVersionV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import type {
  ObjectMetricConditionV1,
  ObjectMetricCapabilitiesV1,
  ObjectMetricDefinitionV1,
  ObjectMetricDependencyV1,
  ObjectMetricExpressionV1,
  ObjectMetricObjectAlignmentV1,
  ObjectMetricOperandV1,
  ObjectMetricPreviewV1,
  ObjectMetricPropertyRefV1,
  ObjectMetricRecordV1,
  ObjectMetricRelationStepV1,
  ObjectMetricTypeV1,
  ObjectMetricValidationResultV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectMetricFormScene.module.css";

type UnitQuantityKind = ObjectMetricUnitQuantityKind;

const timeUnitOptions = [
  { label: "分钟", value: "minute" },
  { label: "小时", value: "hour" },
  { label: "日", value: "day" },
  { label: "周", value: "week" },
  { label: "月", value: "month" },
  { label: "季度", value: "quarter" },
  { label: "年", value: "year" },
] as const;

const defaultMetricTimezone = DEFAULT_OBJECT_METRIC_TIMEZONE;

const rollingTimeUnitLabels: Record<NonNullable<FormValues["timeWindowUnit"]>, string> = {
  day: "天",
  hour: "小时",
  minute: "分钟",
  month: "个月",
  quarter: "个季度",
  week: "周",
  year: "年",
};

const physicalTypeOptions = [
  { label: "整数", value: "int64" },
  { label: "小数", value: "decimal" },
  { label: "布尔值", value: "boolean" },
  { label: "文本", value: "string" },
  { label: "日期", value: "date" },
  { label: "日期时间", value: "datetime" },
  { label: "持续时长", value: "duration" },
] as const;

const roundingModeLabels: Record<NonNullable<FormValues["roundingMode"]>, string> = {
  ceiling: "向上取整",
  floor: "向下取整",
  half_even: "银行家舍入",
  half_up: "四舍五入",
  truncate: "直接截断",
};

const physicalTypesBySemanticType: Record<
  ObjectMetricDefinitionV1["result_semantics"]["value"]["semantic_type"],
  ReadonlyArray<ObjectMetricDefinitionV1["result_semantics"]["value"]["physical_type"]>
> = {
  amount: ["decimal"],
  boolean: ["boolean"],
  category: ["string"],
  count: ["int64", "decimal"],
  date: ["date"],
  duration: ["duration"],
  measure: ["int64", "decimal", "duration"],
  percentage: ["decimal"],
  rank: ["int64"],
  ratio: ["decimal"],
  score: ["decimal"],
  timestamp: ["datetime"],
};

function supportsUnit(physicalType?: FormValues["physicalType"]) {
  return physicalType === "int64" || physicalType === "decimal" || physicalType === "duration";
}

function expressionWithDeclaredPropertyTypes(
  expression: ObjectMetricExpressionV1,
  properties: ObjectMetricExpressionPropertyOption[],
): ObjectMetricExpressionV1 {
  if (expression.node_type === "property") {
    const property = properties.find(
      (item) =>
        item.objectTypeId === expression.property_ref.object_type_id &&
        item.propertyName === expression.property_ref.property_name,
    );
    return {
      ...expression,
      value_type: property?.propertyType
        ? normalizeExpressionValueType(property.propertyType)
        : expression.value_type,
    };
  }
  if (expression.node_type === "call") {
    return {
      ...expression,
      arguments: expression.arguments.map((argument) =>
        expressionWithDeclaredPropertyTypes(argument, properties),
      ),
    };
  }
  if (expression.node_type === "unary") {
    return {
      ...expression,
      left: expressionWithDeclaredPropertyTypes(expression.left, properties),
    };
  }
  if (expression.node_type === "binary") {
    return {
      ...expression,
      left: expressionWithDeclaredPropertyTypes(expression.left, properties),
      right: expressionWithDeclaredPropertyTypes(expression.right, properties),
    };
  }
  return expression;
}

type FormValues = {
  aggregation:
    "identity" | "count_rows" | "count" | "count_distinct" | "sum" | "avg" | "min" | "max";
  analysisDimensions: string[];
  alignmentTimeKey?: string;
  baseMetric: string;
  calculationScope: "object_instance" | "object_set";
  code: string;
  description: string;
  eventTime?: string;
  fixedTimeRange?: [Dayjs, Dayjs];
  groupByDimensions: string[];
  grainPolicy?: "same_grain" | "rollup";
  grainWeekStart?: "monday" | "sunday";
  maximum?: number;
  minimum?: number;
  logicPropertyComment?: string;
  logicPropertyDisplayName?: string;
  logicPropertyEnabled?: boolean;
  logicPropertyName?: string;
  name: string;
  noDataPolicy: "zero" | "null" | "unavailable";
  primaryDependencyAlias?: string;
  physicalType: ObjectMetricDefinitionV1["result_semantics"]["value"]["physical_type"];
  precision?: number;
  quantityKind?: UnitQuantityKind;
  relationCountComparison?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  relationCountThreshold?: number;
  relationQuantifier?: "exists" | "not_exists" | "all" | "all_nonempty" | "count_compare";
  resultSetPolicy?: "intersection" | "preserve_primary_dependency";
  roundingMode?: "half_up" | "half_even" | "floor" | "ceiling" | "truncate";
  scale?: number;
  semanticType: ObjectMetricDefinitionV1["result_semantics"]["value"]["semantic_type"];
  timeDimensions: string[];
  timeAlignment?: "same_time_window" | "explicit_rollup";
  timeGranularity?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  timeWindowLength?: number;
  timeWindowMode?: ObjectMetricTimeWindowSelection;
  timeWindowUnit?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  timezone?: string;
  weekStart?: "monday" | "sunday";
  unitCode?: string;
  unitScaleFactor?: number;
  unitDenominatorCode?: string;
  unitDenominatorKind?: Exclude<UnitQuantityKind, "rate">;
  unitDenominatorSystem?: "UCUM" | "ISO_4217" | "registered";
  unitNumeratorCode?: string;
  unitNumeratorKind?: Exclude<UnitQuantityKind, "rate">;
  unitNumeratorSystem?: "UCUM" | "ISO_4217" | "registered";
  unitSystem?: "UCUM" | "ISO_4217" | "registered";
  nullPolicy?: "propagate" | "coalesce_zero";
  zeroDivisionPolicy?: "unavailable" | "null" | "zero";
};

const semanticTypeOptions: Array<{ label: string; value: FormValues["semanticType"] }> = [
  { label: "度量值", value: "measure" },
  { label: "计数", value: "count" },
  { label: "金额", value: "amount" },
  { label: "比率", value: "ratio" },
  { label: "百分比", value: "percentage" },
  { label: "评分", value: "score" },
  { label: "排名", value: "rank" },
  { label: "时间点", value: "timestamp" },
  { label: "时长", value: "duration" },
  { label: "日期", value: "date" },
  { label: "分类值", value: "category" },
  { label: "布尔值", value: "boolean" },
];

const calculationScopeLabels: Record<FormValues["calculationScope"], string> = {
  object_instance: "单个实例",
  object_set: "实例集合",
};

const metricTypeLabels: Record<ObjectMetricTypeV1, string> = {
  atomic: "原子指标",
  composite: "复合指标",
  derived: "衍生指标",
};

const metricLifecycleStatusLabels: Record<ObjectMetricDefinitionV1["lifecycle"]["status"], string> =
  {
    deprecated: "已停用",
    draft: "草稿",
    published: "已发布",
    validated: "已校验",
  };

const aggregationLabels: Record<FormValues["aggregation"], string> = {
  avg: "平均值",
  count: "非空计数",
  count_distinct: "去重计数",
  count_rows: "计数",
  identity: "直接取值",
  max: "最大值",
  min: "最小值",
  sum: "求和",
};

const atomicAggregationGuidance: Record<FormValues["aggregation"], string> = {
  avg: "选择一个数值属性，返回全部实例该属性的平均值。",
  count: "选择一个属性，只统计该属性有值的实例数量。",
  count_distinct: "选择一个属性，统计该属性不同取值的数量。",
  count_rows: "统计当前查询范围内的全部实例数量，不需要选择属性。",
  identity: "每个实例直接返回所选属性或简单计算的结果。",
  max: "选择一个属性，返回全部实例中该属性的最大值。",
  min: "选择一个属性，返回全部实例中该属性的最小值。",
  sum: "选择一个数值属性，返回全部实例该属性的合计值。",
};

const comparisonLabels: Record<
  Extract<ObjectMetricConditionV1, { node_type: "predicate" }>["comparison_operator"],
  string
> = {
  after: "晚于",
  after_or_equal: "不早于",
  before: "早于",
  before_or_equal: "不晚于",
  between: "介于",
  contains: "包含",
  ends_with: "结尾是",
  eq: "等于",
  gt: "大于",
  gte: "大于等于",
  in: "属于",
  is_empty: "为空",
  is_false: "为假",
  is_not_empty: "不为空",
  is_not_null: "不是空值",
  is_null: "是空值",
  is_true: "为真",
  lt: "小于",
  lte: "小于等于",
  neq: "不等于",
  not_between: "不介于",
  not_contains: "不包含",
  not_in: "不属于",
  starts_with: "开头是",
};

const relationQuantifierLabels: Record<NonNullable<FormValues["relationQuantifier"]>, string> = {
  all: "全部满足条件",
  all_nonempty: "至少存在 1 个且全部满足条件",
  count_compare: "关联数量满足条件",
  exists: "至少存在 1 个满足条件的关联实例",
  not_exists: "不存在满足条件的关联实例",
};

function isGeneratedMetricCode(code: string) {
  return /^m_[a-z0-9]{20,}$/i.test(code.trim());
}

function conditionSummary(
  condition: ObjectMetricConditionV1,
  propertyOptions: ObjectMetricExpressionPropertyOption[],
): string {
  if (condition.node_type === "group") {
    const children = condition.children.map((child) => conditionSummary(child, propertyOptions));
    if (condition.boolean_operator === "not") return `不满足（${children.join(" 且 ")}）`;
    return children.join(condition.boolean_operator === "and" ? " 且 " : " 或 ");
  }
  const operandLabel = (operand: ObjectMetricOperandV1) => {
    if (operand.source === "property") {
      return (
        propertyOptions.find(
          (item) =>
            item.objectTypeId === operand.property_ref.object_type_id &&
            item.propertyName === operand.property_ref.property_name,
        )?.label ?? operand.property_ref.property_name
      );
    }
    if (operand.value === "" || operand.value === undefined || operand.value === null) {
      return "未填写值";
    }
    return typeof operand.value === "string" ? `“${operand.value}”` : String(operand.value);
  };
  const right = condition.right?.map(operandLabel).join("、");
  return [operandLabel(condition.left), comparisonLabels[condition.comparison_operator], right]
    .filter(Boolean)
    .join(" ");
}

function conditionIsComplete(condition?: ObjectMetricConditionV1): boolean {
  if (!condition) return false;
  if (condition.node_type === "group") {
    return condition.children.length > 0 && condition.children.every(conditionIsComplete);
  }
  if (condition.left.source !== "property" || !condition.left.property_ref.property_name.trim()) {
    return false;
  }
  if (
    ["is_empty", "is_not_empty", "is_null", "is_not_null", "is_true", "is_false"].includes(
      condition.comparison_operator,
    )
  ) {
    return true;
  }
  return Boolean(
    condition.right?.length &&
    condition.right.every((operand) =>
      operand.source === "property"
        ? Boolean(operand.property_ref.property_name.trim())
        : operand.value !== "" && operand.value !== undefined && operand.value !== null,
    ),
  );
}

function instanceValueSuggestion(
  expression: ObjectMetricExpressionV1,
  properties: ObjectMetricExpressionPropertyOption[],
  aggregation: FormValues["aggregation"] = "identity",
): Partial<FormValues> | undefined {
  if (aggregation === "count_rows" || aggregation === "count" || aggregation === "count_distinct") {
    return {
      noDataPolicy: "zero",
      physicalType: "int64",
      quantityKind: "count",
      semanticType: "count",
      unitCode: "1",
      unitScaleFactor: 1,
      unitSystem: "UCUM",
    };
  }
  const propertyType =
    aggregation === "avg" ? "decimal" : expressionValueType(expression, properties);
  if (!propertyType) return undefined;

  return valueSuggestionForPhysicalType(propertyType);
}

function valueSuggestionForPhysicalType(
  propertyType: ExpressionValueType,
): Partial<FormValues> | undefined {
  const withoutUnit = {
    quantityKind: undefined,
    unitCode: undefined,
    unitScaleFactor: undefined,
    unitSystem: undefined,
  };
  if (propertyType === "string") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "string",
      semanticType: "category",
    };
  }
  if (propertyType === "boolean") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "boolean",
      semanticType: "boolean",
    };
  }
  if (propertyType === "date") {
    return { ...withoutUnit, noDataPolicy: "null", physicalType: "date", semanticType: "date" };
  }
  if (propertyType === "datetime") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "datetime",
      semanticType: "timestamp",
    };
  }
  if (propertyType === "duration") {
    return {
      noDataPolicy: "null",
      physicalType: "duration",
      quantityKind: "duration",
      semanticType: "duration",
      unitCode: undefined,
      unitScaleFactor: undefined,
      unitSystem: undefined,
    };
  }
  if (propertyType === "int64") {
    return { ...withoutUnit, noDataPolicy: "null", physicalType: "int64", semanticType: "measure" };
  }
  if (propertyType === "decimal") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "decimal",
      precision: 18,
      roundingMode: "half_up",
      scale: 2,
      semanticType: "measure",
    };
  }
  return undefined;
}

function parseMetricType(value: string | null): ObjectMetricTypeV1 {
  return value === "derived" || value === "composite" ? value : "atomic";
}

function initialFormValues(metricType: ObjectMetricTypeV1): Partial<FormValues> {
  const isAtomic = metricType === "atomic";
  return {
    aggregation: "count_rows",
    analysisDimensions: [],
    calculationScope: "object_set",
    code: "",
    description: "",
    grainPolicy: "same_grain",
    groupByDimensions: [],
    logicPropertyEnabled: false,
    name: "",
    noDataPolicy: "zero",
    nullPolicy: "propagate",
    physicalType: isAtomic ? "int64" : "decimal",
    precision: isAtomic ? undefined : 18,
    quantityKind: isAtomic ? "count" : undefined,
    resultSetPolicy: "intersection",
    roundingMode: isAtomic ? undefined : "half_up",
    scale: isAtomic ? undefined : 2,
    semanticType: isAtomic ? "count" : "measure",
    timeAlignment: "same_time_window",
    timeDimensions: [],
    timeWindowMode: metricType === "derived" ? "unbounded" : undefined,
    unitCode: isAtomic ? "1" : undefined,
    unitScaleFactor: 1,
    unitSystem: isAtomic ? "UCUM" : undefined,
    zeroDivisionPolicy: "unavailable",
  };
}

function propertyRef(ownerObjectTypeId: string, propertyName: string): ObjectMetricPropertyRefV1 {
  return { object_type_id: ownerObjectTypeId, property_name: propertyName };
}

function propertyName(ref?: ObjectMetricPropertyRefV1) {
  return ref?.property_name;
}

function dependencyKey(metricId: string, version: number) {
  return `${metricId}@${version}`;
}

function parseDependencyKey(value?: string) {
  const [metric_id = "", version = "1"] = (value ?? "").split("@");
  return { metric_id, version: Number(version) || 1 };
}

function renameDependencyAlias(
  expression: ObjectMetricExpressionV1,
  previous: string,
  next: string,
): ObjectMetricExpressionV1 {
  if (expression.node_type === "dependency") {
    return expression.dependency_alias === previous
      ? { ...expression, dependency_alias: next }
      : expression;
  }
  if (expression.node_type === "binary") {
    return {
      ...expression,
      left: renameDependencyAlias(expression.left, previous, next),
      right: renameDependencyAlias(expression.right, previous, next),
    };
  }
  if (expression.node_type === "unary") {
    return { ...expression, left: renameDependencyAlias(expression.left, previous, next) };
  }
  if (expression.node_type === "call") {
    return {
      ...expression,
      arguments: expression.arguments.map((item) => renameDependencyAlias(item, previous, next)),
    };
  }
  return expression;
}

function expressionReferencesDependencyAlias(
  expression: ObjectMetricExpressionV1,
  alias: string,
): boolean {
  if (expression.node_type === "dependency") return expression.dependency_alias === alias;
  if (expression.node_type === "binary") {
    return (
      expressionReferencesDependencyAlias(expression.left, alias) ||
      expressionReferencesDependencyAlias(expression.right, alias)
    );
  }
  if (expression.node_type === "unary") {
    return expressionReferencesDependencyAlias(expression.left, alias);
  }
  if (expression.node_type === "call") {
    return expression.arguments.some((item) => expressionReferencesDependencyAlias(item, alias));
  }
  return false;
}

function defaultCompositeExpression(
  dependencies: ObjectMetricDependencyV1[],
): ObjectMetricExpressionV1 {
  if (dependencies.length < 2) {
    return { node_type: "literal", value: 0, value_type: "decimal" };
  }
  return {
    left: { dependency_alias: dependencies[0].alias, node_type: "dependency" },
    node_type: "binary",
    operator: "add",
    right: { dependency_alias: dependencies[1].alias, node_type: "dependency" },
  };
}

function dependencyFilterContext(
  mode: "inherit" | "remove_dimension_filter",
  current: ObjectMetricDependencyV1["evaluation_context"]["filter_context"],
  ownerObjectTypeId: string,
  defaultPropertyName: string,
): ObjectMetricDependencyV1["evaluation_context"]["filter_context"] {
  if (mode === "inherit") return { mode };
  return {
    dimension:
      "dimension" in current
        ? current.dimension
        : propertyRef(ownerObjectTypeId, defaultPropertyName),
    mode,
  };
}

function formValuesFromDefinition(definition: ObjectMetricDefinitionV1): Partial<FormValues> {
  const value = definition.result_semantics.value;
  const grain = definition.result_semantics.statistical_grain;
  const common: Partial<FormValues> = {
    analysisDimensions: definition.query_capabilities.analysis_dimensions.map(
      (item) => item.property_name,
    ),
    calculationScope: definition.calculation_scope,
    code: definition.code,
    description: definition.description,
    groupByDimensions: grain.group_by_dimensions.map((item) => item.property_name),
    grainWeekStart: grain.week_start,
    maximum: value.maximum,
    minimum: value.minimum,
    logicPropertyComment: definition.logic_property?.comment,
    logicPropertyDisplayName: definition.logic_property?.display_name,
    logicPropertyEnabled: Boolean(definition.logic_property),
    logicPropertyName: definition.logic_property?.property_name,
    name: definition.name,
    noDataPolicy: definition.result_semantics.no_data_policy,
    physicalType: value.physical_type,
    precision: value.precision,
    quantityKind: value.unit?.quantity_kind,
    roundingMode: value.rounding_mode,
    scale: value.scale,
    semanticType: value.semantic_type,
    timeDimensions: definition.query_capabilities.time_dimensions.map((item) => item.property_name),
    timeGranularity: grain.time_granularity,
    unitCode: value.unit?.code,
    unitScaleFactor: value.unit?.scale_factor,
    unitDenominatorCode: value.unit?.denominator?.code,
    unitDenominatorKind: value.unit?.denominator?.quantity_kind as Exclude<
      UnitQuantityKind,
      "rate"
    >,
    unitDenominatorSystem: value.unit?.denominator?.system,
    unitNumeratorCode: value.unit?.numerator?.code,
    unitNumeratorKind: value.unit?.numerator?.quantity_kind as Exclude<UnitQuantityKind, "rate">,
    unitNumeratorSystem: value.unit?.numerator?.system,
    unitSystem: value.unit?.system,
  };
  if (definition.specification.kind === "atomic") {
    common.aggregation = definition.specification.measure.aggregation;
  }
  if (definition.specification.kind === "derived") {
    const qualifiers = definition.specification.business_qualifiers;
    common.baseMetric = dependencyKey(
      definition.specification.base_metric.metric_id,
      definition.specification.base_metric.version,
    );
    common.eventTime = propertyName(qualifiers.event_time);
    common.relationCountComparison = qualifiers.relation_path?.count_comparison;
    common.relationCountThreshold = qualifiers.relation_path?.count_threshold;
    common.relationQuantifier = qualifiers.relation_path?.quantifier;
    common.fixedTimeRange =
      qualifiers.time_window?.mode === "fixed_range"
        ? [dayjs(qualifiers.time_window.start_at), dayjs(qualifiers.time_window.end_at)]
        : undefined;
    common.timeWindowLength =
      qualifiers.time_window?.mode === "rolling" ? qualifiers.time_window.length : undefined;
    common.timeWindowMode = objectMetricTimeWindowSelection(qualifiers.time_window) ?? "unbounded";
    common.timeWindowUnit =
      qualifiers.time_window?.mode === "rolling"
        ? qualifiers.time_window.unit
        : qualifiers.time_window?.mode === "calendar_period" ||
            qualifiers.time_window?.mode === "period_to_date"
          ? qualifiers.time_window.period
          : undefined;
    common.timezone =
      qualifiers.time_window?.mode === "rolling"
        ? qualifiers.time_window.timezone
        : qualifiers.time_window?.mode === "calendar_period" ||
            qualifiers.time_window?.mode === "period_to_date" ||
            qualifiers.time_window?.mode === "fixed_range"
          ? qualifiers.time_window.timezone
          : undefined;
    common.weekStart =
      qualifiers.time_window?.mode === "calendar_period" ||
      qualifiers.time_window?.mode === "period_to_date"
        ? qualifiers.time_window.week_start
        : undefined;
  }
  if (definition.specification.kind === "composite") {
    common.alignmentTimeKey = propertyName(definition.specification.alignment.time_key);
    common.grainPolicy = definition.specification.alignment.grain_policy;
    common.primaryDependencyAlias = definition.specification.alignment.primary_dependency_alias;
    common.resultSetPolicy = definition.specification.alignment.result_set_policy;
    common.timeAlignment = definition.specification.alignment.time_alignment;
    common.nullPolicy = definition.specification.null_policy;
    common.zeroDivisionPolicy = definition.specification.zero_division_policy;
  }
  return common;
}

function Section({
  children,
  title,
  tooltip,
}: {
  children: React.ReactNode;
  title: string;
  tooltip?: string;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <h2>{title}</h2>
        {tooltip ? <HelpTooltip label={title} title={tooltip} /> : null}
      </div>
      {children}
    </section>
  );
}

function HelpTooltip({ label, title }: { label: string; title: string }) {
  return (
    <Tooltip title={title}>
      <Button
        aria-label={`${label}说明`}
        className={styles.helpButton}
        icon={<QuestionCircleOutlined aria-hidden="true" />}
        size="small"
        type="text"
      />
    </Tooltip>
  );
}

export function ObjectMetricFormScene({ mode }: { mode: "create" | "edit" }) {
  const params = useParams<{ metricId: string; networkId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const networkId = params.networkId ?? "";
  const metricId = params.metricId;
  const requestedMetricType = parseMetricType(searchParams.get("metricType"));
  const requestedObjectTypeId = searchParams.get("objectTypeId") ?? "";
  const [form] = Form.useForm<FormValues>();
  const getFieldValue = <Key extends keyof FormValues>(name: Key): FormValues[Key] | undefined =>
    form.getFieldValue(name) as FormValues[Key] | undefined;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<ObjectMetricRecordV1>();
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [publishedMetrics, setPublishedMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [capabilities, setCapabilities] = useState<ObjectMetricCapabilitiesV1>();
  const [properties, setProperties] = useState<ObjectMetricExpressionPropertyOption[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [ownerObjectTypeDetail, setOwnerObjectTypeDetail] = useState<ObjectTypeDetail | null>();
  const [measureExpression, setMeasureExpression] = useState<ObjectMetricExpressionV1>({
    node_type: "literal",
    value: 0,
    value_type: "decimal",
  });
  const [atomicExpressionInteracted, setAtomicExpressionInteracted] = useState(false);
  const [businessCondition, setBusinessCondition] = useState<ObjectMetricConditionV1>();
  const [relatedCondition, setRelatedCondition] = useState<ObjectMetricConditionV1>();
  const [relationSteps, setRelationSteps] = useState<ObjectMetricRelationStepV1[]>([]);
  const [relatedProperties, setRelatedProperties] = useState<
    ObjectMetricExpressionPropertyOption[]
  >([]);
  const [dependencies, setDependencies] = useState<ObjectMetricDependencyV1[]>([]);
  const [compositeExpression, setCompositeExpression] = useState<ObjectMetricExpressionV1>({
    node_type: "literal",
    value: 0,
    value_type: "decimal",
  });
  const [formValidationIssueCount, setFormValidationIssueCount] = useState(0);
  const [validation, setValidation] = useState<ObjectMetricValidationResultV1>();
  const [preview, setPreview] = useState<ObjectMetricPreviewV1>();
  const [trialDefinition, setTrialDefinition] = useState<ObjectMetricDefinitionV1>();

  const definition = record?.definition;
  const metricType = definition?.metric_type ?? requestedMetricType;
  const ownerObjectTypeId = definition?.owner_object_type_id ?? requestedObjectTypeId;
  const ownerObjectType = objectTypes.find((item) => item.id === ownerObjectTypeId);
  const calculationScope = Form.useWatch("calculationScope", form);
  const aggregation = Form.useWatch("aggregation", form);
  const baseMetricKey = Form.useWatch("baseMetric", form);
  const timeGranularity = Form.useWatch("timeGranularity", form);
  const groupByDimensions = Form.useWatch("groupByDimensions", form);
  const logicPropertyEnabled = Form.useWatch("logicPropertyEnabled", form);
  const grainPolicy = Form.useWatch("grainPolicy", form);
  const relationCountComparison = Form.useWatch("relationCountComparison", form);
  const relationCountThreshold = Form.useWatch("relationCountThreshold", form);
  const relationQuantifier = Form.useWatch("relationQuantifier", form);
  const resultSetPolicy = Form.useWatch("resultSetPolicy", form);
  const eventTime = Form.useWatch("eventTime", form);
  const fixedTimeRange = Form.useWatch("fixedTimeRange", form);
  const timeWindowLength = Form.useWatch("timeWindowLength", form);
  const timeWindowMode = Form.useWatch("timeWindowMode", form);
  const timeWindowUnit = Form.useWatch("timeWindowUnit", form);
  const quantityKind = Form.useWatch("quantityKind", form);
  const physicalType = Form.useWatch("physicalType", form);
  const precision = Form.useWatch("precision", form);
  const roundingMode = Form.useWatch("roundingMode", form);
  const scale = Form.useWatch("scale", form);
  const semanticType = Form.useWatch("semanticType", form);
  const unitCode = Form.useWatch("unitCode", form);
  const unitScaleFactor = Form.useWatch("unitScaleFactor", form);
  const unitSystem = Form.useWatch("unitSystem", form);
  const hasCrossObjectDependency = dependencies.some(
    (dependency) => dependency.object_alignment.mode !== "same_object",
  );
  const clearUnsupportedCompositeTimeSeries = () => {
    form.setFieldsValue({
      alignmentTimeKey: undefined,
      grainWeekStart: undefined,
      timeGranularity: undefined,
    });
  };
  const outputShape =
    validation?.output_shape ??
    (calculationScope === "object_instance"
      ? "object_value"
      : timeGranularity
        ? "time_series"
        : (groupByDimensions?.length ?? 0) > 0
          ? "grouped"
          : "summary");
  // Older services may return `issues: null` for a successful validation. Treat it
  // as the empty collection so a server-side contract variation cannot crash the
  // authoring screen while a compatibility deployment is rolling out.
  const validationIssues = validation?.issues ?? [];
  const presentedValidationIssues = validationIssues.map((issue) =>
    presentObjectMetricValidationIssue(issue, { aggregation, calculationScope }),
  );
  const compatibleUnitOptions = objectMetricUnitOptions(semanticType, physicalType, {
    code: unitCode,
    quantityKind,
    scaleFactor: unitScaleFactor,
    system: unitSystem,
  });
  const unitSelectionLocked =
    objectMetricUnitSelectionLocked(semanticType) &&
    compatibleUnitOptions.length === 1 &&
    compatibleUnitOptions[0]?.code === unitCode;
  const requiresAtomicMeasureProperty =
    metricType === "atomic" && !(calculationScope === "object_set" && aggregation === "count_rows");
  const hasAtomicMeasureProperty = expressionReferencesProperty(measureExpression);
  const applyValueSuggestion = (
    suggestion: Partial<FormValues> | undefined,
    forceSemanticType = false,
  ) => {
    if (!suggestion?.physicalType) return;
    const currentPhysicalType = form.getFieldValue("physicalType") as
      FormValues["physicalType"] | undefined;
    const currentSemanticType = form.getFieldValue("semanticType") as
      FormValues["semanticType"] | undefined;
    const preservesCurrentContract =
      !forceSemanticType &&
      currentPhysicalType === suggestion.physicalType &&
      currentSemanticType &&
      physicalTypesBySemanticType[currentSemanticType].includes(suggestion.physicalType);
    if (preservesCurrentContract) {
      form.setFieldValue("physicalType", suggestion.physicalType);
      return;
    }
    form.setFieldsValue(suggestion);
  };
  const canBuildDefinition = () => {
    if (requiresAtomicMeasureProperty && !hasAtomicMeasureProperty) {
      void message.error("请在取值方式中至少选择一个对象属性");
      return false;
    }
    return true;
  };
  const updateMeasureExpression = (next: ObjectMetricExpressionV1) => {
    setMeasureExpression(next);
    if (metricType !== "atomic") return;
    const suggestion = instanceValueSuggestion(next, properties, aggregation);
    applyValueSuggestion(
      suggestion,
      aggregation === "count_rows" || aggregation === "count" || aggregation === "count_distinct",
    );
  };

  const propertyOptions = properties.map((item) => ({
    label: item.label,
    value: item.propertyName,
  }));
  const selectedBaseMetric = publishedMetrics.find(
    (item) =>
      dependencyKey(item.definition.id, item.definition.version) === baseMetricKey &&
      item.definition.metric_type === "atomic",
  );
  const compatibleAtomicMetrics = publishedMetrics.filter(
    (item) =>
      item.definition.lifecycle.status === "published" &&
      item.definition.metric_type === "atomic" &&
      item.definition.owner_object_type_id === ownerObjectTypeId,
  );
  const selectBaseMetric = (key: string) => {
    const base = compatibleAtomicMetrics.find(
      (item) => dependencyKey(item.definition.id, item.definition.version) === key,
    );
    if (!base) return;
    const previousKey = baseMetricKey;
    const value = base.definition.result_semantics.value;
    setBusinessCondition(undefined);
    setRelatedCondition(undefined);
    setRelationSteps([]);
    setValidation(undefined);
    setPreview(undefined);
    form.setFieldsValue({
      analysisDimensions: [],
      calculationScope: base.definition.calculation_scope,
      eventTime: undefined,
      fixedTimeRange: undefined,
      grainWeekStart: undefined,
      groupByDimensions: [],
      maximum: value.maximum,
      minimum: value.minimum,
      noDataPolicy: base.definition.result_semantics.no_data_policy,
      physicalType: value.physical_type,
      precision: value.precision,
      quantityKind: value.unit?.quantity_kind,
      relationCountComparison: undefined,
      relationCountThreshold: undefined,
      relationQuantifier: undefined,
      roundingMode: value.rounding_mode,
      scale: value.scale,
      semanticType: value.semantic_type,
      timeDimensions: [],
      timeGranularity: undefined,
      timeWindowLength: undefined,
      timeWindowMode: "unbounded",
      timeWindowUnit: undefined,
      timezone: undefined,
      unitCode: value.unit?.code,
      unitDenominatorCode: value.unit?.denominator?.code,
      unitDenominatorKind: value.unit?.denominator?.quantity_kind as Exclude<
        UnitQuantityKind,
        "rate"
      >,
      unitDenominatorSystem: value.unit?.denominator?.system,
      unitNumeratorCode: value.unit?.numerator?.code,
      unitNumeratorKind: value.unit?.numerator?.quantity_kind as Exclude<UnitQuantityKind, "rate">,
      unitNumeratorSystem: value.unit?.numerator?.system,
      unitScaleFactor: value.unit?.scale_factor,
      unitSystem: value.unit?.system,
      weekStart: undefined,
    });
    if (previousKey && previousKey !== key) {
      void message.info("已切换基础指标，原有业务限定和结果粒度已清空，请重新配置");
    }
  };
  const updateCompositeExpression = (next: ObjectMetricExpressionV1) => {
    setCompositeExpression(next);
    const dependencyTypes = Object.fromEntries(
      dependencies.flatMap((dependency) => {
        const selected = publishedMetrics.find(
          (item) =>
            item.definition.id === dependency.metric_ref.metric_id &&
            item.definition.version === dependency.metric_ref.version,
        );
        return selected
          ? [[dependency.alias, selected.definition.result_semantics.value.physical_type] as const]
          : [];
      }),
    ) as Record<string, ExpressionValueType>;
    const nextPhysicalType = expressionValueType(next, [], dependencyTypes);
    if (nextPhysicalType) applyValueSuggestion(valueSuggestionForPhysicalType(nextPhysicalType));
  };
  const derivedAnalysisNames = new Set(
    selectedBaseMetric?.definition.query_capabilities.analysis_dimensions.map(
      (item) => item.property_name,
    ) ?? [],
  );
  const derivedTimeNames = new Set(
    selectedBaseMetric?.definition.query_capabilities.time_dimensions.map(
      (item) => item.property_name,
    ) ?? [],
  );
  const resultPropertyOptions =
    metricType === "derived"
      ? propertyOptions.filter((item) => derivedAnalysisNames.has(item.value))
      : propertyOptions;
  const fixedGroupBy = new Set(groupByDimensions ?? []);
  const analysisPropertyOptions = resultPropertyOptions.filter(
    (item) => !fixedGroupBy.has(item.value),
  );
  const timePropertyOptions = properties
    .filter(
      (item) =>
        ["date", "datetime", "timestamp"].includes(item.propertyType ?? "") &&
        (metricType !== "derived" || derivedTimeNames.has(item.propertyName)),
    )
    .map((item) => ({ label: item.label, value: item.propertyName }));
  const selectedBaseDefinition = selectedBaseMetric?.definition;
  const selectedBaseAggregation =
    selectedBaseDefinition?.specification.kind === "atomic"
      ? selectedBaseDefinition.specification.measure.aggregation
      : undefined;
  const selectedBaseValue = selectedBaseDefinition?.result_semantics.value;
  const effectiveCalculationScope =
    metricType === "derived"
      ? (selectedBaseDefinition?.calculation_scope ?? calculationScope)
      : calculationScope;
  const canConfigureFixedResultGrain =
    metricType === "composite"
      ? calculationScope !== "object_instance"
      : metricType === "derived" && selectedBaseDefinition?.calculation_scope === "object_set";
  const relationPathLabel = relationSteps
    .map(
      (step) =>
        relationTypes.find((item) => item.id === step.relation_type_id)?.name ??
        step.relation_type_id,
    )
    .filter(Boolean)
    .join(" → ");
  const lastRelationStep = relationSteps.at(-1);
  const relationContinuationSourceObjectTypeId =
    lastRelationStep?.target_object_type_id || ownerObjectTypeId;
  const relationPreviousObjectTypeId = relationSteps.length
    ? relationSteps.length === 1
      ? ownerObjectTypeId
      : relationSteps.at(-2)?.target_object_type_id
    : undefined;
  const availableRelationContinuations = relationContinuationSourceObjectTypeId
    ? availableRelationTypesFrom(
        relationTypes,
        relationContinuationSourceObjectTypeId,
        relationPreviousObjectTypeId,
        lastRelationStep?.relation_type_id,
      )
    : [];
  const canAddRelationStep = relationSteps.length
    ? Boolean(lastRelationStep?.target_object_type_id && availableRelationContinuations.length > 0)
    : availableRelationContinuations.length > 0;
  const timeWindowPeriod = objectMetricTimeWindowPeriod(timeWindowMode);
  const timeWindowOptions: Array<{ label: string; value: ObjectMetricTimeWindowSelection }> = [
    { label: "不固定时间（查询时选择）", value: "unbounded" },
    { label: "最近一段时间", value: "rolling" },
    { label: "本周", value: "current_week" },
    { label: "本月", value: "current_month" },
    { label: "本季度", value: "current_quarter" },
    { label: "本年", value: "current_year" },
    { label: "指定日期区间", value: "fixed_range" },
  ];
  if (timeWindowMode && (timeWindowMode.startsWith("full_") || timeWindowMode === "current_day")) {
    timeWindowOptions.push({
      label: `${objectMetricTimeWindowBusinessLabel(timeWindowMode) ?? "旧版时间范围"}（兼容已有指标）`,
      value: timeWindowMode,
    });
  }
  const timeWindowLabel = (() => {
    if (!timeWindowMode || timeWindowMode === "unbounded") return undefined;
    const timeProperty = timePropertyOptions.find((item) => item.value === eventTime)?.label;
    const prefix = timeProperty ? `按${timeProperty}` : "按所选事件时间";
    if (timeWindowMode === "rolling") {
      const rollingUnit = timeWindowUnit ? rollingTimeUnitLabels[timeWindowUnit] : "个周期";
      return `${prefix}统计最近${timeWindowLength ?? 30}${rollingUnit}`;
    }
    if (timeWindowMode === "fixed_range") {
      return fixedTimeRange?.[0] && fixedTimeRange[1]
        ? `${prefix}统计 ${fixedTimeRange[0].format("YYYY-MM-DD HH:mm")} 至 ${fixedTimeRange[1].format("YYYY-MM-DD HH:mm")}`
        : undefined;
    }
    const periodLabel = objectMetricTimeWindowBusinessLabel(timeWindowMode);
    return periodLabel ? `${prefix}统计${periodLabel}数据` : undefined;
  })();
  const hasCompleteBusinessCondition = conditionIsComplete(businessCondition);
  const hasCompleteRelationQualifier = Boolean(
    relationSteps.length > 0 &&
    relationSteps.every((step) => step.relation_type_id && step.target_object_type_id) &&
    relationQuantifier &&
    (relationQuantifier !== "count_compare" ||
      (relationCountComparison !== undefined && relationCountThreshold !== undefined)),
  );
  const hasLegacyRelationRule = Boolean(relationQuantifier && relationQuantifier !== "exists");
  const hasCompleteTimeWindow = Boolean(
    timeWindowMode &&
    timeWindowMode !== "unbounded" &&
    eventTime &&
    (timeWindowMode === "rolling"
      ? timeWindowLength && timeWindowUnit
      : timeWindowMode === "fixed_range"
        ? fixedTimeRange?.[0] &&
          fixedTimeRange[1] &&
          fixedTimeRange[0].valueOf() < fixedTimeRange[1].valueOf()
        : timeWindowPeriod),
  );
  const derivedQualifierSummaries = [
    hasCompleteBusinessCondition && businessCondition
      ? conditionSummary(businessCondition, properties)
      : undefined,
    hasCompleteRelationQualifier && relationQuantifier
      ? `${relationPathLabel || "关联路径"}：${
          relationQuantifier === "exists"
            ? relatedCondition
              ? "任一关联实例满足条件"
              : "存在关联实例"
            : relationQuantifierLabels[relationQuantifier]
        }`
      : undefined,
    hasCompleteTimeWindow ? timeWindowLabel : undefined,
    canConfigureFixedResultGrain && groupByDimensions?.length
      ? `固定按${groupByDimensions
          .map((name) => propertyOptions.find((item) => item.value === name)?.label ?? name)
          .join("、")}分组`
      : undefined,
    canConfigureFixedResultGrain && timeGranularity && eventTime
      ? `按${timeUnitOptions.find((item) => item.value === timeGranularity)?.label ?? timeGranularity}返回时间序列`
      : undefined,
  ].filter((item): item is string => Boolean(item));
  const hasDerivedQualifier = derivedQualifierSummaries.length > 0;
  const dependencyMetricOptionLabel = (record: ObjectMetricRecordV1) => {
    const definition = record.definition;
    const objectName =
      definition.owner_object_type_id === ownerObjectTypeId
        ? "当前对象"
        : (objectTypes.find((item) => item.id === definition.owner_object_type_id)?.name ??
          "关联对象");
    return `${definition.name} · v${definition.version} · ${metricTypeLabels[definition.metric_type]} · ${objectName} · ${metricLifecycleStatusLabels[definition.lifecycle.status]}`;
  };
  const publishedOptions = publishedMetrics
    .filter(
      ({ definition: item }) =>
        item.lifecycle.status === "published" &&
        (!calculationScope ||
          (item.owner_object_type_id === ownerObjectTypeId
            ? item.calculation_scope === calculationScope
            : item.calculation_scope === "object_instance")),
    )
    .map((record) => ({
      label: dependencyMetricOptionLabel(record),
      value: dependencyKey(record.definition.id, record.definition.version),
    }));
  const selectedDependencyMetric = (dependency: ObjectMetricDependencyV1) =>
    publishedMetrics.find(
      (item) =>
        item.definition.id === dependency.metric_ref.metric_id &&
        item.definition.version === dependency.metric_ref.version,
    );
  const publishedOptionKeys = new Set(publishedOptions.map((item) => item.value));
  const dependencyOptions = [
    ...publishedOptions,
    ...dependencies.flatMap((dependency) => {
      if (!dependency.metric_ref.metric_id) return [];
      const value = dependencyKey(dependency.metric_ref.metric_id, dependency.metric_ref.version);
      if (publishedOptionKeys.has(value)) return [];
      const selected = selectedDependencyMetric(dependency);
      return [
        {
          disabled: true,
          label: selected
            ? dependencyMetricOptionLabel(selected)
            : `依赖指标不可用 · v${dependency.metric_ref.version}（已删除、无权限或版本不存在）`,
          value,
        },
      ];
    }),
  ];
  const dependencyMetricLabels = Object.fromEntries(
    dependencies.flatMap((dependency) => {
      const selected = selectedDependencyMetric(dependency);
      return selected ? [[dependency.alias, selected.definition.name]] : [];
    }),
  );
  const compositeBusinessFormula = expressionLabel(
    replaceObjectMetricDependencyAliases(compositeExpression, dependencyMetricLabels),
  );
  const compositeAlignmentSummaries = dependencies.flatMap((dependency) => {
    const selected = selectedDependencyMetric(dependency);
    if (!selected) return [];
    const metricName = selected.definition.name;
    const objectName =
      objectTypes.find((item) => item.id === selected.definition.owner_object_type_id)?.name ??
      "关联对象";
    const objectAlignment =
      dependency.object_alignment.mode === "same_object"
        ? `${metricName}与结果属于同一对象，自动按实例身份对齐`
        : dependency.object_alignment.mode === "related_object_set"
          ? `${metricName}来自${objectName}集合，按关系路径汇总后参与计算`
          : `${metricName}来自${objectName}，按唯一关联实例对齐`;
    const windowAlignment =
      dependency.evaluation_context.window === "inherited"
        ? "使用当前查询时间范围"
        : dependency.evaluation_context.window === "rolling"
          ? "使用独立滚动时间范围"
          : "使用自然周期至今";
    return [`${objectAlignment}；${windowAlignment}`];
  });
  const dependencyAlignmentOptions = (
    dependency: ObjectMetricDependencyV1,
  ): Array<{ label: string; value: ObjectMetricObjectAlignmentV1["mode"] }> => {
    const selected = publishedMetrics.find(
      (item) =>
        item.definition.id === dependency.metric_ref.metric_id &&
        item.definition.version === dependency.metric_ref.version,
    );
    if (selected?.definition.owner_object_type_id === ownerObjectTypeId) {
      return [{ label: "同一对象", value: "same_object" as const }];
    }
    return calculationScope === "object_set"
      ? [
          { label: "关联对象集（汇总）", value: "related_object_set" as const },
          { label: "唯一关联对象", value: "related_object" as const },
        ]
      : [{ label: "唯一关联对象", value: "related_object" as const }];
  };

  useEffect(() => {
    if (!networkId) return;
    let active = true;
    if (mode === "create") {
      form.setFieldsValue(initialFormValues(requestedMetricType));
      if (requestedMetricType === "atomic") {
        setMeasureExpression({
          node_type: "property",
          property_ref: propertyRef(requestedObjectTypeId, ""),
        });
      }
    }
    void (async () => {
      setLoading(true);
      try {
        const [objects, relations, metrics, registry] = await Promise.all([
          listKnowledgeNetworkObjectTypes(networkId).catch(() => []),
          listKnowledgeNetworkRelationTypes(networkId).catch(() => []),
          listObjectMetricsV1(networkId, { limit: 500, status: "published" }).catch(() => ({
            entries: [],
            total_count: 0,
          })),
          getObjectMetricCapabilitiesV1().catch(() => undefined),
        ]);
        if (!active) return;
        setObjectTypes(objects);
        setRelationTypes(relations);
        setCapabilities(registry);
        let metricCatalog = metrics.entries;
        let nextRecord: ObjectMetricRecordV1 | undefined;
        if (mode === "edit" && metricId) {
          nextRecord = await getObjectMetricV1(networkId, metricId);
          if (["published", "deprecated"].includes(nextRecord.definition.lifecycle.status)) {
            void message.info("已发布版本不可直接修改，请从详情页明确创建新版本");
            void navigate(
              `/knowledge-network/workspace/${networkId}/metrics/${nextRecord.definition.id}/detail`,
              { replace: true },
            );
            return;
          }
          if (!active) return;
          setRecord(nextRecord);
          form.setFieldsValue(formValuesFromDefinition(nextRecord.definition));
          if (nextRecord.definition.specification.kind === "atomic") {
            setMeasureExpression(
              nextRecord.definition.specification.measure.expression ?? {
                node_type: "literal",
                value: 0,
                value_type: "decimal",
              },
            );
          } else if (nextRecord.definition.specification.kind === "derived") {
            setBusinessCondition(nextRecord.definition.specification.business_qualifiers.filters);
            setRelatedCondition(
              nextRecord.definition.specification.business_qualifiers.relation_path
                ?.related_filters,
            );
            setRelationSteps(
              nextRecord.definition.specification.business_qualifiers.relation_path?.steps ?? [],
            );
          } else {
            setDependencies(nextRecord.definition.specification.dependencies);
            setCompositeExpression(nextRecord.definition.specification.expression);
          }
        }
        if (nextRecord) {
          const specification = nextRecord.definition.specification;
          const referencedMetrics =
            specification.kind === "derived"
              ? [specification.base_metric]
              : specification.kind === "composite"
                ? specification.dependencies.map((item) => item.metric_ref)
                : [];
          const loadedKeys = new Set(
            metricCatalog.map((item) => dependencyKey(item.definition.id, item.definition.version)),
          );
          const missingReferences = referencedMetrics.filter(
            (reference, index, references) =>
              Boolean(reference.metric_id) &&
              !loadedKeys.has(dependencyKey(reference.metric_id, reference.version)) &&
              references.findIndex(
                (item) =>
                  item.metric_id === reference.metric_id && item.version === reference.version,
              ) === index,
          );
          const resolvedReferences = await Promise.all(
            missingReferences.map((reference) =>
              getObjectMetricV1(networkId, reference.metric_id, reference.version).catch(
                () => undefined,
              ),
            ),
          );
          metricCatalog = [
            ...metricCatalog,
            ...resolvedReferences.filter((item): item is ObjectMetricRecordV1 => Boolean(item)),
          ];
        }
        if (active) setPublishedMetrics(metricCatalog);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    form,
    message,
    metricId,
    mode,
    navigate,
    networkId,
    requestedMetricType,
    requestedObjectTypeId,
  ]);

  useEffect(() => {
    if (!networkId || !ownerObjectTypeId) return;
    let active = true;
    setPropertiesLoading(true);
    void (async () => {
      const [dependencyProperties, detail] = await Promise.all([
        getKnowledgeNetworkMetricDependencyProperties(networkId, ownerObjectTypeId).catch(() => []),
        getKnowledgeNetworkObjectTypeDetail(networkId, ownerObjectTypeId).catch(() => null),
      ]);
      const sourceProperties = dependencyProperties.length
        ? dependencyProperties
        : (detail?.dataProperties ?? []);
      const items = sourceProperties.map((item) => ({
        label: `${item.displayName || item.name} · ${item.name}`,
        objectTypeId: ownerObjectTypeId,
        propertyName: item.name,
        propertyType: item.type,
      }));
      if (!active) return;
      setProperties(items);
      setOwnerObjectTypeDetail(detail);
      setPropertiesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [networkId, ownerObjectTypeId]);

  useEffect(() => {
    if (
      metricType !== "composite" ||
      dependencies.length < 2 ||
      compositeExpression.node_type !== "literal"
    ) {
      return;
    }
    setCompositeExpression(defaultCompositeExpression(dependencies));
  }, [compositeExpression.node_type, dependencies, metricType]);

  useEffect(() => {
    if (metricType !== "composite") return;
    const dependencyValues = Object.fromEntries(
      dependencies.flatMap((dependency) => {
        const metric = publishedMetrics.find(
          (item) =>
            item.definition.id === dependency.metric_ref.metric_id &&
            item.definition.version === dependency.metric_ref.version,
        );
        return metric
          ? [[dependency.alias, metric.definition.result_semantics.value] as const]
          : [];
      }),
    );
    const inferred = inferCompositeExpressionValueV1(compositeExpression, dependencyValues);
    if (!inferred.physicalType) return;

    const currentSemanticType = form.getFieldValue("semanticType") as
      FormValues["semanticType"] | undefined;
    const inferredSemanticType = inferred.unit
      ? inferred.unit.quantity_kind === "count"
        ? "count"
        : inferred.unit.quantity_kind === "currency"
          ? "amount"
          : inferred.unit.quantity_kind === "duration"
            ? "duration"
            : currentSemanticType
      : inferred.unitKnown && inferred.physicalType === "decimal"
        ? "ratio"
        : currentSemanticType;
    const compatibleSemanticType =
      inferredSemanticType &&
      physicalTypesBySemanticType[inferredSemanticType].includes(inferred.physicalType)
        ? inferredSemanticType
        : "measure";
    const unit = inferred.unitKnown
      ? (inferred.unit ??
        (compatibleSemanticType === "ratio"
          ? {
              code: "1",
              quantity_kind: "dimensionless" as const,
              scale_factor: 1,
              system: "UCUM" as const,
            }
          : undefined))
      : undefined;
    form.setFieldsValue({
      physicalType: inferred.physicalType,
      precision: inferred.physicalType === "decimal" ? 18 : undefined,
      quantityKind: unit?.quantity_kind,
      roundingMode: inferred.physicalType === "decimal" ? "half_up" : undefined,
      scale: inferred.physicalType === "decimal" ? 2 : undefined,
      semanticType: compatibleSemanticType,
      unitCode: unit?.code,
      unitScaleFactor: unit?.scale_factor ?? 1,
      unitSystem: unit?.system,
    });
  }, [compositeExpression, dependencies, form, metricType, publishedMetrics]);

  useEffect(() => {
    if (metricType !== "derived" || !selectedBaseDefinition) return;
    const value = selectedBaseDefinition.result_semantics.value;
    form.setFieldsValue({
      calculationScope: selectedBaseDefinition.calculation_scope,
      maximum: value.maximum,
      minimum: value.minimum,
      physicalType: value.physical_type,
      precision: value.precision,
      quantityKind: value.unit?.quantity_kind,
      roundingMode: value.rounding_mode,
      scale: value.scale,
      semanticType: value.semantic_type,
      unitCode: value.unit?.code,
      unitDenominatorCode: value.unit?.denominator?.code,
      unitDenominatorKind: value.unit?.denominator?.quantity_kind as Exclude<
        UnitQuantityKind,
        "rate"
      >,
      unitDenominatorSystem: value.unit?.denominator?.system,
      unitNumeratorCode: value.unit?.numerator?.code,
      unitNumeratorKind: value.unit?.numerator?.quantity_kind as Exclude<UnitQuantityKind, "rate">,
      unitNumeratorSystem: value.unit?.numerator?.system,
      unitScaleFactor: value.unit?.scale_factor,
      unitSystem: value.unit?.system,
    });
  }, [form, metricType, selectedBaseDefinition]);

  useEffect(() => {
    if (relationSteps.length && !relationQuantifier) {
      form.setFieldValue("relationQuantifier", "exists");
    }
  }, [form, relationQuantifier, relationSteps.length]);

  useEffect(() => {
    if (metricType !== "derived" || calculationScope !== "object_instance") return;
    if (!timeGranularity && !(groupByDimensions?.length ?? 0)) return;
    form.setFieldsValue({
      eventTime: timeWindowMode && timeWindowMode !== "unbounded" ? eventTime : undefined,
      grainWeekStart: undefined,
      groupByDimensions: [],
      timeGranularity: undefined,
    });
    setValidation(undefined);
    setPreview(undefined);
  }, [
    calculationScope,
    eventTime,
    form,
    groupByDimensions,
    metricType,
    timeGranularity,
    timeWindowMode,
  ]);

  useEffect(() => {
    const relatedObjectTypeId = relationSteps.at(-1)?.target_object_type_id;
    if (!networkId || !relatedObjectTypeId) {
      setRelatedProperties([]);
      return;
    }
    let active = true;
    void getKnowledgeNetworkMetricDependencyProperties(networkId, relatedObjectTypeId).then(
      (items) => {
        if (!active) return;
        setRelatedProperties(
          items.map((item) => ({
            label: `${item.displayName || item.name} · ${item.name}`,
            objectTypeId: relatedObjectTypeId,
            propertyName: item.name,
            propertyType: item.type,
          })),
        );
      },
    );
    return () => {
      active = false;
    };
  }, [networkId, relationSteps]);

  const buildDefinition = async (): Promise<ObjectMetricDefinitionV1> => {
    const values = await form.validateFields();
    const next = structuredClone(
      record?.definition ?? createObjectMetricDefinitionV1(metricType, ownerObjectTypeId),
    );
    const inheritedDerivedScope =
      metricType === "derived" ? selectedBaseDefinition?.calculation_scope : undefined;
    const nextCalculationScope = inheritedDerivedScope ?? values.calculationScope;
    const supportsFixedResultGrain =
      metricType !== "atomic" && nextCalculationScope !== "object_instance";
    next.name = values.name.trim();
    next.code = values.code?.trim() ?? "";
    next.description = values.description.trim();
    next.calculation_scope = nextCalculationScope;
    next.result_semantics = {
      no_data_policy: values.noDataPolicy,
      // 第一版不向业务用户开放不完整结果。任何数据源或分区执行失败时，
      // 都拒绝返回可能被误认为完整统计值的部分结果。
      partial_data_policy: "reject",
      statistical_grain: {
        group_by_dimensions: supportsFixedResultGrain
          ? (values.groupByDimensions ?? []).map((name) => propertyRef(ownerObjectTypeId, name))
          : [],
        time_granularity: supportsFixedResultGrain ? values.timeGranularity : undefined,
        timezone:
          !supportsFixedResultGrain || !values.timeGranularity ? undefined : defaultMetricTimezone,
        week_start:
          !supportsFixedResultGrain || values.timeGranularity !== "week" ? undefined : "monday",
      },
      value:
        metricType === "derived" && selectedBaseValue
          ? structuredClone(selectedBaseValue)
          : {
              maximum: values.maximum,
              minimum: values.minimum,
              physical_type: values.physicalType,
              precision: values.physicalType === "decimal" ? values.precision : undefined,
              rounding_mode: values.physicalType === "decimal" ? values.roundingMode : undefined,
              scale: values.physicalType === "decimal" ? values.scale : undefined,
              semantic_type: values.semanticType,
              unit:
                values.unitCode && values.unitSystem && values.quantityKind
                  ? {
                      code: values.unitCode,
                      numerator:
                        values.quantityKind === "rate" &&
                        values.unitNumeratorCode &&
                        values.unitNumeratorKind &&
                        values.unitNumeratorSystem
                          ? {
                              code: values.unitNumeratorCode,
                              quantity_kind: values.unitNumeratorKind,
                              scale_factor: 1,
                              system: values.unitNumeratorSystem,
                            }
                          : undefined,
                      denominator:
                        values.quantityKind === "rate" &&
                        values.unitDenominatorCode &&
                        values.unitDenominatorKind &&
                        values.unitDenominatorSystem
                          ? {
                              code: values.unitDenominatorCode,
                              quantity_kind: values.unitDenominatorKind,
                              scale_factor: 1,
                              system: values.unitDenominatorSystem,
                            }
                          : undefined,
                      quantity_kind: values.quantityKind,
                      scale_factor: values.unitScaleFactor ?? 1,
                      system: values.unitSystem,
                    }
                  : undefined,
            },
    };
    next.query_capabilities = objectMetricQueryCapabilities(
      ownerObjectTypeId,
      values.analysisDimensions,
      values.timeDimensions,
    );
    next.logic_property =
      nextCalculationScope === "object_instance" && values.logicPropertyEnabled
        ? {
            comment: values.logicPropertyComment?.trim() || undefined,
            display_name: values.logicPropertyDisplayName?.trim() ?? "",
            property_name: values.logicPropertyName?.trim() ?? "",
          }
        : undefined;
    if (metricType === "atomic") {
      next.specification = {
        kind: "atomic",
        measure: {
          aggregation:
            values.calculationScope === "object_instance" ? "identity" : values.aggregation,
          expression:
            values.aggregation === "count_rows" && values.calculationScope === "object_set"
              ? undefined
              : expressionWithDeclaredPropertyTypes(measureExpression, properties),
        },
      };
    } else if (metricType === "derived") {
      const timeWindow = buildObjectMetricTimeWindow({
        endAt: values.fixedTimeRange?.[1].valueOf(),
        length: values.timeWindowLength,
        selection: values.timeWindowMode,
        startAt: values.fixedTimeRange?.[0].valueOf(),
        timezone: defaultMetricTimezone,
        unit: values.timeWindowUnit,
        weekStart: "monday",
      });
      next.specification = {
        base_metric: parseDependencyKey(values.baseMetric),
        business_qualifiers: {
          event_time:
            values.eventTime && (timeWindow || (supportsFixedResultGrain && values.timeGranularity))
              ? propertyRef(ownerObjectTypeId, values.eventTime)
              : undefined,
          filters: businessCondition,
          relation_path:
            relationSteps.length && values.relationQuantifier
              ? {
                  alias: "business_relation",
                  cardinality_policy: "distinct_root",
                  count_comparison:
                    values.relationQuantifier === "count_compare"
                      ? values.relationCountComparison
                      : undefined,
                  count_threshold:
                    values.relationQuantifier === "count_compare"
                      ? values.relationCountThreshold
                      : undefined,
                  purpose: "qualify_root",
                  quantifier: values.relationQuantifier,
                  related_filters: relatedCondition,
                  steps: relationSteps,
                }
              : undefined,
          time_window: timeWindow,
        },
        kind: "derived",
      };
    } else {
      next.specification = {
        alignment: {
          grain_policy: values.grainPolicy ?? "same_grain",
          group_by_dimensions: next.result_semantics.statistical_grain.group_by_dimensions,
          primary_dependency_alias:
            values.resultSetPolicy === "preserve_primary_dependency"
              ? values.primaryDependencyAlias
              : undefined,
          result_owner_object_type_id: ownerObjectTypeId,
          result_set_policy: values.resultSetPolicy ?? "intersection",
          time_alignment: values.timeAlignment ?? "same_time_window",
          time_key: values.alignmentTimeKey
            ? propertyRef(ownerObjectTypeId, values.alignmentTimeKey)
            : undefined,
        },
        dependencies: dependencies.map((dependency) => {
          const windowSpec = dependency.evaluation_context.window_spec;
          const normalizedWindowSpec = (() => {
            if (!windowSpec || windowSpec.mode === "unbounded") return windowSpec;
            if (windowSpec.mode === "rolling") {
              return { ...windowSpec, timezone: defaultMetricTimezone };
            }
            if (windowSpec.mode === "fixed_range") {
              return { ...windowSpec, timezone: defaultMetricTimezone };
            }
            return {
              ...windowSpec,
              timezone: defaultMetricTimezone,
              week_start: windowSpec.period === "week" ? ("monday" as const) : undefined,
            };
          })();
          return {
            ...dependency,
            evaluation_context: {
              ...dependency.evaluation_context,
              window_spec: normalizedWindowSpec,
            },
            rollup_aggregation:
              dependency.object_alignment.mode === "same_object" &&
              (values.grainPolicy ?? "same_grain") === "same_grain"
                ? undefined
                : dependency.rollup_aggregation,
          };
        }),
        expression: compositeExpression,
        kind: "composite",
        null_policy: values.nullPolicy ?? "propagate",
        zero_division_policy: values.zeroDivisionPolicy ?? "unavailable",
      };
    }
    return next;
  };

  const buildCompleteDefinition = async (): Promise<ObjectMetricDefinitionV1 | undefined> => {
    try {
      const next = await buildDefinition();
      setFormValidationIssueCount(0);
      return next;
    } catch (error) {
      const issueCount = objectMetricFormErrorCount(error);
      if (!issueCount) throw error;
      setFormValidationIssueCount(issueCount);
      setValidation(undefined);
      return undefined;
    }
  };

  const save = async () => {
    if (!canBuildDefinition()) return undefined;
    const next = await buildCompleteDefinition();
    if (!next) return undefined;
    setSaving(true);
    try {
      const saved = record
        ? await updateObjectMetricDraftV1(networkId, record.definition.id, next)
        : await createObjectMetricDraftV1(networkId, next);
      if (saved) {
        setRecord(saved);
        void message.success("草稿已保存");
        if (!record) {
          void navigate(
            `/knowledge-network/workspace/${networkId}/metrics/${saved.definition.id}/edit`,
            { replace: true },
          );
        }
      }
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const validate = async () => {
    if (!canBuildDefinition()) return;
    setValidation(undefined);
    const next = await buildCompleteDefinition();
    if (!next) return;
    const result = await validateObjectMetricV1(networkId, next);
    setValidation(result);
    if (!result.valid) return;
    const saved = record
      ? await updateObjectMetricDraftV1(networkId, record.definition.id, next)
      : await createObjectMetricDraftV1(networkId, next);
    if (!saved) return;
    const validated = await validateObjectMetricVersionV1(
      networkId,
      saved.definition.id,
      saved.definition.version,
    );
    if (validated) {
      setRecord(validated);
      form.setFieldsValue(formValuesFromDefinition(validated.definition));
      if (!record) {
        void navigate(
          `/knowledge-network/workspace/${networkId}/metrics/${validated.definition.id}/edit`,
          { replace: true },
        );
      }
    }
    void message.success("语义校验通过，当前版本已标记为已校验");
  };

  const openPreview = async () => {
    if (!canBuildDefinition()) return;
    const next = await buildCompleteDefinition();
    if (!next) return;
    setPreview(await previewObjectMetricV1(networkId, next));
  };

  const openTrial = async () => {
    if (!canBuildDefinition()) return;
    setValidation(undefined);
    const next = await buildCompleteDefinition();
    if (!next) return;
    const result = await validateObjectMetricV1(networkId, next);
    setValidation(result);
    if (!result.valid) return;
    setTrialDefinition(next);
  };

  const publish = async () => {
    setValidation(undefined);
    const saved = await save();
    if (!saved) return;
    const result = await validateObjectMetricV1(networkId, saved.definition);
    setValidation(result);
    if (!result.valid) return;
    const validated = await validateObjectMetricVersionV1(
      networkId,
      saved.definition.id,
      saved.definition.version,
    );
    await publishObjectMetricV1(
      networkId,
      validated?.definition.id ?? saved.definition.id,
      validated?.definition.version ?? saved.definition.version,
    );
    void message.success("指标已发布");
    void navigate(
      `/knowledge-network/workspace/${networkId}/metrics/${saved.definition.id}/detail`,
      { state: { justPublished: true } },
    );
  };

  if (loading)
    return (
      <div className={styles.page}>
        <Spin />
      </div>
    );
  if (!ownerObjectTypeId) {
    return (
      <Result
        status="warning"
        title="请先选择对象类"
        subTitle="指标必须从对象指标列表中的对象类上下文创建。"
        extra={
          <Button
            onClick={() => void navigate(`/knowledge-network/workspace/${networkId}/metrics`)}
            type="primary"
          >
            返回对象指标列表
          </Button>
        }
      />
    );
  }

  const metricTypeNames = { atomic: "原子指标", composite: "复合指标", derived: "衍生指标" };
  const ownerObjectName = ownerObjectType?.name ?? ownerObjectTypeId;
  const outputNames = {
    grouped: "分组结果",
    object_value: "每实例单值",
    summary: "汇总值",
    time_series: "时间序列",
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Button
          aria-label="返回对象指标列表"
          className={styles.backButton}
          icon={<LeftOutlined />}
          onClick={() => void navigate(`/knowledge-network/workspace/${networkId}/metrics`)}
          type="text"
        />
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>
            {record ? "编辑" : "新建"}
            {metricTypeNames[metricType]} · {ownerObjectName}
          </h1>
          <p className={styles.subtitle}>
            {metricType === "atomic"
              ? "定义可复用的基础事实，保存草稿并检查配置后发布。"
              : "按业务口径完成配置，保存草稿后校验发布。"}
          </p>
        </div>
      </header>
      <div className={styles.body}>
        <Form
          className={styles.form}
          form={form}
          layout="vertical"
          onValuesChange={() => {
            setFormValidationIssueCount(0);
            setValidation(undefined);
            setPreview(undefined);
          }}
        >
          <Section title="1. 基本信息">
            <div className={styles.grid2}>
              <Form.Item
                label="指标名称"
                name="name"
                rules={[{ required: true, message: "请输入指标名称" }]}
              >
                <Input
                  maxLength={128}
                  placeholder={
                    metricType === "atomic"
                      ? calculationScope === "object_instance"
                        ? "例如：每笔订单实付金额"
                        : "例如：订单总数或订单金额合计"
                      : "例如：已取消订单数"
                  }
                />
              </Form.Item>
              <Form.Item
                label="指标编码"
                name="code"
                rules={[
                  {
                    pattern: /^[a-z][a-z0-9_]*$/,
                    message: "使用小写字母、数字和下划线，并以字母开头",
                  },
                ]}
                tooltip={
                  metricType === "atomic"
                    ? "可选。用于系统集成、规则和逻辑属性引用；留空时由系统自动生成，创建后不可修改。"
                    : "用于接口、规则和逻辑属性的稳定引用。留空时由系统生成，创建后不可修改。"
                }
              >
                <Input
                  autoComplete="off"
                  disabled={Boolean(record)}
                  placeholder={
                    metricType === "atomic"
                      ? calculationScope === "object_instance"
                        ? "例如：order_paid_amount"
                        : "例如：order_count 或 order_amount_sum"
                      : "例如：cancelled_order_count"
                  }
                  spellCheck={false}
                />
              </Form.Item>
              <Form.Item
                className={styles.full}
                extra={
                  metricType === "atomic"
                    ? "原子指标只定义可复用的基础事实；状态、渠道、时间范围或关联对象等业务限定请在衍生指标中配置。"
                    : undefined
                }
                label="业务定义"
                name="description"
                rules={[{ required: true, message: "请说明这个指标表达的业务含义" }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder={
                    metricType === "atomic"
                      ? "说明取值来源、计算方式和结果含义；不要加入状态、渠道或时间范围等业务限定"
                      : "说明统计对象、业务口径和结果含义"
                  }
                />
              </Form.Item>
            </div>
          </Section>

          <Section
            title={metricType === "derived" ? "2. 选择基础指标" : "2. 计算范围"}
            tooltip={
              metricType === "derived"
                ? "衍生指标继承基础原子指标的计算范围、聚合方式、值类型和单位，只增加业务限定。"
                : undefined
            }
          >
            {metricType === "derived" ? (
              <>
                <Form.Item
                  label="基础原子指标"
                  name="baseMetric"
                  rules={[{ required: true, message: "请选择已发布原子指标" }]}
                >
                  <Select
                    notFoundContent={
                      compatibleAtomicMetrics.length
                        ? "没有找到匹配的指标"
                        : "当前对象类还没有已发布的原子指标"
                    }
                    onChange={selectBaseMetric}
                    optionFilterProp="label"
                    options={compatibleAtomicMetrics.map(({ definition: item }) => ({
                      label: `${item.name} · v${item.version}`,
                      value: dependencyKey(item.id, item.version),
                    }))}
                    placeholder="选择一个已发布的原子指标版本"
                    showSearch
                  />
                </Form.Item>
                <Form.Item hidden name="calculationScope">
                  <Input />
                </Form.Item>
                {!compatibleAtomicMetrics.length ? (
                  <Alert
                    description="请先在当前对象类下创建并发布原子指标，再返回创建衍生指标。"
                    message="没有可用的基础原子指标"
                    showIcon
                    type="info"
                  />
                ) : null}
                {selectedBaseDefinition && selectedBaseValue ? (
                  <div className={styles.inheritedContract}>
                    <div className={styles.inheritedContractHeader}>
                      <div>
                        <strong>{selectedBaseDefinition.name}</strong>
                        <span>已锁定发布版本 v{selectedBaseDefinition.version}</span>
                      </div>
                      {!isGeneratedMetricCode(selectedBaseDefinition.code) ? (
                        <Tag>{selectedBaseDefinition.code}</Tag>
                      ) : null}
                    </div>
                    <div className={styles.inheritedContractGrid}>
                      <div>
                        <span>计算范围</span>
                        <strong>
                          {calculationScopeLabels[selectedBaseDefinition.calculation_scope]}
                        </strong>
                      </div>
                      <div>
                        <span>基础计算</span>
                        <strong>
                          {selectedBaseAggregation
                            ? aggregationLabels[selectedBaseAggregation]
                            : "继承基础指标"}
                        </strong>
                      </div>
                      <div>
                        <span>指标值类型</span>
                        <strong>
                          {semanticTypeOptions.find(
                            (item) => item.value === selectedBaseValue.semantic_type,
                          )?.label ?? selectedBaseValue.semantic_type}
                        </strong>
                      </div>
                      <div>
                        <span>单位</span>
                        <strong>{selectedBaseValue.unit?.code ?? "无单位"}</strong>
                      </div>
                    </div>
                    <p>
                      {selectedBaseDefinition.calculation_scope === "object_instance"
                        ? "当前衍生指标只能增加业务条件和时间范围，不能修改以上基础计算。"
                        : "当前衍生指标可以增加业务条件、时间范围和结果粒度，不能修改以上基础计算。"}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <Form.Item
                  className={styles.scopeField}
                  label="实例范围"
                  name="calculationScope"
                  tooltip={
                    metricType === "atomic"
                      ? "选择“单个实例”时为每个实例返回一个值；选择“实例集合”时默认返回一个汇总值，并可开放查询时使用的分析维度和时间属性。"
                      : "选择“单个实例”时逐个计算，不进行聚合；选择“实例集合”时对一组实例进行聚合，并可进一步配置统计周期和分组维度。"
                  }
                >
                  <Radio.Group
                    className={styles.scopeGroup}
                    onChange={(event) => {
                      if (metricType === "composite") {
                        setDependencies((current) => {
                          const next: ObjectMetricDependencyV1[] = current.flatMap((dependency) => {
                            const selected = publishedMetrics.find(
                              (item) =>
                                item.definition.id === dependency.metric_ref.metric_id &&
                                item.definition.version === dependency.metric_ref.version,
                            );
                            if (!selected) return [];
                            const sameObject =
                              selected.definition.owner_object_type_id === ownerObjectTypeId;
                            if (
                              (sameObject &&
                                selected.definition.calculation_scope !== event.target.value) ||
                              (!sameObject &&
                                selected.definition.calculation_scope !== "object_instance")
                            ) {
                              return [];
                            }
                            const mode: ObjectMetricObjectAlignmentV1["mode"] = sameObject
                              ? "same_object"
                              : event.target.value === "object_set"
                                ? "related_object_set"
                                : "related_object";
                            return [
                              {
                                ...dependency,
                                object_alignment: {
                                  ...dependency.object_alignment,
                                  deduplication: sameObject ? "none" : "by_object_identity",
                                  mode,
                                  relation_path: sameObject
                                    ? undefined
                                    : dependency.object_alignment.relation_path,
                                  relationship_cardinality: sameObject
                                    ? undefined
                                    : mode === "related_object_set"
                                      ? "one_to_many"
                                      : "many_to_one",
                                },
                                rollup_aggregation:
                                  mode === "related_object_set" || grainPolicy === "rollup"
                                    ? (dependency.rollup_aggregation ?? "sum")
                                    : undefined,
                              },
                            ];
                          });
                          if (next.length !== current.length) {
                            setCompositeExpression(defaultCompositeExpression(next));
                            form.setFieldValue("primaryDependencyAlias", undefined);
                            void message.info(
                              `计算范围已切换，${current.length - next.length} 个不兼容的依赖指标已移除，公式已重新初始化`,
                            );
                          }
                          return next;
                        });
                      }
                      if (event.target.value === "object_instance") {
                        form.setFieldsValue({
                          alignmentTimeKey: undefined,
                          grainPolicy: "same_grain",
                          groupByDimensions: [],
                          noDataPolicy: "null",
                          timeAlignment: "same_time_window",
                          timeGranularity: undefined,
                        });
                      }
                      if (metricType === "atomic") setAtomicExpressionInteracted(false);
                      if (metricType === "atomic" && event.target.value === "object_instance") {
                        form.setFieldsValue({
                          aggregation: "identity",
                          physicalType: undefined,
                          precision: undefined,
                          quantityKind: undefined,
                          roundingMode: undefined,
                          scale: undefined,
                          semanticType: undefined,
                          unitCode: undefined,
                          unitScaleFactor: undefined,
                          unitSystem: undefined,
                        });
                        if (measureExpression.node_type === "literal") {
                          setMeasureExpression({
                            node_type: "property",
                            property_ref: propertyRef(ownerObjectTypeId, ""),
                          });
                        }
                      } else if (
                        metricType === "atomic" &&
                        form.getFieldValue("aggregation") === "identity"
                      ) {
                        form.setFieldValue("aggregation", "count_rows");
                        form.setFieldsValue({
                          physicalType: "int64",
                          quantityKind: "count",
                          semanticType: "count",
                          unitCode: "1",
                          unitSystem: "UCUM",
                        });
                      }
                    }}
                  >
                    <Radio className={styles.scopeOption} value="object_instance">
                      <span className={styles.scopeOptionContent}>
                        <strong className={styles.scopeOptionTitle}>单个实例</strong>
                        <span className={styles.scopeOptionDescription}>
                          对每个实例独立计算，结果按实例返回
                        </span>
                        <span className={styles.scopeOptionExample}>例如：每笔订单的实付金额</span>
                      </span>
                    </Radio>
                    <Radio className={styles.scopeOption} value="object_set">
                      <span className={styles.scopeOptionContent}>
                        <strong className={styles.scopeOptionTitle}>实例集合</strong>
                        <span className={styles.scopeOptionDescription}>
                          {metricType === "atomic"
                            ? "对一组实例进行聚合，默认返回一个汇总值"
                            : "对一组实例进行聚合，返回汇总、分组或时间序列结果"}
                        </span>
                        <span className={styles.scopeOptionExample}>
                          {metricType === "atomic"
                            ? "例如：订单总数、全部订单金额合计"
                            : "例如：订单总数、按渠道统计的订单金额"}
                        </span>
                      </span>
                    </Radio>
                  </Radio.Group>
                </Form.Item>
                <div className={styles.outputSummary}>
                  <span>{metricType === "atomic" ? "默认结果" : "预计结果"}</span>
                  <strong>{outputNames[outputShape]}</strong>
                </div>
              </>
            )}
          </Section>

          <Section
            title={metricType === "derived" ? "3. 业务限定" : "3. 计算逻辑"}
            tooltip={
              metricType === "atomic"
                ? calculationScope === "object_instance"
                  ? "定义每个实例如何得到一个值：直接读取属性，或进行一次简单函数或四则运算。若需限定状态、渠道、时间范围或关联对象，请发布后创建衍生指标。"
                  : "定义一组实例如何得到汇总值：可直接计数，或对某个属性进行聚合。若需限定状态、渠道、时间范围或关联对象，请发布后创建衍生指标。"
                : metricType === "derived"
                  ? "在一个已发布原子指标的基础上增加业务限定。"
                  : "组合至少两个已发布指标，并配置依赖、运算公式和对齐规则。"
            }
          >
            {metricType === "atomic" ? (
              <div className={styles.grid2}>
                {calculationScope !== "object_instance" ? (
                  <Form.Item
                    extra={aggregation ? atomicAggregationGuidance[aggregation] : undefined}
                    label="聚合方式"
                    name="aggregation"
                    rules={[{ required: true, message: "请选择聚合方式" }]}
                    tooltip="计数统计全部实例，无需选择属性；非空计数和去重计数需要选择属性；求和和平均值适用于数值属性；最小值和最大值返回指定属性的极值。"
                  >
                    <Select
                      onChange={(aggregation: FormValues["aggregation"]) => {
                        const isCount =
                          aggregation === "count_rows" ||
                          aggregation === "count" ||
                          aggregation === "count_distinct";
                        applyValueSuggestion(
                          instanceValueSuggestion(measureExpression, properties, aggregation),
                          isCount,
                        );
                      }}
                      options={[
                        { label: "计数（全部实例）", value: "count_rows" },
                        { label: "非空计数（指定属性）", value: "count" },
                        { label: "去重计数（指定属性）", value: "count_distinct" },
                        { label: "求和（数值属性）", value: "sum" },
                        { label: "平均值（数值属性）", value: "avg" },
                        { label: "最小值（指定属性）", value: "min" },
                        { label: "最大值（指定属性）", value: "max" },
                      ].filter(
                        (item) =>
                          !capabilities ||
                          capabilities.aggregations.some((value) => value === item.value),
                      )}
                    />
                  </Form.Item>
                ) : null}
                {aggregation !== "count_rows" ? (
                  <div className={styles.full}>
                    <div className={styles.sectionTitle}>
                      <h3>
                        {calculationScope === "object_instance" ? "取值方式" : "参与聚合的值"}
                      </h3>
                      <HelpTooltip
                        label={calculationScope === "object_instance" ? "取值方式" : "参与聚合的值"}
                        title={
                          calculationScope === "object_instance"
                            ? "选择当前对象的一个属性直接返回，也可使用一次简单函数或一次四则运算；公式必须引用至少一个对象属性。"
                            : "选择需要计数或聚合的对象属性，也可在聚合前使用一次简单函数或一次四则运算。"
                        }
                      />
                    </div>
                    <div className={styles.editorBox}>
                      {requiresAtomicMeasureProperty && propertiesLoading ? (
                        <Space size="small">
                          <Spin size="small" />
                          <span>正在加载对象属性…</span>
                        </Space>
                      ) : requiresAtomicMeasureProperty && !properties.length ? (
                        <Alert
                          description="请检查当前对象类是否已定义数据属性，或稍后重试加载。"
                          message="未加载到可引用的对象属性"
                          showIcon
                          type="error"
                        />
                      ) : (
                        <AtomicInstanceExpressionBuilder
                          allowedFunctions={capabilities?.functions}
                          allowedOperators={capabilities?.expression_operators}
                          onChange={(next) => {
                            setAtomicExpressionInteracted(true);
                            updateMeasureExpression(next);
                          }}
                          properties={properties}
                          value={measureExpression}
                        />
                      )}
                    </div>
                    {requiresAtomicMeasureProperty && !hasAtomicMeasureProperty ? (
                      <Alert
                        className={styles.expressionIssue}
                        description={
                          atomicExpressionInteracted
                            ? "固定值可以参与计算，但原子指标必须至少引用一个当前对象属性。请在计算中选择对象属性。"
                            : "原子指标需要从当前对象的数据属性取得基础事实。"
                        }
                        message={
                          atomicExpressionInteracted
                            ? "当前计算尚未引用对象属性"
                            : "请先选择一个对象属性"
                        }
                        showIcon
                        type={atomicExpressionInteracted ? "warning" : "info"}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {metricType === "derived" ? (
              selectedBaseMetric ? (
                <div className={styles.derivedFlow}>
                  <Alert
                    className={styles.qualifierStatus}
                    description={
                      hasDerivedQualifier
                        ? `已配置 ${derivedQualifierSummaries.length} 项业务限定。`
                        : selectedBaseDefinition?.calculation_scope === "object_instance"
                          ? "衍生指标不能与基础指标完全相同，请至少增加当前实例条件、关联实例条件或时间范围中的 1 项。"
                          : "衍生指标不能与基础指标完全相同，请至少增加当前实例条件、关联实例条件、时间范围、固定分组或时间粒度中的 1 项。"
                    }
                    message={hasDerivedQualifier ? "业务口径已形成" : "还需要增加业务限定"}
                    showIcon
                    type={hasDerivedQualifier ? "success" : "warning"}
                  />

                  <div className={styles.qualifierCard}>
                    <div className={styles.qualifierHeading}>
                      <span>1</span>
                      <div>
                        <h3>当前实例条件</h3>
                        <p>直接使用{ownerObjectName}的属性限定参与计算的实例。</p>
                      </div>
                      <Tag>可选</Tag>
                    </div>
                    <ObjectMetricConditionBuilder
                      allowedBooleanOperators={capabilities?.boolean_operators}
                      allowedComparisonOperators={capabilities?.comparison_operators}
                      onChange={setBusinessCondition}
                      properties={properties}
                      value={businessCondition}
                    />
                  </div>

                  <div className={styles.qualifierCard}>
                    <Form.Item hidden name="relationQuantifier">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="relationCountComparison">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="relationCountThreshold">
                      <InputNumber />
                    </Form.Item>
                    <div className={styles.qualifierHeading}>
                      <span>2</span>
                      <div>
                        <h3>关联实例条件</h3>
                        <p>通过关系类判断当前实例是否参与计算，不汇总关联实例的数值。</p>
                      </div>
                      <Tag>可选</Tag>
                    </div>
                    {relationSteps.map((step, index) => {
                      const sourceObjectTypeId =
                        index === 0
                          ? ownerObjectTypeId
                          : relationSteps[index - 1].target_object_type_id;
                      const previousObjectTypeId =
                        index === 0
                          ? undefined
                          : index === 1
                            ? ownerObjectTypeId
                            : relationSteps[index - 2].target_object_type_id;
                      const available = availableRelationTypesFrom(
                        relationTypes,
                        sourceObjectTypeId,
                        previousObjectTypeId,
                        index === 0 ? undefined : relationSteps[index - 1].relation_type_id,
                      );
                      return (
                        <div
                          className={styles.relationStep}
                          key={`${step.relation_type_id}-${index}`}
                        >
                          <Tag>{index + 1}</Tag>
                          <Select
                            aria-label={`第 ${index + 1} 步关系类`}
                            onChange={(relationTypeId) => {
                              const relation = relationTypes.find(
                                (item) => item.id === relationTypeId,
                              );
                              if (!relation) return;
                              const outgoing = relation.sourceObjectTypeId === sourceObjectTypeId;
                              const nextStep: ObjectMetricRelationStepV1 = {
                                direction: outgoing ? "outgoing" : "incoming",
                                relation_type_id: relation.id,
                                target_object_type_id: outgoing
                                  ? relation.targetObjectTypeId
                                  : relation.sourceObjectTypeId,
                              };
                              setRelationSteps((current) =>
                                current
                                  .map((item, itemIndex) => (itemIndex === index ? nextStep : item))
                                  .slice(0, index + 1),
                              );
                              setRelatedCondition(undefined);
                              form.setFieldsValue({
                                relationCountComparison: undefined,
                                relationCountThreshold: undefined,
                                relationQuantifier: "exists",
                              });
                            }}
                            options={available.map((item) => ({
                              label: item.name,
                              value: item.id,
                            }))}
                            placeholder="选择关系类"
                            value={step.relation_type_id || undefined}
                          />
                          <span className={styles.relationTarget}>
                            →{" "}
                            {objectTypes.find((item) => item.id === step.target_object_type_id)
                              ?.name ?? "选择关系后自动确定目标对象类"}
                          </span>
                          <Button
                            aria-label={`删除第 ${index + 1} 个关系类步骤`}
                            danger
                            icon={<DeleteOutlined aria-hidden="true" />}
                            onClick={() => {
                              setRelationSteps((current) => current.slice(0, index));
                              setRelatedCondition(undefined);
                              if (index === 0) {
                                form.setFieldsValue({
                                  relationCountComparison: undefined,
                                  relationCountThreshold: undefined,
                                  relationQuantifier: undefined,
                                });
                              }
                            }}
                            type="text"
                          />
                        </div>
                      );
                    })}
                    <Button
                      disabled={!canAddRelationStep}
                      icon={<PlusOutlined aria-hidden="true" />}
                      onClick={() =>
                        setRelationSteps((current) => [
                          ...current,
                          {
                            direction: "outgoing",
                            relation_type_id: "",
                            target_object_type_id: "",
                          },
                        ])
                      }
                      type="dashed"
                    >
                      添加关系路径
                    </Button>
                    {lastRelationStep?.target_object_type_id && !canAddRelationStep ? (
                      <span className={styles.relationPathHint}>
                        当前关联对象没有可继续选择的关系；已自动排除原路返回。
                      </span>
                    ) : null}
                    {relationSteps.length && relatedProperties.length ? (
                      <div className={styles.relationConfiguration}>
                        {hasLegacyRelationRule && relationQuantifier ? (
                          <div className={styles.relationRuleSentence}>
                            <Tag>历史规则</Tag>
                            <span>
                              当前继续按“{relationQuantifierLabels[relationQuantifier]}”判断关联的
                              <strong>
                                {objectTypes.find(
                                  (item) => item.id === relationSteps.at(-1)?.target_object_type_id,
                                )?.name ?? "实例"}
                              </strong>
                              。
                            </span>
                          </div>
                        ) : (
                          <p className={styles.relationAutomaticHint}>
                            默认规则：关联对象任一满足条件即可，当前{ownerObjectName}只计算一次。
                          </p>
                        )}
                        {hasLegacyRelationRule && relationQuantifier ? (
                          <Alert
                            description="为避免改变已有指标口径，当前继续按原规则执行；重新选择关系路径后将使用默认的“任一满足”。"
                            message={`历史高级判断规则：${relationQuantifierLabels[relationQuantifier]}`}
                            showIcon
                            type="info"
                          />
                        ) : null}
                        <ObjectMetricConditionBuilder
                          allowedBooleanOperators={capabilities?.boolean_operators}
                          allowedComparisonOperators={capabilities?.comparison_operators}
                          onChange={setRelatedCondition}
                          properties={relatedProperties}
                          value={relatedCondition}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.qualifierCard}>
                    <div className={styles.qualifierHeading}>
                      <span>3</span>
                      <div>
                        <h3>时间范围</h3>
                        <p>限定哪些时间的数据参与计算；不固定时由查询方选择日期。</p>
                      </div>
                      <Tag>可选</Tag>
                    </div>
                    <div className={styles.timeWindowGrid}>
                      <Form.Item label="统计时间范围" name="timeWindowMode">
                        <Select
                          onChange={(mode: FormValues["timeWindowMode"]) => {
                            if (!mode || mode === "unbounded") {
                              form.setFieldsValue({
                                eventTime: timeGranularity ? eventTime : undefined,
                                fixedTimeRange: undefined,
                                timeWindowLength: undefined,
                                timeWindowUnit: undefined,
                                timezone: undefined,
                                weekStart: undefined,
                              });
                            } else {
                              const nextValues: Partial<FormValues> = {};
                              if (!eventTime && timePropertyOptions.length === 1) {
                                nextValues.eventTime = timePropertyOptions[0]?.value;
                              }
                              if (mode === "rolling") {
                                nextValues.fixedTimeRange = undefined;
                                nextValues.timeWindowLength = timeWindowLength ?? 30;
                                nextValues.timeWindowUnit = timeWindowUnit ?? "day";
                                nextValues.weekStart = undefined;
                              } else if (mode === "fixed_range") {
                                nextValues.timeWindowLength = undefined;
                                nextValues.timeWindowUnit = undefined;
                                nextValues.weekStart = undefined;
                              } else {
                                const period = objectMetricTimeWindowPeriod(mode);
                                nextValues.fixedTimeRange = undefined;
                                nextValues.timeWindowLength = undefined;
                                nextValues.timeWindowUnit = period;
                                nextValues.weekStart = period === "week" ? "monday" : undefined;
                              }
                              nextValues.timezone = defaultMetricTimezone;
                              form.setFieldsValue(nextValues);
                            }
                          }}
                          options={timeWindowOptions}
                          placeholder="不固定时间（查询时选择）"
                        />
                      </Form.Item>
                      {(timeWindowMode && timeWindowMode !== "unbounded") || timeGranularity ? (
                        <Form.Item
                          label={timeGranularity ? "时间属性（同时用于结果分桶）" : "时间属性"}
                          name="eventTime"
                          rules={[{ required: true, message: "请选择事件时间属性" }]}
                        >
                          <Select
                            options={timePropertyOptions}
                            placeholder="选择基础指标开放的时间属性"
                          />
                        </Form.Item>
                      ) : null}
                      {timeWindowMode === "rolling" ? (
                        <Form.Item label="最近多久" required>
                          <div className={styles.rollingWindowControl}>
                            <span>最近</span>
                            <Form.Item
                              name="timeWindowLength"
                              noStyle
                              rules={[{ required: true, message: "请输入时间长度" }]}
                            >
                              <InputNumber min={1} precision={0} />
                            </Form.Item>
                            <Form.Item
                              name="timeWindowUnit"
                              noStyle
                              rules={[{ required: true, message: "请选择时间单位" }]}
                            >
                              <Select options={[...timeUnitOptions]} />
                            </Form.Item>
                          </div>
                        </Form.Item>
                      ) : null}
                      {timeWindowMode === "fixed_range" ? (
                        <Form.Item
                          extra="适合活动期、合同期等不会随查询日期变化的指标；固定后会降低指标复用性。"
                          label="日期范围"
                          name="fixedTimeRange"
                          rules={[{ required: true, message: "请选择开始和结束时间" }]}
                        >
                          <DatePicker.RangePicker
                            format="YYYY-MM-DD HH:mm"
                            placeholder={["开始时间", "结束时间"]}
                            showTime
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      ) : null}
                    </div>
                    {timeWindowMode && timeWindowMode !== "unbounded" ? (
                      <>
                        <div aria-live="polite" className={styles.timeWindowPreview}>
                          <span>当前时间口径</span>
                          <strong>{timeWindowLabel ?? "请完成时间范围配置"}</strong>
                          <small>
                            统一使用 UTC
                            {timeWindowMode === "fixed_range" ? "解释起止时间" : "划分日期边界"}
                            {timeWindowPeriod === "week" ? "，每周从周一开始" : ""}
                          </small>
                        </div>
                      </>
                    ) : null}
                    {((timeWindowMode && timeWindowMode !== "unbounded") || timeGranularity) &&
                    !timePropertyOptions.length ? (
                      <Alert
                        description="请先在基础原子指标中开放一个日期或日期时间属性。"
                        message="基础指标没有可用的时间属性"
                        showIcon
                        type="warning"
                      />
                    ) : null}
                  </div>

                  <div aria-live="polite" className={styles.definitionPreview}>
                    <div className={styles.definitionPreviewTitle}>
                      <strong>当前业务口径</strong>
                      <span>随配置实时更新</span>
                    </div>
                    <p>
                      基于“{selectedBaseDefinition?.name} v{selectedBaseDefinition?.version}”
                      {derivedQualifierSummaries.length
                        ? `，${derivedQualifierSummaries.join("；")}。`
                        : "，尚未增加业务限定。"}
                    </p>
                    <p className={styles.technicalPreview}>
                      计算范围：
                      {selectedBaseDefinition
                        ? calculationScopeLabels[selectedBaseDefinition.calculation_scope]
                        : "—"}
                      · 基础计算：
                      {selectedBaseAggregation
                        ? aggregationLabels[selectedBaseAggregation]
                        : "继承基础指标"}
                      · 关联实例仅用于筛选，当前实例按身份去重
                    </p>
                  </div>
                </div>
              ) : (
                <div className={styles.guidedEmpty}>
                  <strong>先选择基础原子指标</strong>
                  <span>选定后再配置当前实例条件、关联实例条件或固定时间范围。</span>
                </div>
              )
            ) : null}

            {metricType === "composite" ? (
              <div className={styles.compositeFlow}>
                <div className={styles.qualifierCard}>
                  <div className={styles.qualifierHeading}>
                    <span>1</span>
                    <div>
                      <h3>选择参与计算的指标</h3>
                      <p>至少选择 2 个已发布指标。系统会先判断对象、时间和粒度是否需要对齐。</p>
                    </div>
                    <Tag
                      color={
                        dependencies.filter(selectedDependencyMetric).length >= 2
                          ? "success"
                          : "warning"
                      }
                    >
                      已识别 {dependencies.filter(selectedDependencyMetric).length} / 2
                    </Tag>
                  </div>
                  {!publishedOptions.length ? (
                    <Alert
                      description="请先发布与当前计算范围兼容的指标，再返回配置复合指标。"
                      message="没有可用的依赖指标"
                      showIcon
                      type="info"
                    />
                  ) : null}
                  {dependencies.map((dependency, index) => (
                    <div className={styles.dependencyRow} key={`${dependency.alias}-${index}`}>
                      <div className={styles.dependencyCardHeader}>
                        <div>
                          <span>依赖 {index + 1}</span>
                          <strong>
                            {selectedDependencyMetric(dependency)?.definition.name ??
                              (dependency.metric_ref.metric_id ? "依赖指标不可用" : "尚未选择指标")}
                          </strong>
                        </div>
                        <Button
                          aria-label={`删除依赖指标 ${dependency.alias || index + 1}`}
                          danger
                          icon={<DeleteOutlined aria-hidden="true" />}
                          onClick={() => {
                            const referenced = expressionReferencesDependencyAlias(
                              compositeExpression,
                              dependency.alias,
                            );
                            setDependencies((current) => {
                              const next = current.filter((_, itemIndex) => itemIndex !== index);
                              if (referenced)
                                setCompositeExpression(defaultCompositeExpression(next));
                              return next;
                            });
                            if (getFieldValue("primaryDependencyAlias") === dependency.alias) {
                              form.setFieldValue("primaryDependencyAlias", undefined);
                            }
                            if (referenced) {
                              void message.info("已删除公式引用的依赖指标，公式已重新初始化");
                            }
                          }}
                          type="text"
                        />
                      </div>
                      <div className={styles.dependencyPrimaryFields}>
                        <label>
                          <span>依赖指标</span>
                          <Select
                            aria-label={`第 ${index + 1} 个依赖指标`}
                            onChange={(key) => {
                              const metricRef = parseDependencyKey(key);
                              const selectedMetric = publishedMetrics.find(
                                (item) =>
                                  item.definition.id === metricRef.metric_id &&
                                  item.definition.version === metricRef.version,
                              );
                              const sameObject =
                                selectedMetric?.definition.owner_object_type_id ===
                                ownerObjectTypeId;
                              const relatedMode =
                                calculationScope === "object_set"
                                  ? "related_object_set"
                                  : "related_object";
                              if (!sameObject) clearUnsupportedCompositeTimeSeries();
                              setDependencies((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        evaluation_context: {
                                          filter_context: { mode: "inherit" },
                                          window: "inherited",
                                        },
                                        metric_ref: metricRef,
                                        object_alignment: {
                                          deduplication: sameObject ? "none" : "by_object_identity",
                                          mode: sameObject ? "same_object" : relatedMode,
                                          relation_path: undefined,
                                          relationship_cardinality: sameObject
                                            ? undefined
                                            : relatedMode === "related_object_set"
                                              ? "one_to_many"
                                              : "many_to_one",
                                        },
                                        rollup_aggregation:
                                          (!sameObject && relatedMode === "related_object_set") ||
                                          grainPolicy === "rollup"
                                            ? "sum"
                                            : undefined,
                                      }
                                    : item,
                                ),
                              );
                            }}
                            optionFilterProp="label"
                            options={dependencyOptions}
                            placeholder="选择已发布指标…"
                            showSearch
                            value={
                              dependency.metric_ref.metric_id
                                ? dependencyKey(
                                    dependency.metric_ref.metric_id,
                                    dependency.metric_ref.version,
                                  )
                                : undefined
                            }
                          />
                        </label>
                        <label>
                          <span>
                            公式符号
                            <HelpTooltip
                              label="公式符号"
                              title="公式符号用于在运算公式中引用这个指标。系统已自动生成，通常无需修改。"
                            />
                          </span>
                          <Input
                            aria-label={`第 ${index + 1} 个依赖的公式符号`}
                            autoComplete="off"
                            onChange={(event) => {
                              const nextAlias = event.target.value;
                              const previousAlias = dependency.alias;
                              setDependencies((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, alias: nextAlias } : item,
                                ),
                              );
                              setCompositeExpression((current) =>
                                renameDependencyAlias(current, previousAlias, nextAlias),
                              );
                              if (getFieldValue("primaryDependencyAlias") === previousAlias) {
                                form.setFieldValue("primaryDependencyAlias", nextAlias);
                              }
                            }}
                            placeholder="例如 metric_1"
                            spellCheck={false}
                            value={dependency.alias}
                          />
                        </label>
                      </div>
                      {dependency.metric_ref.metric_id && !selectedDependencyMetric(dependency) ? (
                        <Alert
                          description="该指标版本可能已删除、当前账号无权访问，或版本已经不存在。请重新选择一个已发布指标。"
                          message="原依赖指标无法读取"
                          showIcon
                          type="error"
                        />
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <div className={styles.dependencyContract}>
                          <div>
                            <span>所属对象</span>
                            <strong>
                              {objectTypes.find(
                                (item) =>
                                  item.id ===
                                  selectedDependencyMetric(dependency)?.definition
                                    .owner_object_type_id,
                              )?.name ?? "当前对象"}
                            </strong>
                          </div>
                          <div>
                            <span>计算范围</span>
                            <strong>
                              {
                                calculationScopeLabels[
                                  selectedDependencyMetric(dependency)!.definition.calculation_scope
                                ]
                              }
                            </strong>
                          </div>
                          <div>
                            <span>指标值类型</span>
                            <strong>
                              {semanticTypeOptions.find(
                                (item) =>
                                  item.value ===
                                  selectedDependencyMetric(dependency)!.definition.result_semantics
                                    .value.semantic_type,
                              )?.label ?? "未定义"}
                            </strong>
                          </div>
                          <div>
                            <span>单位</span>
                            <strong>
                              {selectedDependencyMetric(dependency)!.definition.result_semantics
                                .value.unit?.code ?? "无单位"}
                            </strong>
                          </div>
                        </div>
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <div className={styles.dependencyAlignmentSection}>
                          <div className={styles.dependencySubheading}>
                            <strong>对象对齐</strong>
                            <span>
                              {dependency.object_alignment.mode === "same_object"
                                ? "对象一致，系统自动完成"
                                : "对象不同，需要说明如何找到并汇总关联实例"}
                            </span>
                          </div>
                          {dependency.object_alignment.mode === "same_object" ? (
                            <Alert
                              description="该指标与复合指标属于同一对象，按实例身份自动对齐，无需额外配置。"
                              message="已自动对齐"
                              showIcon
                              type="success"
                            />
                          ) : (
                            <div className={styles.dependencyAlignmentChoice}>
                              <label>
                                <span>关联方式</span>
                                <Select
                                  aria-label={`第 ${index + 1} 个依赖的对象对齐方式`}
                                  onChange={(mode: ObjectMetricObjectAlignmentV1["mode"]) => {
                                    if (mode !== "same_object")
                                      clearUnsupportedCompositeTimeSeries();
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              object_alignment: {
                                                ...item.object_alignment,
                                                deduplication:
                                                  mode === "same_object"
                                                    ? "none"
                                                    : "by_object_identity",
                                                mode,
                                                relation_path:
                                                  mode === "same_object"
                                                    ? undefined
                                                    : item.object_alignment.relation_path,
                                                relationship_cardinality:
                                                  mode === "same_object"
                                                    ? undefined
                                                    : mode === "related_object_set"
                                                      ? "one_to_many"
                                                      : "many_to_one",
                                              },
                                              rollup_aggregation:
                                                mode === "related_object_set" ||
                                                grainPolicy === "rollup"
                                                  ? (item.rollup_aggregation ?? "sum")
                                                  : undefined,
                                            }
                                          : item,
                                      ),
                                    );
                                  }}
                                  options={dependencyAlignmentOptions(dependency)}
                                  value={dependency.object_alignment.mode}
                                />
                              </label>
                              <Button
                                disabled={Boolean(
                                  dependency.object_alignment.relation_path?.length &&
                                  !dependency.object_alignment.relation_path.at(-1)
                                    ?.target_object_type_id,
                                )}
                                onClick={() =>
                                  setDependencies((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            object_alignment: {
                                              ...item.object_alignment,
                                              relation_path: [
                                                ...(item.object_alignment.relation_path ?? []),
                                                {
                                                  direction: "outgoing",
                                                  relation_type_id: "",
                                                  target_object_type_id: "",
                                                },
                                              ],
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                {dependency.object_alignment.relation_path?.length
                                  ? `继续添加关系（当前 ${dependency.object_alignment.relation_path.length} 跳）`
                                  : "选择关系路径"}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : null}
                      {dependency.object_alignment.mode !== "same_object" ? (
                        <div className={styles.dependencyPath}>
                          {(dependency.object_alignment.relation_path ?? []).map(
                            (step, stepIndex) => {
                              const sourceObjectTypeId =
                                stepIndex === 0
                                  ? ownerObjectTypeId
                                  : dependency.object_alignment.relation_path?.[stepIndex - 1]
                                      ?.target_object_type_id;
                              const available = relationTypes.filter(
                                (item) =>
                                  item.sourceObjectTypeId === sourceObjectTypeId ||
                                  item.targetObjectTypeId === sourceObjectTypeId,
                              );
                              return (
                                <Space key={`${stepIndex}-${step.relation_type_id}`} wrap>
                                  <Tag>{stepIndex + 1}</Tag>
                                  <Select
                                    onChange={(relationTypeId) => {
                                      const relation = relationTypes.find(
                                        (item) => item.id === relationTypeId,
                                      );
                                      if (!relation || !sourceObjectTypeId) return;
                                      const outgoing =
                                        relation.sourceObjectTypeId === sourceObjectTypeId;
                                      const nextStep: ObjectMetricRelationStepV1 = {
                                        direction: outgoing ? "outgoing" : "incoming",
                                        relation_type_id: relation.id,
                                        target_object_type_id: outgoing
                                          ? relation.targetObjectTypeId
                                          : relation.sourceObjectTypeId,
                                      };
                                      setDependencies((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                object_alignment: {
                                                  ...item.object_alignment,
                                                  relation_path: [
                                                    ...(item.object_alignment.relation_path ?? [])
                                                      .slice(0, stepIndex)
                                                      .map((existing) => existing),
                                                    nextStep,
                                                  ],
                                                },
                                              }
                                            : item,
                                        ),
                                      );
                                    }}
                                    options={available.map((item) => ({
                                      label: item.name,
                                      value: item.id,
                                    }))}
                                    placeholder="选择关系类…"
                                    value={step.relation_type_id || undefined}
                                    style={{ minWidth: 260 }}
                                  />
                                  <span>
                                    →{" "}
                                    {objectTypes.find(
                                      (item) => item.id === step.target_object_type_id,
                                    )?.name ?? step.target_object_type_id}
                                  </span>
                                  <Button
                                    aria-label={`删除依赖指标 ${dependency.alias || index + 1} 的第 ${stepIndex + 1} 个关系类步骤`}
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() =>
                                      setDependencies((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                object_alignment: {
                                                  ...item.object_alignment,
                                                  relation_path:
                                                    item.object_alignment.relation_path?.slice(
                                                      0,
                                                      stepIndex,
                                                    ),
                                                },
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    type="text"
                                  />
                                </Space>
                              );
                            },
                          )}
                          <span className={styles.sectionHint}>
                            路径终点应为
                            {objectTypes.find(
                              (item) =>
                                item.id ===
                                selectedDependencyMetric(dependency)?.definition
                                  .owner_object_type_id,
                            )?.name ?? "依赖指标所属对象"}
                          </span>
                        </div>
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <div className={styles.dependencyTimeSection}>
                          <div className={styles.dependencySubheading}>
                            <strong>时间对齐</strong>
                            <span>
                              通常继承本次查询的时间范围；只有同比、环比等场景才单独设置。
                            </span>
                          </div>
                          <label>
                            <span>计算时间范围</span>
                            <Select
                              aria-label={`第 ${index + 1} 个依赖的计算时间范围`}
                              onChange={(window) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            window,
                                            window_spec:
                                              window === "rolling"
                                                ? {
                                                    length: 1,
                                                    mode: "rolling",
                                                    timezone: defaultMetricTimezone,
                                                    unit: "day",
                                                  }
                                                : window === "calendar_to_date"
                                                  ? {
                                                      mode: "period_to_date",
                                                      period: "month",
                                                      timezone: defaultMetricTimezone,
                                                    }
                                                  : undefined,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={[
                                { label: "使用当前查询时间范围（推荐）", value: "inherited" },
                                { label: "最近一段时间", value: "rolling" },
                                { label: "本周期至今", value: "calendar_to_date" },
                              ]}
                              value={dependency.evaluation_context.window}
                            />
                          </label>
                        </div>
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <details className={styles.dependencyAdvanced}>
                          <summary>高级依赖设置</summary>
                          <p>仅在需要汇总关联数据、移除查询筛选或进行同比/环比时修改。</p>
                          <div className={styles.dependencyContext}>
                            {dependency.object_alignment.mode !== "same_object" ? (
                              <>
                                <span className={styles.sectionHint}>关系基数</span>
                                <Select
                                  onChange={(relationship_cardinality) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              object_alignment: {
                                                ...item.object_alignment,
                                                relationship_cardinality,
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={
                                    dependency.object_alignment.mode === "related_object"
                                      ? [
                                          { label: "一对一", value: "one_to_one" },
                                          { label: "多对一", value: "many_to_one" },
                                        ]
                                      : [
                                          { label: "一对多", value: "one_to_many" },
                                          { label: "多对多", value: "many_to_many" },
                                        ]
                                  }
                                  value={dependency.object_alignment.relationship_cardinality}
                                  style={{ width: 130 }}
                                />
                                <span className={styles.sectionHint}>重复对象</span>
                                <Select
                                  disabled={
                                    dependency.object_alignment.mode === "related_object_set"
                                  }
                                  onChange={(deduplication) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              object_alignment: {
                                                ...item.object_alignment,
                                                deduplication,
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={[
                                    { label: "保留", value: "none" },
                                    { label: "按实例去重", value: "by_object_identity" },
                                  ]}
                                  value={dependency.object_alignment.deduplication}
                                  style={{ width: 170 }}
                                />
                              </>
                            ) : null}
                            {dependency.object_alignment.mode === "related_object_set" ||
                            grainPolicy === "rollup" ? (
                              <>
                                <span className={styles.sectionHint}>依赖汇总方式</span>
                                <Select
                                  onChange={(rollup_aggregation) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, rollup_aggregation }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={[
                                    { label: "求和", value: "sum" },
                                    { label: "平均值", value: "avg" },
                                    { label: "最小值", value: "min" },
                                    { label: "最大值", value: "max" },
                                    { label: "计数", value: "count" },
                                    { label: "去重计数", value: "count_distinct" },
                                  ]}
                                  placeholder="选择依赖汇总方式"
                                  value={dependency.rollup_aggregation}
                                  style={{ width: 170 }}
                                />
                              </>
                            ) : null}
                            {dependency.evaluation_context.window === "rolling" &&
                            dependency.evaluation_context.window_spec?.mode === "rolling" ? (
                              <>
                                <span className={styles.sectionHint}>窗口长度</span>
                                <InputNumber
                                  min={1}
                                  onChange={(length) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index &&
                                        item.evaluation_context.window_spec?.mode === "rolling"
                                          ? {
                                              ...item,
                                              evaluation_context: {
                                                ...item.evaluation_context,
                                                window_spec: {
                                                  ...item.evaluation_context.window_spec,
                                                  length: length ?? 1,
                                                },
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  value={dependency.evaluation_context.window_spec.length}
                                />
                                <Select
                                  onChange={(unit) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index &&
                                        item.evaluation_context.window_spec?.mode === "rolling"
                                          ? {
                                              ...item,
                                              evaluation_context: {
                                                ...item.evaluation_context,
                                                window_spec: {
                                                  ...item.evaluation_context.window_spec,
                                                  unit,
                                                },
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={[...timeUnitOptions]}
                                  value={dependency.evaluation_context.window_spec.unit}
                                  style={{ width: 120 }}
                                />
                              </>
                            ) : null}
                            {dependency.evaluation_context.window === "calendar_to_date" &&
                            dependency.evaluation_context.window_spec?.mode === "period_to_date" ? (
                              <>
                                <span className={styles.sectionHint}>自然周期</span>
                                <Select
                                  onChange={(period) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index &&
                                        item.evaluation_context.window_spec?.mode ===
                                          "period_to_date"
                                          ? {
                                              ...item,
                                              evaluation_context: {
                                                ...item.evaluation_context,
                                                window_spec: {
                                                  ...item.evaluation_context.window_spec,
                                                  period,
                                                  week_start:
                                                    period === "week" ? "monday" : undefined,
                                                  timezone: defaultMetricTimezone,
                                                },
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={timeUnitOptions.filter(
                                    (item) => !["minute", "hour"].includes(item.value),
                                  )}
                                  value={dependency.evaluation_context.window_spec.period}
                                  style={{ width: 120 }}
                                />
                              </>
                            ) : null}
                            <span className={styles.sectionHint}>筛选上下文</span>
                            <Select
                              onChange={(mode) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            filter_context: dependencyFilterContext(
                                              mode,
                                              item.evaluation_context.filter_context,
                                              ownerObjectTypeId,
                                              properties[0]?.propertyName ?? "",
                                            ),
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={[
                                { label: "继承查询筛选", value: "inherit" },
                                { label: "移除某维度筛选", value: "remove_dimension_filter" },
                              ]}
                              value={dependency.evaluation_context.filter_context.mode}
                              style={{ minWidth: 180 }}
                            />
                            {dependency.evaluation_context.filter_context.mode !== "inherit" ? (
                              <Select
                                onChange={(name) =>
                                  setDependencies((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            evaluation_context: {
                                              ...item.evaluation_context,
                                              filter_context: {
                                                ...item.evaluation_context.filter_context,
                                                dimension: propertyRef(ownerObjectTypeId, name),
                                              },
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                options={propertyOptions}
                                placeholder="选择维度"
                                value={
                                  dependency.evaluation_context.filter_context.dimension
                                    ?.property_name
                                }
                                style={{ minWidth: 180 }}
                              />
                            ) : null}
                            <span className={styles.sectionHint}>时间偏移</span>
                            <InputNumber
                              onChange={(amount) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            time_shift:
                                              amount === null
                                                ? undefined
                                                : {
                                                    amount,
                                                    unit:
                                                      item.evaluation_context.time_shift?.unit ??
                                                      "day",
                                                  },
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="偏移量"
                              value={dependency.evaluation_context.time_shift?.amount}
                            />
                            <Select
                              disabled={!dependency.evaluation_context.time_shift}
                              onChange={(unit) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index && item.evaluation_context.time_shift
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            time_shift: {
                                              ...item.evaluation_context.time_shift,
                                              unit,
                                            },
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={timeUnitOptions.filter(
                                (item) => !["minute", "hour"].includes(item.value),
                              )}
                              value={dependency.evaluation_context.time_shift?.unit}
                              style={{ width: 120 }}
                            />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    disabled={!publishedOptions.length}
                    icon={<PlusOutlined aria-hidden="true" />}
                    onClick={() => {
                      setDependencies((current) => {
                        let suffix = current.length + 1;
                        while (current.some((item) => item.alias === `metric_${suffix}`))
                          suffix += 1;
                        return [
                          ...current,
                          {
                            alias: `metric_${suffix}`,
                            evaluation_context: {
                              filter_context: { mode: "inherit" },
                              window: "inherited",
                            },
                            metric_ref: { metric_id: "", version: 1 },
                            object_alignment: {
                              deduplication: "none",
                              mode: "same_object",
                            },
                          },
                        ];
                      });
                    }}
                    type="dashed"
                  >
                    添加依赖指标
                  </Button>
                </div>

                <div className={styles.qualifierCard}>
                  <div className={styles.qualifierHeading}>
                    <span>2</span>
                    <div>
                      <h3>配置指标运算公式</h3>
                      <p>
                        使用公式符号组合依赖指标；选择第 2
                        个依赖后，系统会生成一条可编辑的加法公式。
                      </p>
                    </div>
                  </div>
                  {dependencies.filter(selectedDependencyMetric).length >= 2 ? (
                    <div className={styles.editorBox}>
                      <ObjectMetricExpressionEditor
                        allowedFunctions={capabilities?.functions}
                        allowedOperators={capabilities?.expression_operators}
                        dependencyAliases={dependencies
                          .filter(selectedDependencyMetric)
                          .map((item) => item.alias)
                          .filter(Boolean)}
                        onChange={updateCompositeExpression}
                        properties={[]}
                        value={compositeExpression}
                      />
                      <div className={styles.formulaPreview} aria-live="polite">
                        <span>业务公式</span>
                        <strong>{compositeBusinessFormula}</strong>
                        <small>技术表达式：{expressionLabel(compositeExpression)}</small>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.guidedEmpty}>
                      <strong>
                        还需要选择 {2 - dependencies.filter(selectedDependencyMetric).length} 个指标
                      </strong>
                      <span>完成至少 2 个依赖指标后，才能配置它们之间的运算关系。</span>
                    </div>
                  )}
                </div>

                <div className={styles.qualifierCard}>
                  <div className={styles.qualifierHeading}>
                    <span>3</span>
                    <div>
                      <h3>确认结果对齐方式</h3>
                      <p>常见场景使用系统默认值即可；只有粒度或结果集合不一致时才需要修改。</p>
                    </div>
                  </div>
                  <div className={styles.alignmentSummary}>
                    <div>
                      <span>粒度</span>
                      <strong>
                        {grainPolicy === "rollup" ? "汇总到结果粒度" : "保持相同粒度"}
                      </strong>
                    </div>
                    <div>
                      <span>时间</span>
                      <strong>
                        {getFieldValue("timeAlignment") === "explicit_rollup"
                          ? "汇总到结果时间粒度"
                          : "使用同一查询窗口"}
                      </strong>
                    </div>
                    <div>
                      <span>结果集合</span>
                      <strong>
                        {resultSetPolicy === "preserve_primary_dependency"
                          ? "保留主依赖的结果"
                          : "仅保留各依赖均有结果的实例"}
                      </strong>
                    </div>
                  </div>
                  <details className={styles.resultAlignmentAdvanced}>
                    <summary>修改高级结果对齐</summary>
                    <p>
                      当依赖指标粒度不同、希望保留某个指标的全部实例，或需要指定空值规则时使用。
                    </p>
                    <div className={styles.grid3}>
                      <Form.Item label="粒度对齐" name="grainPolicy">
                        <Select
                          onChange={(value) =>
                            setDependencies((current) =>
                              current.map((item) => ({
                                ...item,
                                rollup_aggregation:
                                  value === "rollup" ||
                                  item.object_alignment.mode === "related_object_set"
                                    ? (item.rollup_aggregation ?? "sum")
                                    : undefined,
                              })),
                            )
                          }
                          options={
                            calculationScope === "object_instance"
                              ? [{ label: "保持相同粒度", value: "same_grain" }]
                              : [
                                  { label: "保持相同粒度", value: "same_grain" },
                                  { label: "汇总到结果粒度", value: "rollup" },
                                ]
                          }
                        />
                      </Form.Item>
                      <Form.Item label="结果实例范围" name="resultSetPolicy">
                        <Select
                          options={[
                            { label: "仅保留各依赖均有结果的实例", value: "intersection" },
                            {
                              label: "保留主依赖的全部实例",
                              value: "preserve_primary_dependency",
                            },
                          ]}
                        />
                      </Form.Item>
                      {resultSetPolicy === "preserve_primary_dependency" ? (
                        <Form.Item
                          label="主依赖指标"
                          name="primaryDependencyAlias"
                          rules={[{ required: true, message: "请选择要保留其全部实例的指标" }]}
                        >
                          <Select
                            options={dependencies.filter(selectedDependencyMetric).map((item) => ({
                              label: selectedDependencyMetric(item)?.definition.name ?? item.alias,
                              value: item.alias,
                            }))}
                            placeholder="选择主依赖指标…"
                          />
                        </Form.Item>
                      ) : null}
                      <Form.Item label="时间粒度对齐" name="timeAlignment">
                        <Select
                          onChange={(value) => {
                            if (value === "explicit_rollup") {
                              form.setFieldValue("grainPolicy", "rollup");
                              setDependencies((current) =>
                                current.map((item) => ({
                                  ...item,
                                  rollup_aggregation: item.rollup_aggregation ?? "sum",
                                })),
                              );
                            }
                          }}
                          options={
                            calculationScope === "object_instance"
                              ? [{ label: "使用同一查询窗口", value: "same_time_window" }]
                              : [
                                  { label: "使用同一查询窗口", value: "same_time_window" },
                                  {
                                    label: "汇总到结果时间粒度",
                                    value: "explicit_rollup",
                                  },
                                ]
                          }
                        />
                      </Form.Item>
                      <Form.Item label="某个依赖没有值时" name="nullPolicy">
                        <Select
                          options={[
                            { label: "结果也为空", value: "propagate" },
                            { label: "按 0 参与计算", value: "coalesce_zero" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="除数为 0 时" name="zeroDivisionPolicy">
                        <Select
                          options={[
                            { label: "标记结果不可用", value: "unavailable" },
                            { label: "返回 null", value: "null" },
                            { label: "返回 0", value: "zero" },
                          ]}
                        />
                      </Form.Item>
                    </div>
                  </details>
                </div>

                <div className={styles.definitionPreview} aria-live="polite">
                  <div className={styles.definitionPreviewTitle}>
                    <strong>业务预览</strong>
                    <span>随配置实时更新</span>
                  </div>
                  {dependencies.filter(selectedDependencyMetric).length >= 2 ? (
                    <>
                      <p>
                        在{ownerObjectType?.name ?? "当前对象"}的
                        {calculationScope === "object_instance" ? "每个实例" : "实例集合"}
                        范围内，先完成依赖指标的对象、时间和粒度对齐，再按“
                        {compositeBusinessFormula}”计算结果。
                      </p>
                      {compositeAlignmentSummaries.map((summary, index) => (
                        <div className={styles.technicalPreview} key={`${index}-${summary}`}>
                          · {summary}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p>选择至少 2 个依赖指标后，这里会用业务语言说明它们如何对齐和组合。</p>
                  )}
                </div>
              </div>
            ) : null}
          </Section>

          <Section
            title={
              effectiveCalculationScope === "object_instance" ? "4. 结果定义" : "4. 结果与分析"
            }
            tooltip={
              metricType === "atomic"
                ? effectiveCalculationScope === "object_instance"
                  ? "确认每个实例返回值的业务含义和单位，并声明该指标支持使用的分析维度和时间维度。系统只保存结果定义，不保存运行产生的具体数值。"
                  : "确认汇总结果的业务含义和单位，并设置无数据规则以及查询时可用的分析维度和时间属性。"
                : effectiveCalculationScope === "object_instance"
                  ? "定义指标结果的业务含义、单位和无数据处理方式。系统会自动推断并保存技术类型，但不会保存指标运行产生的具体数值。"
                  : metricType === "derived"
                    ? "配置固定分组、开放分析维度和时间维度；值类型与单位继承基础原子指标。"
                    : "配置固定分组、开放分析维度和时间维度，定义结果如何返回和分析。"
            }
          >
            <div className={styles.grid2}>
              {calculationScope === "object_instance" &&
              hasAtomicMeasureProperty &&
              (!physicalType || !semanticType) ? (
                <Alert
                  className={styles.full}
                  message="暂未推断出结果类型"
                  description="请先选择对象属性并完成取值方式。系统会根据属性、函数和运算符自动确定结果类型。"
                  showIcon
                  type="info"
                />
              ) : null}
              {canConfigureFixedResultGrain ? (
                <Form.Item
                  label="固定分组维度"
                  name="groupByDimensions"
                  tooltip="选中后每个分组返回一行；不选时返回一个汇总值。"
                >
                  <Select
                    mode="multiple"
                    onChange={(dimensions: string[]) => {
                      const selected = new Set(dimensions);
                      form.setFieldValue(
                        "analysisDimensions",
                        (getFieldValue("analysisDimensions") ?? []).filter(
                          (item) => !selected.has(item),
                        ),
                      );
                    }}
                    options={resultPropertyOptions}
                    placeholder="默认返回一个汇总值"
                  />
                </Form.Item>
              ) : null}
              {canConfigureFixedResultGrain ? (
                <Form.Item
                  extra={
                    metricType === "composite" && hasCrossObjectDependency
                      ? "当前跨对象依赖没有可对齐的事件时间，因此不能设置固定时间粒度。"
                      : undefined
                  }
                  label="固定时间粒度"
                  name="timeGranularity"
                  tooltip="选中后按指定周期返回时间序列；不选时不按时间分桶。"
                >
                  <Select
                    allowClear
                    disabled={metricType === "composite" && hasCrossObjectDependency}
                    onChange={(value: FormValues["timeGranularity"]) => {
                      if (!value) {
                        form.setFieldsValue({
                          alignmentTimeKey: undefined,
                          grainWeekStart: undefined,
                        });
                      }
                    }}
                    options={timeUnitOptions.filter(
                      (item) =>
                        !capabilities ||
                        capabilities.time_granularities.some((value) => value === item.value),
                    )}
                  />
                </Form.Item>
              ) : null}
              {metricType === "composite" && canConfigureFixedResultGrain && timeGranularity ? (
                <Form.Item
                  label="结果时间字段"
                  name="alignmentTimeKey"
                  rules={[{ required: true, message: "请选择用于时间对齐的结果时间字段" }]}
                  tooltip="依赖指标按该字段归入同一时间桶"
                >
                  <Select options={timePropertyOptions} placeholder="选择日期或日期时间属性" />
                </Form.Item>
              ) : null}
              {metricType === "derived" ? (
                selectedBaseDefinition && selectedBaseValue ? (
                  <>
                    <div className={styles.inheritedResultSummary}>
                      <div>
                        <span>继承的指标值类型</span>
                        <strong>
                          {semanticTypeOptions.find(
                            (item) => item.value === selectedBaseValue.semantic_type,
                          )?.label ?? selectedBaseValue.semantic_type}
                        </strong>
                      </div>
                      <div>
                        <span>结果数据类型</span>
                        <strong>
                          {physicalTypeOptions.find(
                            (item) => item.value === selectedBaseValue.physical_type,
                          )?.label ?? selectedBaseValue.physical_type}
                        </strong>
                      </div>
                      <div>
                        <span>继承的单位</span>
                        <strong>{selectedBaseValue.unit?.code ?? "无单位"}</strong>
                      </div>
                      <p>
                        以上结果含义由基础原子指标决定；当前衍生指标可以单独设置无数据处理和开放分析维度。
                      </p>
                    </div>
                    <Form.Item hidden name="physicalType">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="semanticType">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="precision">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="scale">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="roundingMode">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitCode">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitSystem">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="quantityKind">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitScaleFactor">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="minimum">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="maximum">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="unitNumeratorSystem">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitNumeratorKind">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitNumeratorCode">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitDenominatorSystem">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitDenominatorKind">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitDenominatorCode">
                      <Input />
                    </Form.Item>
                  </>
                ) : (
                  <div className={styles.inheritedValuePlaceholder}>
                    选择基础原子指标后，这里会显示继承的值类型和单位。
                  </div>
                )
              ) : (
                <>
                  <Form.Item
                    name="physicalType"
                    hidden
                    rules={[{ required: true, message: "请先完成取值方式以确定结果类型" }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    extra={
                      <div className={styles.inferredResultInline}>
                        <span>结果数据类型：</span>
                        <strong>
                          {physicalTypeOptions.find((item) => item.value === physicalType)?.label ??
                            "等待推断"}
                        </strong>
                        <span>（自动确定）</span>
                        <Tooltip title="这是结果的返回格式，例如整数、小数或文本。系统根据对象属性和计算方式自动确定；它不是指标运行产生的具体数值。">
                          <Button
                            aria-label="了解结果数据类型"
                            className={styles.inlineHelpButton}
                            icon={<QuestionCircleOutlined />}
                            size="small"
                            type="text"
                          />
                        </Tooltip>
                      </div>
                    }
                    label="指标值类型"
                    name="semanticType"
                    rules={[{ required: true, message: "请选择指标值类型" }]}
                    tooltip={
                      metricType === "atomic"
                        ? "系统已根据对象属性和计算方式筛选可选项；请选择最符合业务含义的类型，例如金额、计数、百分比或时长。"
                        : "说明结果在业务上的含义，如金额、计数、百分比或时长。"
                    }
                  >
                    <Select
                      onChange={(semanticType: FormValues["semanticType"]) => {
                        if (semanticType === "count") {
                          form.setFieldsValue({
                            quantityKind: "count",
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "amount") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "currency",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 2,
                            unitCode: "CNY",
                            unitScaleFactor: 1,
                            unitSystem: "ISO_4217",
                          });
                        } else if (semanticType === "percentage") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "dimensionless",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 2,
                            unitCode: "%",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "ratio") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "dimensionless",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 4,
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "timestamp") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "duration") {
                          form.setFieldsValue({
                            quantityKind: "duration",
                            unitCode: "min",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "date") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "category") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "boolean") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "rank") {
                          form.setFieldsValue({
                            quantityKind: "dimensionless",
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "score") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "dimensionless",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 2,
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "measure") {
                          form.setFieldsValue({
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        }
                      }}
                      options={semanticTypeOptions.filter(
                        (item) =>
                          (!capabilities ||
                            capabilities.semantic_types.some((value) => value === item.value)) &&
                          (!physicalType ||
                            physicalTypesBySemanticType[item.value].includes(physicalType)) &&
                          (metricType !== "atomic" ||
                            !["count_rows", "count", "count_distinct"].includes(aggregation) ||
                            item.value === "count"),
                      )}
                    />
                  </Form.Item>
                  {physicalType === "decimal" ? (
                    <details className={styles.resultDetails}>
                      <summary>
                        <span>数值格式</span>
                        <span>
                          {precision ?? 18} 位精度 · 保留 {scale ?? 2} 位 ·{` `}
                          {roundingMode ? roundingModeLabels[roundingMode] : "四舍五入"}
                        </span>
                      </summary>
                      <div className={styles.detailsGrid}>
                        <Form.Item
                          label="精度"
                          name="precision"
                          rules={[{ required: true, message: "请输入小数总位数" }]}
                        >
                          <InputNumber max={38} min={1} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item
                          label="小数位"
                          name="scale"
                          rules={[{ required: true, message: "请输入保留小数位数" }]}
                        >
                          <InputNumber
                            max={getFieldValue("precision") ?? 38}
                            min={0}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                        <Form.Item
                          label="舍入方式"
                          name="roundingMode"
                          rules={[{ required: true, message: "请选择舍入方式" }]}
                        >
                          <Select
                            options={[
                              { label: "四舍五入", value: "half_up" },
                              { label: "银行家舍入", value: "half_even" },
                              { label: "向下取整", value: "floor" },
                              { label: "向上取整", value: "ceiling" },
                              { label: "直接截断", value: "truncate" },
                            ]}
                          />
                        </Form.Item>
                      </div>
                    </details>
                  ) : null}
                  {supportsUnit(physicalType) ? (
                    <>
                      <Form.Item
                        extra={
                          unitSelectionLocked
                            ? "该单位由指标值类型自动确定。"
                            : "仅显示与当前指标值类型兼容的常用单位。"
                        }
                        label="单位"
                        name="unitCode"
                        rules={[
                          {
                            required:
                              semanticType === "amount" ||
                              semanticType === "duration" ||
                              semanticType === "percentage",
                            message: "请选择结果单位",
                          },
                        ]}
                        tooltip={
                          metricType === "atomic"
                            ? "选择结果使用的业务单位，例如元、%、分钟或个；系统用它展示结果并检查指标之间是否可以计算。"
                            : "系统会保存标准单位代码及其量纲，用于结果展示、比较和换算。"
                        }
                      >
                        <Select
                          allowClear={!unitSelectionLocked}
                          disabled={unitSelectionLocked}
                          onChange={(code?: string) => {
                            if (!code) {
                              form.setFieldsValue({
                                quantityKind: undefined,
                                unitScaleFactor: undefined,
                                unitSystem: undefined,
                              });
                              return;
                            }
                            const selectedUnit = compatibleUnitOptions.find(
                              (item) => item.code === code,
                            );
                            if (!selectedUnit) return;
                            form.setFieldsValue({
                              quantityKind: selectedUnit.quantityKind,
                              unitScaleFactor: selectedUnit.scaleFactor,
                              unitSystem: selectedUnit.system,
                            });
                          }}
                          optionFilterProp="label"
                          options={compatibleUnitOptions.map((item) => ({
                            label: item.label,
                            value: item.code,
                          }))}
                          placeholder={
                            semanticType === "amount"
                              ? "请选择币种"
                              : semanticType === "duration"
                                ? "请选择时长单位"
                                : "请选择单位（可选）"
                          }
                          showSearch
                        />
                      </Form.Item>
                      <Form.Item hidden name="unitSystem">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="quantityKind">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitScaleFactor">
                        <InputNumber />
                      </Form.Item>
                    </>
                  ) : null}
                  {quantityKind === "rate" ? (
                    <>
                      <Form.Item hidden name="unitNumeratorSystem">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitNumeratorKind">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitNumeratorCode">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitDenominatorSystem">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitDenominatorKind">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitDenominatorCode">
                        <Input />
                      </Form.Item>
                    </>
                  ) : null}
                  {physicalType === "int64" ||
                  physicalType === "decimal" ||
                  physicalType === "duration" ? (
                    <>
                      <Form.Item hidden name="minimum">
                        <InputNumber />
                      </Form.Item>
                      <Form.Item hidden name="maximum">
                        <InputNumber />
                      </Form.Item>
                    </>
                  ) : null}
                </>
              )}
              {metricType !== "derived" || selectedBaseDefinition ? (
                <>
                  <Form.Item
                    label="没有可计算数据时"
                    name="noDataPolicy"
                    tooltip="决定没有可计算数据时的返回方式，不改变正常计算结果。"
                  >
                    <Select
                      options={[
                        {
                          disabled: !supportsUnit(physicalType),
                          label: "返回 0（按零值参与后续计算）",
                          value: "zero",
                        },
                        {
                          label: "返回空值（不参与后续计算）",
                          value: "null",
                        },
                        {
                          label: "标记不可用（本次指标结果不可用）",
                          value: "unavailable",
                        },
                      ]}
                    />
                  </Form.Item>
                  <div className={`${styles.full} ${styles.queryCapabilityHeader}`}>
                    <strong>{metricType === "atomic" ? "分析口径" : "查询与分析能力"}</strong>
                    <span>
                      {metricType === "atomic"
                        ? "定义该指标支持按哪些业务属性和时间属性进行查询分析，不改变指标的计算逻辑和返回值。"
                        : effectiveCalculationScope === "object_instance"
                          ? "声明查询时可以使用的属性，不改变每个实例返回一个值。"
                          : "声明查询时可以临时筛选、分组、下钻或限定时间范围的属性。"}
                    </span>
                  </div>
                  <Form.Item
                    label={
                      metricType === "atomic"
                        ? "可分析维度"
                        : effectiveCalculationScope === "object_instance"
                          ? "可用于筛选和分析的属性"
                          : "开放分析维度"
                    }
                    name="analysisDimensions"
                    tooltip={
                      metricType === "atomic"
                        ? "查询时可用于筛选、分组和下钻的业务属性；不会改变指标的计算方式和返回粒度。"
                        : "查询时可用于筛选、分组和下钻，不改变指标的固定返回粒度。"
                    }
                  >
                    <Select
                      mode="multiple"
                      options={analysisPropertyOptions}
                      placeholder={
                        metricType === "atomic"
                          ? "选择查询时可用于筛选、分组和下钻的属性（可选）"
                          : "选择查询时可使用的分析属性（可选）"
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    label={
                      metricType === "atomic"
                        ? "可查询时间维度"
                        : effectiveCalculationScope === "object_instance"
                          ? "可用于时间筛选的属性"
                          : "可查询时间维度"
                    }
                    name="timeDimensions"
                    tooltip={
                      metricType === "atomic"
                        ? "查询时可用于指定统计时间范围的日期或日期时间属性；原子指标本身不固定时间窗口。"
                        : "查询时可用来限定业务时间范围的日期或日期时间属性。"
                    }
                  >
                    <Select
                      mode="multiple"
                      notFoundContent="当前对象没有可用的日期或日期时间属性"
                      options={timePropertyOptions}
                      placeholder={
                        metricType === "atomic"
                          ? "选择查询时可用于限定统计时间范围的属性（可选）"
                          : "选择查询时可使用的时间属性（可选）"
                      }
                    />
                  </Form.Item>
                  {effectiveCalculationScope === "object_instance" ? (
                    <div className={`${styles.full} ${styles.logicPropertyCard}`}>
                      <div className={styles.logicPropertyHeader}>
                        <div>
                          <strong>发布后作为逻辑属性使用</strong>
                          <span>
                            现在完成属性配置；发布成功后，系统会将它添加到
                            {ownerObjectType?.name ?? "当前对象类"}，无需再次进入详情页操作。
                          </span>
                        </div>
                        <Form.Item name="logicPropertyEnabled" noStyle valuePropName="checked">
                          <Switch
                            aria-label="发布后作为逻辑属性使用"
                            onChange={(checked) => {
                              if (!checked) return;
                              form.setFieldsValue({
                                logicPropertyDisplayName:
                                  getFieldValue("logicPropertyDisplayName") ||
                                  getFieldValue("name") ||
                                  undefined,
                                logicPropertyName:
                                  getFieldValue("logicPropertyName") ||
                                  getFieldValue("code") ||
                                  undefined,
                              });
                            }}
                          />
                        </Form.Item>
                      </div>
                      {logicPropertyEnabled ? (
                        <>
                          <Alert
                            message="配置在发布前保存，只有指标发布成功后才会正式生效。"
                            showIcon
                            type="info"
                          />
                          <div className={styles.logicPropertyFields}>
                            <Form.Item
                              label="属性名称"
                              name="logicPropertyName"
                              rules={[
                                { required: true, message: "请输入逻辑属性名称" },
                                {
                                  pattern: /^[a-z][a-z0-9_]*$/,
                                  message: "使用小写字母、数字和下划线，并以字母开头",
                                },
                              ]}
                            >
                              <Input placeholder="例如：offline_order_amount" />
                            </Form.Item>
                            <Form.Item
                              label="显示名称"
                              name="logicPropertyDisplayName"
                              rules={[{ required: true, message: "请输入逻辑属性显示名称" }]}
                            >
                              <Input placeholder="例如：线下门店订单金额" />
                            </Form.Item>
                            <Form.Item
                              className={styles.full}
                              label="属性说明（可选）"
                              name="logicPropertyComment"
                            >
                              <Input.TextArea
                                maxLength={500}
                                placeholder="说明该属性在对象详情、规则或应用中的用途"
                                rows={2}
                              />
                            </Form.Item>
                          </div>
                        </>
                      ) : (
                        <p className={styles.logicPropertyDisabledHint}>
                          关闭时只发布指标，不创建逻辑属性；发布后仍可在指标详情页补充配置。
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </Section>

          <Section
            title="5. 校验与发布"
            tooltip={
              metricType === "atomic"
                ? "检查基本信息、计算范围、取值或聚合方式、结果类型和单位是否完整且一致；检查通过后才能发布当前版本。"
                : "语义校验会检查配置完整性和依赖有效性；校验通过后才能发布当前版本。"
            }
          >
            <Space wrap>
              <Button onClick={() => void validate()}>
                {metricType === "atomic" ? "检查配置" : "语义校验"}
              </Button>
              <Button onClick={() => void openTrial()}>试算真实数据</Button>
              <Button onClick={() => void openPreview()}>
                {metricType === "atomic" ? "预览结果结构" : "查看返回契约"}
              </Button>
            </Space>
            {formValidationIssueCount ? (
              <Alert
                className={styles.issues}
                description="请先处理表单中标红的必填项或格式问题，然后重新校验。"
                message={`发现 ${formValidationIssueCount} 个表单问题`}
                showIcon
                type="error"
              />
            ) : validation ? (
              <Alert
                className={styles.issues}
                message={
                  validation.valid ? "校验通过，可以发布" : `发现 ${validationIssues.length} 个问题`
                }
                type={validation.valid ? "success" : "error"}
                showIcon
                description={
                  validationIssues.length ? (
                    <ul className={styles.validationIssueList}>
                      {presentedValidationIssues.map((issue, index) => (
                        <li key={`${issue.location}-${issue.problem}-${index}`}>
                          <strong>{issue.location}</strong>
                          <span>{issue.problem}</span>
                          <span className={styles.validationSuggestion}>
                            处理建议：{issue.suggestion}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : undefined
                }
              />
            ) : null}
            <div className={styles.publishActions}>
              <Button loading={saving} onClick={() => void save()}>
                保存草稿
              </Button>
              <Button loading={saving} onClick={() => void publish()} type="primary">
                {logicPropertyEnabled && effectiveCalculationScope === "object_instance"
                  ? "发布指标并创建逻辑属性"
                  : "发布指标"}
              </Button>
            </div>
          </Section>
        </Form>
      </div>
      <Drawer
        onClose={() => setPreview(undefined)}
        open={Boolean(preview)}
        title="指标返回契约"
        width={520}
      >
        {preview ? (
          <>
            <Alert
              message={preview.validation.valid ? "返回契约有效" : "返回契约尚未通过校验"}
              type={preview.validation.valid ? "success" : "warning"}
              showIcon
            />
            <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(preview.output_schema, null, 2)}
            </pre>
          </>
        ) : null}
      </Drawer>
      {trialDefinition ? (
        <ObjectMetricTrialDrawer
          definition={trialDefinition}
          mode="draft"
          objectType={ownerObjectTypeDetail}
          onClose={() => setTrialDefinition(undefined)}
          onRun={(query) => trialObjectMetricDataV1(networkId, trialDefinition, query)}
          open
        />
      ) : null}
    </main>
  );
}
