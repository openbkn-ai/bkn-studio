/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { resolveObjectTypeDisplayKeyLabel } from "@/modules/knowledge-network/lib/object-type-display-key-label";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/knowledge-network";

describe("resolveObjectTypeDisplayKeyLabel", () => {
  it("prefers data property display name", () => {
    const dataProperties = [
      { displayName: "订单号", name: "order_no" },
    ] as ObjectTypeDataProperty[];

    expect(resolveObjectTypeDisplayKeyLabel("order_no", dataProperties)).toBe("订单号");
  });

  it("falls back to preview column title", () => {
    expect(
      resolveObjectTypeDisplayKeyLabel("order_no", [], [
        { dataIndex: "order_no", title: "Order No." },
      ]),
    ).toBe("Order No.");
  });

  it("falls back to property name", () => {
    expect(resolveObjectTypeDisplayKeyLabel("order_no", [])).toBe("order_no");
  });
});
