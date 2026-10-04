/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapObjectType } from "@/modules/knowledge-network/services/mappers";

describe("object type index-status mapping", () => {
  it("preserves an available response-time index projection", () => {
    expect(
      mapObjectType({
        data_source: { id: "orders", name: "Orders", type: "resource" },
        id: "order",
        index_status: { source_status: "available", state: "available" },
        name: "Order",
      }).indexStatus,
    ).toEqual({ sourceStatus: "available", state: "available" });
  });

  it("reports missing resource metadata as unknown instead of falsely saying no index", () => {
    expect(
      mapObjectType({
        data_source: { id: "orders", name: "Orders", type: "resource" },
        id: "order",
        name: "Order",
      }).indexStatus,
    ).toEqual({ state: "unknown" });
  });
});
