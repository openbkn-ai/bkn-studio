/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE in the project root for details.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import type { ObjectMetricExpressionV1 } from "@/modules/knowledge-network/types/object-metric";

import {
  acceptedTypesForArgument,
  compatibleProperties,
  defaultLiteralForArgument,
  expressionReferencesProperty,
  expressionValueType,
  formatObjectMetricExpression,
  functionArgumentAt,
  normalizeExpressionValueType,
  objectMetricFunctionDefinitions,
} from "./object-metric-expression-registry";

const properties = [
  {
    label: "实付金额 · payment_amount",
    objectTypeId: "order",
    propertyName: "payment_amount",
    propertyType: "decimal",
  },
  {
    label: "订单数量 · item_count",
    objectTypeId: "order",
    propertyName: "item_count",
    propertyType: "integer",
  },
  {
    label: "订单状态 · status",
    objectTypeId: "order",
    propertyName: "status",
    propertyType: "string",
  },
  {
    label: "完成时间 · complete_time",
    objectTypeId: "order",
    propertyName: "complete_time",
    propertyType: "datetime",
  },
];

function literal(valueType: "decimal" | "int64" | "string", value: number | string) {
  return { node_type: "literal", value, value_type: valueType } as const;
}

describe("object metric expression registry", () => {
  it("resolves function labels in the current language after a locale switch", async () => {
    try {
      await i18n.changeLanguage("zh-CN");
      expect(objectMetricFunctionDefinitions[0].label).toBe("转数值");
      await i18n.changeLanguage("en-US");
      expect(objectMetricFunctionDefinitions[0].label).toBe("Convert to number");
    } finally {
      await i18n.changeLanguage("zh-CN");
    }
  });

  it("covers every function advertised by the V1 backend registry", () => {
    expect(objectMetricFunctionDefinitions.map((item) => item.value)).toEqual([
      "to_number",
      "abs",
      "ceil",
      "floor",
      "round",
      "coalesce",
      "greatest",
      "least",
      "duration_between",
      "date_diff",
      "date_part",
      "lower",
      "upper",
      "length",
    ]);
    expect(
      objectMetricFunctionDefinitions.every(
        (item) => item.label && item.description && item.arguments.length >= item.minArguments,
      ),
    ).toBe(true);
  });

  it.each([
    ["to_number", 1, 1],
    ["abs", 1, 1],
    ["ceil", 1, 1],
    ["floor", 1, 1],
    ["round", 1, 2],
    ["coalesce", 2, undefined],
    ["greatest", 2, undefined],
    ["least", 2, undefined],
    ["duration_between", 2, 2],
    ["date_diff", 2, 3],
    ["date_part", 2, 2],
    ["lower", 1, 1],
    ["upper", 1, 1],
    ["length", 1, 1],
  ])("declares the backend arity for %s", (name, minimum, maximum) => {
    const definition = objectMetricFunctionDefinitions.find((item) => item.value === name);
    expect(definition).toMatchObject({ minArguments: minimum });
    expect(definition?.maxArguments).toBe(maximum);
  });

  it.each([
    ["integer", "int64"],
    ["bigint", "int64"],
    ["float32", "decimal"],
    ["number", "decimal"],
    ["bool", "boolean"],
    ["timestamp", "datetime"],
    ["interval", "duration"],
    ["keyword", "string"],
  ])("normalizes %s to %s", (source, expected) => {
    expect(normalizeExpressionValueType(source)).toBe(expected);
  });

  it("uses the first argument type for same-type variadic arguments", () => {
    const coalesce = objectMetricFunctionDefinitions.find((item) => item.value === "coalesce");
    expect(coalesce).toBeDefined();
    expect(acceptedTypesForArgument(functionArgumentAt(coalesce!, 1), "string")).toEqual([
      "string",
    ]);
    expect(acceptedTypesForArgument(functionArgumentAt(coalesce!, 4), "decimal")).toEqual([
      "decimal",
    ]);
  });

  it("builds deterministic defaults for numeric, boolean and choice-only arguments", () => {
    expect(
      defaultLiteralForArgument({
        acceptedTypes: ["boolean"],
        description: "",
        key: "flag",
        label: "flag",
        required: true,
      }),
    ).toEqual({ node_type: "literal", value: false, value_type: "boolean" });
    expect(
      defaultLiteralForArgument({
        acceptedTypes: ["decimal"],
        description: "",
        key: "amount",
        label: "amount",
        required: true,
      }),
    ).toEqual({ node_type: "literal", value: 0, value_type: "decimal" });
    const dateDiff = objectMetricFunctionDefinitions.find((item) => item.value === "date_diff");
    expect(defaultLiteralForArgument(functionArgumentAt(dateDiff!, 2))).toEqual({
      node_type: "literal",
      value: "day",
      value_type: "string",
    });
  });

  it("filters property choices by the exact accepted value types", () => {
    expect(
      compatibleProperties(properties, ["decimal", "int64"]).map((item) => item.propertyName),
    ).toEqual(["payment_amount", "item_count"]);
    expect(compatibleProperties(properties, ["datetime"]).map((item) => item.propertyName)).toEqual(
      ["complete_time"],
    );
  });

  it.each([
    ["add", "int64"],
    ["subtract", "int64"],
    ["multiply", "int64"],
    ["modulo", "int64"],
    ["divide", "decimal"],
  ] as const)("infers %s over integers as %s", (operator, expected) => {
    expect(
      expressionValueType(
        {
          left: literal("int64", 7),
          node_type: "binary",
          operator,
          right: literal("int64", 2),
        },
        properties,
      ),
    ).toBe(expected);
  });

  it.each([
    ["to_number", [literal("string", "12")], "decimal"],
    ["abs", [literal("decimal", -2)], "decimal"],
    ["round", [literal("decimal", 1.25), literal("int64", 1)], "decimal"],
    ["coalesce", [literal("string", ""), literal("string", "fallback")], "string"],
    ["date_diff", [literal("string", "2026-01-01"), literal("string", "2026-01-02")], "duration"],
    ["date_part", [literal("string", "year"), literal("string", "2026-01-01")], "int64"],
    ["lower", [literal("string", "ABC")], "string"],
    ["upper", [literal("string", "abc")], "string"],
    ["length", [literal("string", "订单")], "int64"],
  ] as const)("infers the %s result as %s", (functionName, args, expected) => {
    expect(
      expressionValueType(
        { arguments: [...args], function: functionName, node_type: "call" },
        properties,
      ),
    ).toBe(expected);
  });

  it("formats every arithmetic symbol without leaking technical enum names", () => {
    const labels = [
      ["add", "+"],
      ["subtract", "−"],
      ["multiply", "×"],
      ["divide", "÷"],
      ["modulo", "%"],
    ] as const;
    for (const [operator, symbol] of labels) {
      const expression: ObjectMetricExpressionV1 = {
        left: literal("int64", 7),
        node_type: "binary",
        operator,
        right: literal("int64", 2),
      };
      expect(formatObjectMetricExpression(expression, properties)).toBe(`(7 ${symbol} 2)`);
    }
  });

  it("finds property references through nested calls, unary and binary nodes", () => {
    const property: ObjectMetricExpressionV1 = {
      node_type: "property",
      property_ref: { object_type_id: "order", property_name: "payment_amount" },
    };
    expect(
      expressionReferencesProperty({
        arguments: [
          {
            left: literal("decimal", 1),
            node_type: "binary",
            operator: "add",
            right: { left: property, node_type: "unary", operator: "negate" },
          },
        ],
        function: "abs",
        node_type: "call",
      }),
    ).toBe(true);
  });
});
