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
} from "@/modules/knowledge-network/utils/action-type-condition";
import { toBackendActionTypeCreateEntry } from "@/modules/knowledge-network/services/mappers/action-type.mapper";

describe("action-type-condition", () => {
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
