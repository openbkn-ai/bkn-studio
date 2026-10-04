/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE in the project root for details.
 */

import type { ObjectMetricExpressionV1 } from "@/modules/knowledge-network/types/object-metric";

import type { ObjectMetricExpressionPropertyOption } from "./ObjectMetricExpressionEditor";

export type ExpressionValueType =
  "boolean" | "date" | "datetime" | "decimal" | "duration" | "int64" | "string";

export type FunctionArgumentDefinition = {
  acceptedTypes: ExpressionValueType[] | "any" | "same_as_first";
  choices?: Array<{ label: string; value: string }>;
  description: string;
  key: string;
  label: string;
  literalOnly?: boolean;
  numericMaximum?: number;
  numericMinimum?: number;
  required: boolean;
};

export type ObjectMetricFunctionDefinition = {
  arguments: FunctionArgumentDefinition[];
  description: string;
  label: string;
  maxArguments?: number;
  minArguments: number;
  value: string;
  variadicArgument?: FunctionArgumentDefinition;
};

const numericTypes: ExpressionValueType[] = ["int64", "decimal"];
const temporalTypes: ExpressionValueType[] = ["date", "datetime"];

export const objectMetricFunctionDefinitions: ObjectMetricFunctionDefinition[] = [
  {
    arguments: [
      {
        acceptedTypes: ["string", "int64", "decimal"],
        description: "选择以文本存储、但业务上表示数字的属性；原生数值也可保持原值。",
        key: "value",
        label: "待转换属性",
        required: true,
      },
    ],
    description: "严格将数字文本转换为数值；无法转换时拒绝计算并指出异常值。",
    label: "转数值",
    maxArguments: 1,
    minArguments: 1,
    value: "to_number",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        description: "选择需要转换为绝对值的数值属性或数值。",
        key: "value",
        label: "待处理数值",
        required: true,
      },
    ],
    description: "返回数值去除正负号后的结果。",
    label: "绝对值",
    maxArguments: 1,
    minArguments: 1,
    value: "abs",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        description: "选择需要向上取整的数值属性或数值。",
        key: "value",
        label: "待处理数值",
        required: true,
      },
    ],
    description: "返回大于或等于原数值的最小整数。",
    label: "向上取整",
    maxArguments: 1,
    minArguments: 1,
    value: "ceil",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        description: "选择需要向下取整的数值属性或数值。",
        key: "value",
        label: "待处理数值",
        required: true,
      },
    ],
    description: "返回小于或等于原数值的最大整数。",
    label: "向下取整",
    maxArguments: 1,
    minArguments: 1,
    value: "floor",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        description: "选择需要四舍五入的数值属性或数值。",
        key: "value",
        label: "待处理数值",
        required: true,
      },
      {
        acceptedTypes: ["int64"],
        description: "填写 0～15；0 表示取整，2 表示保留两位小数。",
        key: "precision",
        label: "保留小数位",
        literalOnly: true,
        numericMaximum: 15,
        numericMinimum: 0,
        required: false,
      },
    ],
    description: "按指定小数位对数值进行四舍五入。",
    label: "四舍五入",
    maxArguments: 2,
    minArguments: 1,
    value: "round",
  },
  {
    arguments: [
      {
        acceptedTypes: "any",
        description: "优先返回这个属性或值。",
        key: "value",
        label: "原始值",
        required: true,
      },
      {
        acceptedTypes: "same_as_first",
        description: "原始值为空时返回；类型需要与原始值一致。",
        key: "fallback",
        label: "为空时返回",
        required: true,
      },
    ],
    description: "按顺序返回第一个非空值。",
    label: "空值替代",
    minArguments: 2,
    value: "coalesce",
    variadicArgument: {
      acceptedTypes: "same_as_first",
      description: "前面的值均为空时继续使用这个候选值。",
      key: "fallback",
      label: "备用值",
      required: false,
    },
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        description: "参与比较的第一个数值。",
        key: "first",
        label: "比较值 1",
        required: true,
      },
      {
        acceptedTypes: numericTypes,
        description: "参与比较的第二个数值。",
        key: "second",
        label: "比较值 2",
        required: true,
      },
    ],
    description: "返回所有比较值中的最大数值。",
    label: "取最大值",
    minArguments: 2,
    value: "greatest",
    variadicArgument: {
      acceptedTypes: numericTypes,
      description: "继续添加参与比较的数值。",
      key: "comparison",
      label: "其他比较值",
      required: false,
    },
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        description: "参与比较的第一个数值。",
        key: "first",
        label: "比较值 1",
        required: true,
      },
      {
        acceptedTypes: numericTypes,
        description: "参与比较的第二个数值。",
        key: "second",
        label: "比较值 2",
        required: true,
      },
    ],
    description: "返回所有比较值中的最小数值。",
    label: "取最小值",
    minArguments: 2,
    value: "least",
    variadicArgument: {
      acceptedTypes: numericTypes,
      description: "继续添加参与比较的数值。",
      key: "comparison",
      label: "其他比较值",
      required: false,
    },
  },
  {
    arguments: [
      {
        acceptedTypes: temporalTypes,
        description: "选择作为区间起点的日期或日期时间属性。",
        key: "start",
        label: "开始时间",
        required: true,
      },
      {
        acceptedTypes: temporalTypes,
        description: "选择作为区间终点的日期或日期时间属性。",
        key: "end",
        label: "结束时间",
        required: true,
      },
    ],
    description: "计算结束时间与开始时间之间的持续时长。",
    label: "时间间隔",
    maxArguments: 2,
    minArguments: 2,
    value: "duration_between",
  },
  {
    arguments: [
      {
        acceptedTypes: temporalTypes,
        description: "选择日期差计算的起点。",
        key: "start",
        label: "开始时间",
        required: true,
      },
      {
        acceptedTypes: temporalTypes,
        description: "选择日期差计算的终点。",
        key: "end",
        label: "结束时间",
        required: true,
      },
      {
        acceptedTypes: ["string"],
        choices: [
          { label: "天", value: "day" },
          { label: "小时", value: "hour" },
          { label: "分钟", value: "minute" },
          { label: "秒", value: "second" },
          { label: "毫秒", value: "millisecond" },
        ],
        description: "选择日期差结果使用的时间单位。",
        key: "unit",
        label: "结果单位",
        literalOnly: true,
        required: false,
      },
    ],
    description: "按指定单位计算结束时间与开始时间之差。",
    label: "日期差",
    maxArguments: 3,
    minArguments: 2,
    value: "date_diff",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        choices: [
          { label: "年", value: "year" },
          { label: "月", value: "month" },
          { label: "日", value: "day" },
          { label: "小时", value: "hour" },
          { label: "分钟", value: "minute" },
          { label: "秒", value: "second" },
        ],
        description: "选择需要从日期或日期时间中提取的部分。",
        key: "part",
        label: "提取部分",
        literalOnly: true,
        required: true,
      },
      {
        acceptedTypes: temporalTypes,
        description: "选择需要提取日期部分的属性。",
        key: "value",
        label: "日期或时间",
        required: true,
      },
    ],
    description: "从日期或日期时间中提取年、月、日等部分。",
    label: "提取日期部分",
    maxArguments: 2,
    minArguments: 2,
    value: "date_part",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        description: "选择需要转换为小写的文本属性或文本。",
        key: "value",
        label: "待处理文本",
        required: true,
      },
    ],
    description: "将文本中的字母转换为小写。",
    label: "转小写",
    maxArguments: 1,
    minArguments: 1,
    value: "lower",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        description: "选择需要转换为大写的文本属性或文本。",
        key: "value",
        label: "待处理文本",
        required: true,
      },
    ],
    description: "将文本中的字母转换为大写。",
    label: "转大写",
    maxArguments: 1,
    minArguments: 1,
    value: "upper",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        description: "选择需要计算字符数的文本属性或文本。",
        key: "value",
        label: "待处理文本",
        required: true,
      },
    ],
    description: "返回文本包含的字符数量。",
    label: "文本长度",
    maxArguments: 1,
    minArguments: 1,
    value: "length",
  },
];

