/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  filterInstanceTrialLogicProperties,
} from "@/modules/knowledge-network/lib/object-type-trial-metrics";
import {
  buildInstanceIdentityFromSampleRow,
  matchesSampleRowKeyword,
} from "@/modules/knowledge-network/lib/object-type-instance-identity";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

describe("object-type trial helpers", () => {
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
