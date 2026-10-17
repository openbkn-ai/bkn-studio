/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildBackendObjectTypePayload,
  mapLogicProperty,
  mapObjectTypeDetail,
  toBackendLogicProperty,
} from "@/modules/knowledge-network/services/mappers";
import { findMetricLogicProperty } from "@/modules/knowledge-network/lib/object-metric-binding";

describe("object type tool logic property mapper", () => {
  it("preserves a metric binding through object-type reads and writes", () => {
    const metricBinding = {
      object_type_id: "order",
      property_name: "paid_amount",
      display_name: "订单支付额",
      metric_ref: { metric_id: "metric-1", version: 2 },
      execution: { mode: "realtime" as const },
      no_data_policy: "null" as const,
      on_error: "unavailable" as const,
      status: "published" as const,
    };
    const property = mapLogicProperty({
      name: "paid_amount",
      display_name: "订单支付额",
      metric_binding: metricBinding,
    });
    expect(property.metricBinding).toEqual(metricBinding);
    expect(toBackendLogicProperty(property).metric_binding).toEqual(metricBinding);
    const detail = mapObjectTypeDetail({
      id: "order",
      name: "销售订单",
      logic_properties: [
        { name: "paid_amount", display_name: "订单支付额", metric_binding: metricBinding },
      ],
    });
    expect(findMetricLogicProperty(detail, "metric-1")?.metricBinding).toEqual(metricBinding);
  });
  it("preserves tool parameter required flags", () => {
    const property = mapLogicProperty({
      display_name: "Availability",
      name: "availability",
      parameters: [
        { name: "sku", required: true, value_from: "input" },
        { name: "region", required: false, value_from: "input" },
      ],
    });

    expect(property.parameters).toMatchObject([
      { name: "sku", required: true },
      { name: "region", required: false },
    ]);
    expect(toBackendLogicProperty(property).parameters).toMatchObject([
      { name: "sku", required: true },
      { name: "region", required: false },
    ]);
  });

  it("writes object data sources as resources", () => {
    expect(
      buildBackendObjectTypePayload(
        {
          color: "#1677ff",
          conceptGroupIds: [],
          dataProperties: [],
          dataSource: { id: "resource-1", name: "Orders", type: "resource" },
          description: "",
          name: "Order",
          tags: [],
        },
        [],
      ).data_source,
    ).toEqual({ id: "resource-1", name: "Orders", type: "resource" });
  });

  it("does not write a legacy data source type from untyped input", () => {
    const legacyDataSource = { id: "resource-1", name: "Orders", type: "data_view" } as unknown as {
      id: string;
      name: string;
      type: "resource";
    };

    expect(
      buildBackendObjectTypePayload(
        {
          color: "#1677ff",
          conceptGroupIds: [],
          dataProperties: [],
          dataSource: legacyDataSource,
          description: "",
          name: "Order",
          tags: [],
        },
        [],
      ).data_source,
    ).toEqual({ id: "resource-1", name: "Orders", type: "resource" });
  });

  it("maps toolbox identifiers and result path from backend", () => {
    expect(
      mapLogicProperty({
        data_source: {
          box_id: "box-1",
          name: "Weather",
          result_path: "$.data.temperature",
          tool_id: "tool-1",
          type: "tool",
        },
        display_name: "Weather",
        name: "weather",
        type: "tool",
      }),
    ).toMatchObject({
      dataSource: {
        boxId: "box-1",
        resultPath: "$.data.temperature",
        toolId: "tool-1",
        type: "tool",
      },
      type: "tool",
    });
  });

  it("preserves toolbox identifiers and result path in create payloads", () => {
    expect(
      toBackendLogicProperty({
        dataSource: {
          boxId: "box-1",
          name: "Weather",
          resultPath: "$.data.temperature",
          toolId: "tool-1",
          type: "tool",
        },
        displayName: "Weather",
        name: "weather",
        type: "tool",
      }),
    ).toMatchObject({
      data_source: {
        box_id: "box-1",
        result_path: "$.data.temperature",
        tool_id: "tool-1",
        type: "tool",
      },
      type: "tool",
    });
  });

  it("preserves the tool result path in an object type mutation payload", () => {
    expect(
      buildBackendObjectTypePayload(
        {
          color: "#1677ff",
          conceptGroupIds: [],
          description: "",
          logicProperties: [
            {
              dataSource: {
                boxId: "box-1",
                name: "Weather",
                resultPath: "$.data.temperature",
                toolId: "tool-1",
                type: "tool",
              },
              displayName: "Weather",
              name: "weather",
              type: "tool",
            },
          ],
          name: "Weather object",
          tags: [],
        },
        [],
      ).logic_properties,
    ).toMatchObject([
      {
        data_source: {
          box_id: "box-1",
          result_path: "$.data.temperature",
          tool_id: "tool-1",
          type: "tool",
        },
      },
    ]);
  });
});
