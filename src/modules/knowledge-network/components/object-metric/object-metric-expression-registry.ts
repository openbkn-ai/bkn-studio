/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE in the project root for details.
 */

import type { ObjectMetricExpressionV1 } from "@/modules/knowledge-network/types/object-metric";

import type { ObjectMetricExpressionPropertyOption } from "./ObjectMetricExpressionEditor";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";

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
        get description() {
          return objectMetricText("mbb9b93472f87");
        },
        key: "value",
        get label() {
          return objectMetricText("m060168b295c3");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("mcddc9bab8af7");
    },
    get label() {
      return objectMetricText("mb7f34a5c6f75");
    },
    maxArguments: 1,
    minArguments: 1,
    value: "to_number",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("mf62d01efa483");
        },
        key: "value",
        get label() {
          return objectMetricText("me478c4467c76");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m87d0314e99a4");
    },
    get label() {
      return objectMetricText("mcee3428b51b6");
    },
    maxArguments: 1,
    minArguments: 1,
    value: "abs",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("m2d57e50aac3a");
        },
        key: "value",
        get label() {
          return objectMetricText("me478c4467c76");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m9f9f0fbd346d");
    },
    get label() {
      return objectMetricText("m2534ac6ed23d");
    },
    maxArguments: 1,
    minArguments: 1,
    value: "ceil",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("m9155d8ef186e");
        },
        key: "value",
        get label() {
          return objectMetricText("me478c4467c76");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m22d9bb29cf30");
    },
    get label() {
      return objectMetricText("m2db59b7b2c50");
    },
    maxArguments: 1,
    minArguments: 1,
    value: "floor",
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("mea125ab78e8e");
        },
        key: "value",
        get label() {
          return objectMetricText("me478c4467c76");
        },
        required: true,
      },
      {
        acceptedTypes: ["int64"],
        get description() {
          return objectMetricText("mbfc3952c663d");
        },
        key: "precision",
        get label() {
          return objectMetricText("m12dad8f35995");
        },
        literalOnly: true,
        numericMaximum: 15,
        numericMinimum: 0,
        required: false,
      },
    ],
    get description() {
      return objectMetricText("m085f954802f7");
    },
    get label() {
      return objectMetricText("m9c09e447599c");
    },
    maxArguments: 2,
    minArguments: 1,
    value: "round",
  },
  {
    arguments: [
      {
        acceptedTypes: "any",
        get description() {
          return objectMetricText("mbd547cfc1314");
        },
        key: "value",
        get label() {
          return objectMetricText("m74d205a9890c");
        },
        required: true,
      },
      {
        acceptedTypes: "same_as_first",
        get description() {
          return objectMetricText("medad6e45fe45");
        },
        key: "fallback",
        get label() {
          return objectMetricText("mc5a03548c515");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m0e1cfcf3cc72");
    },
    get label() {
      return objectMetricText("m28db31c2885a");
    },
    minArguments: 2,
    value: "coalesce",
    variadicArgument: {
      acceptedTypes: "same_as_first",
      get description() {
        return objectMetricText("m4e5e9c229784");
      },
      key: "fallback",
      get label() {
        return objectMetricText("m52196184367c");
      },
      required: false,
    },
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("m974232760cd2");
        },
        key: "first",
        get label() {
          return objectMetricText("m1698e5558918");
        },
        required: true,
      },
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("m0ff300e79da2");
        },
        key: "second",
        get label() {
          return objectMetricText("ma05e4b683261");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m5d76b4c1c837");
    },
    get label() {
      return objectMetricText("me462a39ea0a4");
    },
    minArguments: 2,
    value: "greatest",
    variadicArgument: {
      acceptedTypes: numericTypes,
      get description() {
        return objectMetricText("m077d5820994f");
      },
      key: "comparison",
      get label() {
        return objectMetricText("m575886e0a64f");
      },
      required: false,
    },
  },
  {
    arguments: [
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("m974232760cd2");
        },
        key: "first",
        get label() {
          return objectMetricText("m1698e5558918");
        },
        required: true,
      },
      {
        acceptedTypes: numericTypes,
        get description() {
          return objectMetricText("m0ff300e79da2");
        },
        key: "second",
        get label() {
          return objectMetricText("ma05e4b683261");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m642c8f861853");
    },
    get label() {
      return objectMetricText("m16d697fe5749");
    },
    minArguments: 2,
    value: "least",
    variadicArgument: {
      acceptedTypes: numericTypes,
      get description() {
        return objectMetricText("m077d5820994f");
      },
      key: "comparison",
      get label() {
        return objectMetricText("m575886e0a64f");
      },
      required: false,
    },
  },
  {
    arguments: [
      {
        acceptedTypes: temporalTypes,
        get description() {
          return objectMetricText("m96dd8744d1ad");
        },
        key: "start",
        get label() {
          return objectMetricText("m6a9906c79f26");
        },
        required: true,
      },
      {
        acceptedTypes: temporalTypes,
        get description() {
          return objectMetricText("m381bf1d364cd");
        },
        key: "end",
        get label() {
          return objectMetricText("mf50276449943");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m2325b7be968f");
    },
    get label() {
      return objectMetricText("ma44781c1f2bd");
    },
    maxArguments: 2,
    minArguments: 2,
    value: "duration_between",
  },
  {
    arguments: [
      {
        acceptedTypes: temporalTypes,
        get description() {
          return objectMetricText("m341f74261248");
        },
        key: "start",
        get label() {
          return objectMetricText("m6a9906c79f26");
        },
        required: true,
      },
      {
        acceptedTypes: temporalTypes,
        get description() {
          return objectMetricText("m3cd1ba7c7bb0");
        },
        key: "end",
        get label() {
          return objectMetricText("mf50276449943");
        },
        required: true,
      },
      {
        acceptedTypes: ["string"],
        choices: [
          {
            get label() {
              return objectMetricText("m49da61ceeea2");
            },
            value: "day",
          },
          {
            get label() {
              return objectMetricText("m3b6fefc50feb");
            },
            value: "hour",
          },
          {
            get label() {
              return objectMetricText("mbd957bc497aa");
            },
            value: "minute",
          },
          {
            get label() {
              return objectMetricText("m9dcdc2b289b9");
            },
            value: "second",
          },
          {
            get label() {
              return objectMetricText("m9659733917ec");
            },
            value: "millisecond",
          },
        ],
        get description() {
          return objectMetricText("mdbd59bd3b875");
        },
        key: "unit",
        get label() {
          return objectMetricText("m3e2578483aff");
        },
        literalOnly: true,
        required: false,
      },
    ],
    get description() {
      return objectMetricText("m13aaab555585");
    },
    get label() {
      return objectMetricText("meaa5b30c6bcb");
    },
    maxArguments: 3,
    minArguments: 2,
    value: "date_diff",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        choices: [
          {
            get label() {
              return objectMetricText("m62ef900a8f5d");
            },
            value: "year",
          },
          {
            get label() {
              return objectMetricText("m1625179badc0");
            },
            value: "month",
          },
          {
            get label() {
              return objectMetricText("m85217f7aff77");
            },
            value: "day",
          },
          {
            get label() {
              return objectMetricText("m3b6fefc50feb");
            },
            value: "hour",
          },
          {
            get label() {
              return objectMetricText("mbd957bc497aa");
            },
            value: "minute",
          },
          {
            get label() {
              return objectMetricText("m9dcdc2b289b9");
            },
            value: "second",
          },
        ],
        get description() {
          return objectMetricText("m80db7c6b51a5");
        },
        key: "part",
        get label() {
          return objectMetricText("m89cef51cab67");
        },
        literalOnly: true,
        required: true,
      },
      {
        acceptedTypes: temporalTypes,
        get description() {
          return objectMetricText("m629f63ba0f43");
        },
        key: "value",
        get label() {
          return objectMetricText("m830413e761d9");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("ma2461e8df8b2");
    },
    get label() {
      return objectMetricText("me58e6c796523");
    },
    maxArguments: 2,
    minArguments: 2,
    value: "date_part",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        get description() {
          return objectMetricText("m7249e5f788ed");
        },
        key: "value",
        get label() {
          return objectMetricText("m1aed2e7286fb");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("m7929f23be1d7");
    },
    get label() {
      return objectMetricText("m6ccf5f80a503");
    },
    maxArguments: 1,
    minArguments: 1,
    value: "lower",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        get description() {
          return objectMetricText("m9bf8a52e2724");
        },
        key: "value",
        get label() {
          return objectMetricText("m1aed2e7286fb");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("mea62f3ddeb79");
    },
    get label() {
      return objectMetricText("mc601dee5e036");
    },
    maxArguments: 1,
    minArguments: 1,
    value: "upper",
  },
  {
    arguments: [
      {
        acceptedTypes: ["string"],
        get description() {
          return objectMetricText("mce0223af4256");
        },
        key: "value",
        get label() {
          return objectMetricText("m1aed2e7286fb");
        },
        required: true,
      },
    ],
    get description() {
      return objectMetricText("mdbaf0119cf41");
    },
    get label() {
      return objectMetricText("m06acfd88eefe");
    },
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
      description: objectMetricText("m4158771021a4"),
      key: `argument_${index + 1}`,
      label: objectMetricText("ma80a5b61e0bd", { p0: index + 1 }),
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
      (property?.label.split(" · ")[0] ?? expression.property_ref.property_name) ||
      objectMetricText("mdf3320ad0747")
    );
  }
  if (expression.node_type === "dependency")
    return expression.dependency_alias || objectMetricText("m07d6d224888a");
  if (expression.node_type === "literal") {
    if (expression.value_type === "string") {
      return `“${displayLiteralValue(expression.value, "")}”`;
    }
    if (expression.value_type === "boolean")
      return expression.value
        ? objectMetricText("mb5141d3d19e9")
        : objectMetricText("m0c70665b6eb6");
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
