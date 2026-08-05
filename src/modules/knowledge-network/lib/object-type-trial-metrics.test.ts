/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  filterInstanceTrialLogicProperties,
  filterUnboundMetricsForTrial,
  getLogicPropertyBoundMetricIds,
} from "@/modules/knowledge-network/lib/object-type-trial-metrics";
import {
  buildInstanceIdentityFromSampleRow,
  matchesSampleRowKeyword,
} from "@/modules/knowledge-network/lib/object-type-instance-identity";
import type {
  KnowledgeNetworkMetricRecord,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

describe("object-type trial helpers", () => {
  it("filters metrics already bound by logic properties", () => {
    const metrics = [
      { id: "m-1", name: "A" },
      { id: "m-2", name: "B" },
    ] as KnowledgeNetworkMetricRecord[];

    const logicProperties = [
      {
        dataSource: { id: "m-1", name: "A", type: "metric" },
        displayName: "Bound",
        name: "bound_metric",
        type: "metric",
      },
    ] as ObjectTypeLogicProperty[];

    expect(getLogicPropertyBoundMetricIds(logicProperties)).toEqual(new Set(["m-1"]));
    expect(filterUnboundMetricsForTrial(metrics, logicProperties).map((item) => item.id)).toEqual([
      "m-2",
    ]);
  });

  it("excludes aggregate metric bindings from instance trials", () => {
    const logicProperties = [
      {
        dataSource: { id: "tool-1", name: "Discount", type: "tool" },
        displayName: "Discount",
        name: "discount",
        type: "tool",
      },
      {
        dataSource: { id: "metric-1", name: "GMV", type: "metric" },
        displayName: "GMV",
        name: "gmv",
        type: "metric",
      },
    ] as ObjectTypeLogicProperty[];

    expect(filterInstanceTrialLogicProperties(logicProperties).map((item) => item.name)).toEqual([
      "discount",
    ]);
  });

  it("builds instance identity from primary keys only", () => {
    expect(
      buildInstanceIdentityFromSampleRow(
        { order_id: 1001, order_no: "NO-1" },
        ["order_id"],
      ),
    ).toEqual({
      order_id: 1001,
    });
  });

  it("matches trial sample rows against every visible value", () => {
    const row = { order_id: 1001, order_no: "SO-2026-001", status: "Active" };

    expect(matchesSampleRowKeyword(row, "2026-001")).toBe(true);
    expect(matchesSampleRowKeyword(row, "active")).toBe(true);
    expect(matchesSampleRowKeyword(row, "missing")).toBe(false);
  });
});