export function normalizeExpressionValueType(type?: string): ExpressionValueType {
  const value = type?.toLowerCase();
  if (["integer", "int", "int32", "int64", "long", "bigint"].includes(value ?? "")) {
    return "int64";
  }
  if (["decimal", "double", "float", "float32", "float64", "number"].includes(value ?? "")) {
    return "decimal";
  }
  if (["bool", "boolean"].includes(value ?? "")) return "boolean";
  if (value === "date") return "date";
  if (["datetime", "timestamp"].includes(value ?? "")) return "datetime";
  if (["duration", "interval"].includes(value ?? "")) return "duration";
  return "string";
}

export function acceptedTypesForArgument(
  argument: FunctionArgumentDefinition,
  firstArgumentType?: ExpressionValueType,
): ExpressionValueType[] | undefined {
  if (argument.acceptedTypes === "any") return undefined;
  if (argument.acceptedTypes === "same_as_first") {
    return firstArgumentType ? [firstArgumentType] : undefined;
  }
  return argument.acceptedTypes;
}

export function functionArgumentAt(
  definition: ObjectMetricFunctionDefinition,
  index: number,
): FunctionArgumentDefinition {
  return (
    definition.arguments[index] ??
    definition.variadicArgument ?? {
      acceptedTypes: "any",
      description: "函数的附加参数。",
      key: `argument_${index + 1}`,
      label: `参数 ${index + 1}`,
      required: false,
    }
  );
}

