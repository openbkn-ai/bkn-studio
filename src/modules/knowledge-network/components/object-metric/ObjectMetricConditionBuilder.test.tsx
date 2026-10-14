/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  normalizeObjectMetricConditionValueType,
  objectMetricComparisonOperatorsForType,
} from "@/modules/knowledge-network/lib/object-metric-condition-operators";

import { ObjectMetricConditionBuilder } from "./ObjectMetricConditionBuilder";

describe("ObjectMetricConditionBuilder", () => {
  const properties = [
    {
      label: "订单状态 · order_status",
      objectTypeId: "order",
      propertyName: "order_status",
      propertyType: "string",
    },
  ];

  it("does not invent a property or value when a condition is added", () => {
    const onChange = vi.fn();

    render(
      <ObjectMetricConditionBuilder
        onChange={onChange}
        properties={[
          {
            label: "订单主键ID · order_id",
            objectTypeId: "order",
            propertyName: "order_id",
            propertyType: "int64",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加业务条件" }));

    expect(onChange).toHaveBeenCalledWith({
      comparison_operator: "eq",
      left: {
        property_ref: { object_type_id: "order", property_name: "" },
        source: "property",
      },
      node_type: "predicate",
      right: [{ source: "literal", value: undefined, value_type: "string" }],
    });
  });

  it("keeps the operator and value disabled until a field is selected", () => {
    render(
      <ObjectMetricConditionBuilder
        onChange={vi.fn()}
        properties={properties}
        value={{
          comparison_operator: "eq",
          left: {
            property_ref: { object_type_id: "order", property_name: "" },
            source: "property",
          },
          node_type: "predicate",
          right: [{ source: "literal", value: undefined, value_type: "string" }],
        }}
      />,
    );

    expect(screen.getByRole("combobox", { name: "判断字段" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "判断关系" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "判断值" })).toBeDisabled();
  });

  it("turns a single condition into a reusable and-or condition group", () => {
    const onChange = vi.fn();
    const condition = {
      comparison_operator: "eq" as const,
      left: {
        property_ref: { object_type_id: "order", property_name: "order_status" },
        source: "property" as const,
      },
      node_type: "predicate" as const,
      right: [{ source: "literal" as const, value: "已完成", value_type: "string" }],
    };

    render(
      <ObjectMetricConditionBuilder
        onChange={onChange}
        properties={properties}
        value={condition}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加条件" }));

    expect(onChange).toHaveBeenCalledWith({
      boolean_operator: "and",
      children: [
        condition,
        {
          comparison_operator: "eq",
          left: {
            property_ref: { object_type_id: "order", property_name: "" },
            source: "property",
          },
          node_type: "predicate",
          right: [{ source: "literal", value: undefined, value_type: "string" }],
        },
      ],
      node_type: "group",
    });
  });

  it("edits membership values in one compact multi-value control", () => {
    render(
      <ObjectMetricConditionBuilder
        onChange={vi.fn()}
        properties={properties}
        value={{
          comparison_operator: "in",
          left: {
            property_ref: { object_type_id: "order", property_name: "order_status" },
            source: "property",
          },
          node_type: "predicate",
          right: [
            { source: "literal", value: "退款中", value_type: "string" },
            { source: "literal", value: "已退款", value_type: "string" },
          ],
        }}
      />,
    );

    expect(screen.getByRole("combobox", { name: "判断值" })).toBeInTheDocument();
    expect(screen.getByText("退款中")).toBeInTheDocument();
    expect(screen.getByText("已退款")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加值" })).not.toBeInTheDocument();
  });

  it.each([
    ["integer", "int64"],
    ["long", "int64"],
    ["float32", "decimal"],
    ["float64", "decimal"],
    ["number", "decimal"],
    ["bool", "boolean"],
    ["timestamp", "datetime"],
    ["keyword", "string"],
  ])("normalizes %s properties to the %s condition type", (source, expected) => {
    expect(normalizeObjectMetricConditionValueType(source)).toBe(expected);
  });

  it.each([
    ["boolean", ["eq", "neq", "is_true", "is_false", "is_null", "is_not_null"]],
    [
      "decimal",
      [
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "between",
        "not_between",
        "in",
        "not_in",
        "is_null",
        "is_not_null",
      ],
    ],
    [
      "date",
      [
        "eq",
        "neq",
        "before",
        "before_or_equal",
        "after",
        "after_or_equal",
        "between",
        "not_between",
        "in",
        "not_in",
        "is_null",
        "is_not_null",
      ],
    ],
    [
      "string",
      [
        "eq",
        "neq",
        "in",
        "not_in",
        "contains",
        "not_contains",
        "starts_with",
        "ends_with",
        "is_empty",
        "is_not_empty",
        "is_null",
        "is_not_null",
      ],
    ],
  ])("exposes only operators valid for %s properties", (type, expected) => {
    expect(objectMetricComparisonOperatorsForType(type)).toEqual(expected);
  });

  it("intersects type-compatible operators with the backend capability registry", () => {
    expect(
      objectMetricComparisonOperatorsForType("decimal", ["eq", "contains", "gte", "is_null"]),
    ).toEqual(["eq", "gte", "is_null"]);
  });
});
