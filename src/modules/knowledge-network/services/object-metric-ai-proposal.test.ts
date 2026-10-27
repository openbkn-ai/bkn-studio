/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  objectMetricAiChanges,
  objectMetricDesignFormSnapshot,
  objectMetricAiPreviousValue,
  selectedObjectMetricAiIntent,
} from "./object-metric-ai-proposal";

describe("object metric AI proposal", () => {
  it("offers editable fields individually and excludes conversational notes", () => {
    const intent = {
      name: "订单数",
      query: { analysis_dimensions: ["status"], time_dimensions: ["signed_at"] },
      notes: ["按订单统计"],
    };
    expect(objectMetricAiChanges(intent).map((change) => change.path)).toEqual([
      "name",
      "query.analysis_dimensions",
      "query.time_dimensions",
    ]);
    expect(selectedObjectMetricAiIntent(intent, ["query.time_dimensions"])).toEqual({
      query: { time_dimensions: ["signed_at"] },
    });
  });

  it("reads the previous value from the matching form or expression state", () => {
    const snapshot = {
      form: { name: "人工名称", timeDimensions: ["created_at"] },
      measureExpression: {
        node_type: "property",
        property_ref: { property_name: "amount" },
      },
      compositeExpression: null,
      dependencies: [],
      relationSteps: [],
    };
    expect(objectMetricAiPreviousValue("name", snapshot)).toBe("人工名称");
    expect(objectMetricAiPreviousValue("query.time_dimensions", snapshot)).toEqual(["created_at"]);
    expect(objectMetricAiPreviousValue("atomic.property_name", snapshot)).toBe("amount");
  });

  it("sends only the current metric type to the designer", () => {
    const snapshot = {
      form: {
        name: "",
        code: "server-owned",
        aggregation: "count_rows",
        baseMetric: "amount@2",
        timeWindowMode: "unbounded",
        groupByDimensions: ["status"],
        grainPolicy: "same_grain",
      },
      businessCondition: { node_type: "group", children: [] },
      measureExpression: { node_type: "literal", value: 1 },
      compositeExpression: { node_type: "literal", value: 0 },
      dependencies: [],
      relationSteps: [],
    };

    expect(objectMetricDesignFormSnapshot(snapshot, "derived")).toEqual({
      name: "",
      baseMetric: "amount@2",
      timeWindowMode: "unbounded",
      groupByDimensions: ["status"],
      "derived.filters": snapshot.businessCondition,
    });
    expect(objectMetricDesignFormSnapshot(snapshot, "atomic")).toEqual({
      name: "",
      aggregation: "count_rows",
      groupByDimensions: ["status"],
      "atomic.expression": snapshot.measureExpression,
    });
    expect(objectMetricDesignFormSnapshot(snapshot, "composite")).toEqual({
      name: "",
      groupByDimensions: ["status"],
      "composite.dependencies": [],
      "composite.expression": snapshot.compositeExpression,
    });
  });
});