export function expressionValueType(
  expression: ObjectMetricExpressionV1 | undefined,
  properties: ObjectMetricExpressionPropertyOption[],
  dependencyTypes: Record<string, ExpressionValueType> = {},
): ExpressionValueType | undefined {
  if (!expression) return undefined;
  if (expression.node_type === "literal") {
    return normalizeExpressionValueType(expression.value_type);
  }
  if (expression.node_type === "property") {
    const property = properties.find(
      (item) =>
        item.objectTypeId === expression.property_ref.object_type_id &&
        item.propertyName === expression.property_ref.property_name,
    );
    return property ? normalizeExpressionValueType(property.propertyType) : undefined;
  }
  if (expression.node_type === "dependency") {
    return dependencyTypes[expression.dependency_alias];
  }
  if (expression.node_type === "unary") {
    return expressionValueType(expression.left, properties, dependencyTypes);
  }
  if (expression.node_type === "binary") {
    const left = expressionValueType(expression.left, properties, dependencyTypes);
    const right = expressionValueType(expression.right, properties, dependencyTypes);
    if (!left || !right) return undefined;
    if (!["decimal", "duration", "int64"].includes(left)) return undefined;
    if (!["decimal", "duration", "int64"].includes(right)) return undefined;
    if (expression.operator === "divide" || left === "decimal" || right === "decimal") {
      return "decimal";
    }
    if (left === "duration" && right === "duration") return "duration";
    return "int64";
  }
  const firstArgumentType = expressionValueType(
    expression.arguments[0],
    properties,
    dependencyTypes,
  );
  if (
    ["abs", "ceil", "coalesce", "floor", "greatest", "least", "round"].includes(expression.function)
  ) {
    return firstArgumentType;
  }
  if (expression.function === "to_number") return "decimal";
  if (["date_diff", "duration_between"].includes(expression.function)) return "duration";
  if (["date_part", "length"].includes(expression.function)) return "int64";
  if (["lower", "upper"].includes(expression.function)) return "string";
  return undefined;
}

export function defaultLiteralForArgument(
  argument: FunctionArgumentDefinition,
  firstArgumentType?: ExpressionValueType,
): Extract<ObjectMetricExpressionV1, { node_type: "literal" }> {
  if (argument.choices?.length) {
    return {
      node_type: "literal",
      value: argument.choices[0]?.value ?? "",
      value_type: "string",
    };
  }
  const accepted = acceptedTypesForArgument(argument, firstArgumentType);
  const valueType = accepted?.[0] ?? firstArgumentType ?? "decimal";
  return {
    node_type: "literal",
    value:
      valueType === "boolean"
        ? false
        : ["decimal", "duration", "int64"].includes(valueType)
          ? 0
          : "",
    value_type: valueType,
  };
}

export function compatibleProperties(
  properties: ObjectMetricExpressionPropertyOption[],
  acceptedTypes?: ExpressionValueType[],
) {
  if (!acceptedTypes?.length) return properties;
  const accepted = new Set(acceptedTypes);
  return properties.filter((item) => accepted.has(normalizeExpressionValueType(item.propertyType)));
}

export function expressionReferencesProperty(expression: ObjectMetricExpressionV1): boolean {
  if (expression.node_type === "property") return Boolean(expression.property_ref.property_name);
  if (expression.node_type === "call") {
    return expression.arguments.some(expressionReferencesProperty);
  }
  if (expression.node_type === "unary") return expressionReferencesProperty(expression.left);
  if (expression.node_type === "binary") {
    return (
      expressionReferencesProperty(expression.left) ||
      expressionReferencesProperty(expression.right)
    );
  }
  return false;
}

function displayLiteralValue(value: unknown, fallback: string) {
  if (value === null || value === undefined) return fallback;
  if (["boolean", "number", "string"].includes(typeof value)) {
    return `${value as boolean | number | string}`;
  }
  return fallback;
}

export function formatObjectMetricExpression(
  expression: ObjectMetricExpressionV1,
  properties: ObjectMetricExpressionPropertyOption[],
): string {
  if (expression.node_type === "property") {
    const property = properties.find(
      (item) =>
        item.objectTypeId === expression.property_ref.object_type_id &&
        item.propertyName === expression.property_ref.property_name,
    );
    return (
      (property?.label.split(" · ")[0] ?? expression.property_ref.property_name) || "未选择属性"
    );
  }
  if (expression.node_type === "dependency") return expression.dependency_alias || "未选择指标";
  if (expression.node_type === "literal") {
    if (expression.value_type === "string") {
      return `“${displayLiteralValue(expression.value, "")}”`;
    }
    if (expression.value_type === "boolean") return expression.value ? "是" : "否";
    return displayLiteralValue(expression.value, "0");
  }
  if (expression.node_type === "unary") {
    return `−${formatObjectMetricExpression(expression.left, properties)}`;
  }
  if (expression.node_type === "binary") {
    const operator = {
      add: "+",
      divide: "÷",
      modulo: "%",
      multiply: "×",
      subtract: "−",
    }[expression.operator];
    return `(${formatObjectMetricExpression(expression.left, properties)} ${operator} ${formatObjectMetricExpression(expression.right, properties)})`;
  }
  const definition = objectMetricFunctionDefinitions.find(
    (item) => item.value === expression.function,
  );
  const name = definition?.label ?? expression.function;
  return `${name}(${expression.arguments
    .map((argument) => formatObjectMetricExpression(argument, properties))
    .join("，")})`;
}
