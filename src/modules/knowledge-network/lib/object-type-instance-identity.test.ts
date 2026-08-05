/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildInstanceIdentityFromSampleRow,
  buildSampleRowKey,
} from "@/modules/knowledge-network/lib/object-type-instance-identity";

describe("object type instance identity", () => {
  it("does not build an instance identity without primary keys", () => {
    expect(buildInstanceIdentityFromSampleRow({ order_no: "SO-1" }, [])).toBeNull();
  });

  it("does not build an instance identity when a primary key value is missing", () => {
    expect(buildInstanceIdentityFromSampleRow({ order_id: "" }, ["order_id"])).toBeNull();
    expect(buildInstanceIdentityFromSampleRow({}, ["order_id"])).toBeNull();
  });

  it("keeps composite primary keys and produces stable row keys", () => {
    const row = { order_id: 1001, tenant_id: "tenant-a" };

    expect(buildInstanceIdentityFromSampleRow(row, ["tenant_id", "order_id"])).toEqual({
      tenant_id: "tenant-a",
      order_id: 1001,
    });
    expect(buildSampleRowKey(row, ["tenant_id", "order_id"], 0)).toBe("tenant-a::1001");
  });

  it("uses the row index to keep fallback row keys distinct without primary keys", () => {
    const row = { order_no: "SO-1" };

    expect(buildSampleRowKey(row, [], 0)).not.toBe(buildSampleRowKey(row, [], 1));
  });
});
