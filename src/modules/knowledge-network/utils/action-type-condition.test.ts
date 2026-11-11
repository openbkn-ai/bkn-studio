/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ActionTypeCondition } from "@/modules/knowledge-network/types/knowledge-network";
import {
  promoteLegacyActionCondition,
  hasReferencedConditionValue,
  validateActionCondition,
} from "@/modules/knowledge-network/utils/action-type-condition";
import { mapActionTypeDetail } from "@/modules/knowledge-network/services/mappers";
import { toBackendActionTypeCreateEntry } from "@/modules/knowledge-network/services/mappers/action-type.mapper";

describe("action-type-condition", () => {
  const properties = [
    { name: "amount", value: "amount", displayName: "Amount", label: "Amount", type: "number" },
    {
      name: "minimum",
      value: "minimum",
      displayName: "Minimum",
      label: "Minimum",
      type: "integer",
    },
    { name: "status", value: "status", displayName: "Status", label: "Status", type: "string" },
  ];
  it.each(["property", "input"] as const)(
    "round-trips nested %s references without treating them as literals",
    (valueFrom) => {
      const condition: ActionTypeCondition = {
        operation: "and",
        subConditions: [{ field: "amount", operation: ">=", value: "minimum", valueFrom }],
      };
      const payload = toBackendActionTypeCreateEntry({
        actionKind: "update",
        color: "#1677ff",
        condition,
        description: "",
        name: "Update",
        objectTypeId: "orders",
        tags: [],
      });
      expect(payload.condition?.sub_conditions?.[0]).toMatchObject({
        value_from: valueFrom,
        value: "minimum",
      });
      expect(
        mapActionTypeDetail({ ...payload, id: "action-1" }).condition?.subConditions?.[0],
      ).toMatchObject({ valueFrom, value: "minimum" });
      expect(hasReferencedConditionValue(condition)).toBe(true);
    },
  );

  it("validates property types and rejects references to removed runtime parameters", () => {
    const base: ActionTypeCondition = { field: "amount", operation: ">=" };
    expect(
      validateActionCondition({ ...base, valueFrom: "property", value: "minimum" }, properties, []),
    ).toBeNull();
    expect(
      validateActionCondition({ ...base, valueFrom: "property", value: "status" }, properties, []),
    ).toBe("knowledgeNetwork.actionTypeConditionPropertyRequired");
    const dynamic: ActionTypeCondition = { ...base, valueFrom: "input", value: "requested" };
    expect(
      validateActionCondition(dynamic, properties, [
        { name: "requested", type: "integer", valueFrom: "input" },
      ]),
    ).toBeNull();
    expect(
      validateActionCondition(dynamic, properties, [
        { name: "requested", type: "integer", valueFrom: "const", value: "5" },
      ]),
    ).toBe("knowledgeNetwork.actionTypeConditionParameterRequired");
    expect(
      validateActionCondition({ operation: "or", subConditions: [dynamic] }, properties, []),
    ).toBe("knowledgeNetwork.actionTypeConditionParameterRequired");
  });

  it("preserves list references and normalizes fixed ranges without interpreting reference names", () => {
    expect(
      promoteLegacyActionCondition({
        field: "amount",
        operation: "range",
        value: "10, 20",
      }),
    ).toMatchObject({ value: ["10", "20"], valueFrom: "const" });
    expect(
      promoteLegacyActionCondition({
        field: "amount",
        operation: "range",
        value: "bounds",
        valueFrom: "input",
      }),
    ).toMatchObject({ value: "bounds", valueFrom: "input" });
    expect(
      validateActionCondition({ field: "amount", operation: "range", value: "10" }, properties, []),
    ).toBe("knowledgeNetwork.actionTypeConditionRangeRequired");
    expect(
      validateActionCondition(
        {
          field: "amount",
          operation: "range",
          value: "bounds",
          valueFrom: "input",
        },
        properties,
        [{ name: "bounds", type: "array", valueFrom: "input" }],
      ),
    ).toBeNull();
  });

  it("clears unused references for valueless operators", () => {
    const condition: ActionTypeCondition = {
      field: "amount",
      operation: "exist",
      value: "removed",
      valueFrom: "input",
    };
    expect(hasReferencedConditionValue(condition)).toBe(false);
    expect(promoteLegacyActionCondition(condition)).toMatchObject({
      value: undefined,
      valueFrom: "const",
    });
    expect(validateActionCondition(condition, properties, [])).toBeNull();
  });
  it("preserves commas in a scalar literal and checks typed array references", () => {
    expect(
      validateActionCondition(
        {
          field: "status",
          operation: "==",
          value: "hello,,world",
        },
        properties,
        [],
      ),
    ).toBeNull();
    expect(
      validateActionCondition(
        {
          field: "amount",
          operation: "in",
          value: "values",
          valueFrom: "input",
        },
        properties,
        [{ name: "values", type: "string[]", valueFrom: "input" }],
      ),
    ).toBe("knowledgeNetwork.actionTypeConditionParameterRequired");
    expect(
      validateActionCondition(
        {
          field: "amount",
          operation: "in",
          value: "values",
          valueFrom: "input",
        },
        properties,
        [{ name: "values", type: "integer[]", valueFrom: "input" }],
      ),
    ).toBeNull();
  });
  it("promotes legacy leaf+subConditions into an and tree", () => {
    const legacy: ActionTypeCondition = {
      field: "product_name",
      objectTypeId: "sales_order_event",
      operation: "==",
      value: "UAV-BF-IND-H30",
      valueFrom: "const",
      subConditions: [
        {
          field: "customer_name",
          objectTypeId: "sales_order_event",
          operation: "==",
          value: "Acme",
          valueFrom: "const",
        },
      ],
    };

    expect(promoteLegacyActionCondition(legacy)).toEqual({
      objectTypeId: "sales_order_event",
      operation: "and",
      valueFrom: "const",
      subConditions: [
        {
          field: "product_name",
          objectTypeId: "sales_order_event",
          operation: "==",
          value: "UAV-BF-IND-H30",
          valueFrom: "const",
        },
        {
          field: "customer_name",
          objectTypeId: "sales_order_event",
          operation: "==",
          value: "Acme",
          valueFrom: "const",
        },
      ],
    });
  });

  it("serializes multi-condition create payload with root and", () => {
    const payload = toBackendActionTypeCreateEntry({
      actionKind: "create",
      color: "#16a34a",
      condition: {
        field: "product_name",
        objectTypeId: "sales_order_event",
        operation: "==",
        value: "UAV-BF-IND-H30",
        valueFrom: "const",
        subConditions: [
          {
            field: "customer_name",
            objectTypeId: "sales_order_event",
            operation: "==",
            value: "Acme",
            valueFrom: "const",
          },
        ],
      },
      description: "",
      name: "demo",
      objectTypeId: "sales_order_event",
      tags: [],
    });

    expect(payload.condition).toEqual({
      object_type_id: "sales_order_event",
      operation: "and",
      value_from: "const",
      sub_conditions: [
        {
          field: "product_name",
          object_type_id: "sales_order_event",
          operation: "==",
          value: "UAV-BF-IND-H30",
          value_from: "const",
        },
        {
          field: "customer_name",
          object_type_id: "sales_order_event",
          operation: "==",
          value: "Acme",
          value_from: "const",
        },
      ],
    });
  });
});
