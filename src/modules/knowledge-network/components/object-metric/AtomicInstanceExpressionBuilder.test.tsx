/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE in the project root for details.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ObjectMetricExpressionV1 } from "@/modules/knowledge-network/types/object-metric";

import { AtomicInstanceExpressionBuilder } from "./AtomicInstanceExpressionBuilder";
import { objectMetricPropertyExpression } from "./object-metric-model";
import {
  defaultLiteralForArgument,
  expressionValueType,
  functionArgumentAt,
  objectMetricFunctionDefinitions,
} from "./object-metric-expression-registry";

const properties = [
  {
    label: "订单金额 · total_amount",
    objectTypeId: "order",
    propertyName: "total_amount",
    propertyType: "decimal",
  },
  {
    label: "创建时间 · created_at",
    objectTypeId: "order",
    propertyName: "created_at",
    propertyType: "datetime",
  },
  {
    label: "商品名称 · product_name",
    objectTypeId: "order",
    propertyName: "product_name",
    propertyType: "string",
  },
];

const amountProperty: ObjectMetricExpressionV1 = {
  node_type: "property",
  property_ref: { object_type_id: "order", property_name: "total_amount" },
};

afterEach(cleanup);

describe("AtomicInstanceExpressionBuilder", () => {
  it("renders business parameter names and a readable formula preview", () => {
    render(
      <AtomicInstanceExpressionBuilder
        onChange={vi.fn()}
        properties={properties}
        value={{
          arguments: [amountProperty, { node_type: "literal", value: 2, value_type: "int64" }],
          function: "round",
          node_type: "call",
        }}
      />,
    );

    expect(screen.getByText("待处理数值")).toBeInTheDocument();
    expect(screen.getByText("保留小数位")).toBeInTheDocument();
    expect(screen.getByText("四舍五入(订单金额，2)")).toBeInTheDocument();
    expect(screen.queryByText("编辑方式")).not.toBeInTheDocument();
    expect(screen.queryByText("高级公式")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "使用高级公式" })).not.toBeInTheDocument();
  });

  it("does not carry an incompatible text property into a numeric calculation", () => {
    const onChange = vi.fn();
    render(
      <AtomicInstanceExpressionBuilder
        onChange={onChange}
        properties={properties}
        value={{
          node_type: "property",
          property_ref: { object_type_id: "order", property_name: "product_name" },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "四则运算" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        left: {
          node_type: "property",
          property_ref: { object_type_id: "order", property_name: "" },
          value_type: "decimal",
        },
        node_type: "binary",
      }),
    );
  });

  it("does not expose an internal property key for an incompatible saved operand", () => {
    render(
      <AtomicInstanceExpressionBuilder
        onChange={vi.fn()}
        properties={properties}
        value={{
          left: {
            node_type: "property",
            property_ref: { object_type_id: "order", property_name: "product_name" },
          },
          node_type: "binary",
          operator: "subtract",
          right: { node_type: "literal", value: 0, value_type: "decimal" },
        }}
      />,
    );

    expect(screen.queryByText('["order","product_name"]')).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "对象属性" })).toHaveValue("");
  });

  it("shows only mathematical symbols in the operator selector", () => {
    render(
      <AtomicInstanceExpressionBuilder
        onChange={vi.fn()}
        properties={properties}
        value={{
          left: amountProperty,
          node_type: "binary",
          operator: "subtract",
          right: { node_type: "literal", value: 0, value_type: "decimal" },
        }}
      />,
    );

    const operator = screen.getByRole("combobox", { name: "运算符" });
    expect(screen.getByText("−")).toBeInTheDocument();
    expect(screen.queryByText("减 −")).not.toBeInTheDocument();

    fireEvent.mouseDown(operator);
    expect(screen.getByRole("option", { name: "＋" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "−" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "×" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "÷" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "%" })).toBeInTheDocument();
  });

  it("renders an explicit text-to-number operand with business-readable semantics", () => {
    render(
      <AtomicInstanceExpressionBuilder
        onChange={vi.fn()}
        properties={properties}
        value={{
          left: {
            arguments: [
              {
                node_type: "property",
                property_ref: { object_type_id: "order", property_name: "product_name" },
              },
            ],
            function: "to_number",
            node_type: "call",
          },
          node_type: "binary",
          operator: "subtract",
          right: { node_type: "literal", value: 0, value_type: "decimal" },
        }}
      />,
    );

    expect(screen.getByText("文本转数值")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "转数值属性" })).toBeInTheDocument();
    expect(screen.getByText("(转数值(商品名称) − 0)")).toBeInTheDocument();
  });

  it("stores the selected property's declared value type for runtime normalization", () => {
    expect(objectMetricPropertyExpression("order", "total_amount", "float64")).toEqual({
      node_type: "property",
      property_ref: { object_type_id: "order", property_name: "total_amount" },
      value_type: "decimal",
    });
  });
});

describe("object metric expression registry", () => {
  it("defines the round precision and date difference unit explicitly", () => {
    const round = objectMetricFunctionDefinitions.find((item) => item.value === "round")!;
    const dateDiff = objectMetricFunctionDefinitions.find((item) => item.value === "date_diff")!;

    expect(functionArgumentAt(round, 1)).toMatchObject({
      label: "保留小数位",
      literalOnly: true,
      numericMaximum: 15,
      numericMinimum: 0,
    });
    expect(defaultLiteralForArgument(functionArgumentAt(dateDiff, 2))).toMatchObject({
      value: "day",
      value_type: "string",
    });
  });

  it("infers the result type of basic calculations", () => {
    expect(
      expressionValueType(
        {
          arguments: [
            {
              node_type: "property",
              property_ref: { object_type_id: "order", property_name: "product_name" },
            },
          ],
          function: "to_number",
          node_type: "call",
        },
        properties,
      ),
    ).toBe("decimal");
    expect(
      expressionValueType(
        {
          left: amountProperty,
          node_type: "binary",
          operator: "divide",
          right: { node_type: "literal", value: 100, value_type: "int64" },
        },
        properties,
      ),
    ).toBe("decimal");
    expect(
      expressionValueType(
        {
          arguments: [
            {
              node_type: "property",
              property_ref: { object_type_id: "order", property_name: "created_at" },
            },
            {
              node_type: "property",
              property_ref: { object_type_id: "order", property_name: "created_at" },
            },
          ],
          function: "duration_between",
          node_type: "call",
        },
        properties,
      ),
    ).toBe("duration");
  });
});
