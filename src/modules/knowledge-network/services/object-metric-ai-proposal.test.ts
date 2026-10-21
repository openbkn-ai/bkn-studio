/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  objectMetricAiChanges,
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
});
