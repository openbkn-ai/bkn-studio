/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { snapshotFieldsOf } from "@/modules/data-catalog/services/build-task.service";

describe("snapshotFieldsOf", () => {
  it("retains the effective analyzer for every fulltext field", () => {
    const snapshot = snapshotFieldsOf({
      id: "task-1",
      index_config: {
        features: {
          coupon_code: { fulltext: { analyzer: "standard" } },
          status: { fulltext: { analyzer: "hanlp_index" } },
        },
      },
    });

    expect(snapshot.fulltextAnalyzer).toBe("standard");
    expect(snapshot.fulltextAnalyzers).toEqual({
      coupon_code: "standard",
      status: "hanlp_index",
    });
  });
});
