/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { filterObjectMetrics, resolveSelectedObjectTypeId } from "./object-metric-list-utils";

describe("resolveSelectedObjectTypeId", () => {
  const objects = [{ id: "shipment" }, { id: "order" }, { id: "warehouse" }];
  const records = [{ definition: { owner_object_type_id: "order" } }];

  it("首次进入时优先选择已有指标的对象类", () => {
    expect(resolveSelectedObjectTypeId("", objects, records)).toBe("order");
  });

  it("刷新时保留仍然有效的用户选择", () => {
    expect(resolveSelectedObjectTypeId("warehouse", objects, records)).toBe("warehouse");
  });

  it("当前选择失效时回退到已有指标的对象类", () => {
    expect(resolveSelectedObjectTypeId("deleted", objects, records)).toBe("order");
  });

  it("没有指标时回退到第一个对象类", () => {
    expect(resolveSelectedObjectTypeId("", objects, [])).toBe("shipment");
  });
});

describe("filterObjectMetrics", () => {
  const records = [
    {
      definition: {
        code: "total_order_count",
        metric_type: "atomic" as const,
        name: "订单总数",
        owner_object_type_id: "order",
      },
    },
    {
      definition: {
        code: "cancelled_order_count",
        metric_type: "derived" as const,
        name: "已取消订单数",
        owner_object_type_id: "order",
      },
    },
    {
      definition: {
        code: "shipment_count",
        metric_type: "atomic" as const,
        name: "发货单数",
        owner_object_type_id: "shipment",
      },
    },
  ];

  it("按对象类、指标类型和关键字生成图谱与列表的共同数据集", () => {
    expect(filterObjectMetrics(records, "order", "derived", "取消")).toEqual([records[1]]);
    expect(filterObjectMetrics(records, "order", undefined, "TOTAL_ORDER")).toEqual([records[0]]);
  });
});
