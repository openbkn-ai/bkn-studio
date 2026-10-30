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
  validObjectMetricAiDecimalFormat,
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
      form: {
        name: "人工名称",
        timeDimensions: ["created_at"],
        precision: 18,
        scale: 6,
        roundingMode: "half_even",
      },
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
    expect(objectMetricAiPreviousValue("result.precision", snapshot)).toBe(18);
    expect(objectMetricAiPreviousValue("result.scale", snapshot)).toBe(6);
    expect(objectMetricAiPreviousValue("result.rounding_mode", snapshot)).toBe("half_even");
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
        precision: 18,
        scale: 6,
        roundingMode: "half_even",
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
      precision: 18,
      scale: 6,
      roundingMode: "half_even",
      "derived.filters": snapshot.businessCondition,
    });
    expect(objectMetricDesignFormSnapshot(snapshot, "atomic")).toEqual({
      name: "",
      aggregation: "count_rows",
      groupByDimensions: ["status"],
      precision: 18,
      scale: 6,
      roundingMode: "half_even",
      "atomic.expression": snapshot.measureExpression,
    });
    expect(objectMetricDesignFormSnapshot(snapshot, "composite")).toEqual({
      name: "",
      groupByDimensions: ["status"],
      precision: 18,
      scale: 6,
      roundingMode: "half_even",
      "composite.dependencies": [],
      "composite.expression": snapshot.compositeExpression,
    });
  });

  it("validates complete and partially selected decimal format changes", () => {
    const currentForm = {
      physicalType: "decimal",
      precision: 18,
      scale: 6,
      roundingMode: "half_even",
    };
    expect(validObjectMetricAiDecimalFormat({ scale: 8 }, currentForm)).toBe(true);
    expect(validObjectMetricAiDecimalFormat({ precision: 5 }, currentForm)).toBe(false);
    expect(validObjectMetricAiDecimalFormat({ scale: 19 }, currentForm)).toBe(false);
    expect(
      validObjectMetricAiDecimalFormat({ rounding_mode: "unknown" as "half_up" }, currentForm),
    ).toBe(false);
    expect(
      validObjectMetricAiDecimalFormat({ precision: null as unknown as number }, currentForm),
    ).toBe(false);
    expect(
      validObjectMetricAiDecimalFormat({ scale: null as unknown as number }, currentForm),
    ).toBe(false);
    expect(
      validObjectMetricAiDecimalFormat(
        { rounding_mode: null as unknown as "half_up" },
        currentForm,
      ),
    ).toBe(false);
    expect(validObjectMetricAiDecimalFormat({ scale: 2 }, { physicalType: "int64" })).toBe(false);
  });
});
