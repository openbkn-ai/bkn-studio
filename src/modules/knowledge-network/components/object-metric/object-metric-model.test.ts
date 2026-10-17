/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE in the project root for details.
 */

import { describe, expect, it } from "vitest";

import {
  expressionLabel,
  expressionReferencesProperty,
  inferCompositeExpressionValueV1,
  replaceObjectMetricDependencyAliases,
} from "./object-metric-model";

describe("replaceObjectMetricDependencyAliases", () => {
  it("formats nested property expressions with a business label only when requested", () => {
    const expression = {
      node_type: "binary" as const,
      operator: "add" as const,
      left: {
        node_type: "property" as const,
        property_ref: { object_type_id: "order", property_name: "paid_amount" },
      },
      right: { node_type: "literal" as const, value: 1, value_type: "int64" },
    };
    expect(
      expressionLabel(expression, (reference) =>
        reference.property_name === "paid_amount" ? "实付金额" : reference.property_name,
      ),
    ).toBe("(实付金额 + 1)");
    expect(expressionLabel(expression)).toBe("(order.paid_amount + 1)");
  });

  it("builds a business formula without changing the stored technical expression", () => {
    const expression = {
      left: { dependency_alias: "qualified", node_type: "dependency" as const },
      node_type: "binary" as const,
      operator: "divide" as const,
      right: { dependency_alias: "total", node_type: "dependency" as const },
    };

    const businessExpression = replaceObjectMetricDependencyAliases(expression, {
      qualified: "限定订单数",
      total: "订单总数",
    });

    expect(expressionLabel(businessExpression)).toBe("(限定订单数 ÷ 订单总数)");
    expect(expressionLabel(expression)).toBe("(qualified ÷ total)");
  });
});

describe("expressionReferencesProperty", () => {
  it("does not treat a constant-only expression as an atomic data fact", () => {
    expect(
      expressionReferencesProperty({
        arguments: [{ node_type: "literal", value: 0, value_type: "decimal" }],
        function: "abs",
        node_type: "call",
      }),
    ).toBe(false);
  });

  it("finds an object property nested inside a formula", () => {
    expect(
      expressionReferencesProperty({
        arguments: [
          {
            left: {
              node_type: "property",
              property_ref: { object_type_id: "order", property_name: "amount" },
            },
            node_type: "binary",
            operator: "subtract",
            right: { node_type: "literal", value: 20, value_type: "decimal" },
          },
        ],
        function: "abs",
        node_type: "call",
      }),
    ).toBe(true);
  });

  it("rejects an unfinished property selection", () => {
    expect(
      expressionReferencesProperty({
        node_type: "property",
        property_ref: { object_type_id: "order", property_name: "" },
      }),
    ).toBe(false);
  });
});

describe("inferCompositeExpressionValueV1", () => {
  const countValue = {
    physical_type: "int64" as const,
    semantic_type: "count" as const,
    unit: {
      code: "1",
      quantity_kind: "count" as const,
      scale_factor: 1,
      system: "UCUM" as const,
    },
  };

  it("keeps integer count semantics when two count dependencies are added", () => {
    expect(
      inferCompositeExpressionValueV1(
        {
          left: { dependency_alias: "orders", node_type: "dependency" },
          node_type: "binary",
          operator: "add",
          right: { dependency_alias: "cancelled", node_type: "dependency" },
        },
        { cancelled: countValue, orders: countValue },
      ),
    ).toEqual({ physicalType: "int64", unit: countValue.unit, unitKnown: true });
  });

  it("promotes division to a dimensionless decimal result", () => {
    expect(
      inferCompositeExpressionValueV1(
        {
          left: { dependency_alias: "cancelled", node_type: "dependency" },
          node_type: "binary",
          operator: "divide",
          right: { dependency_alias: "orders", node_type: "dependency" },
        },
        { cancelled: countValue, orders: countValue },
      ),
    ).toEqual({ physicalType: "decimal", unitKnown: true });
  });
});
