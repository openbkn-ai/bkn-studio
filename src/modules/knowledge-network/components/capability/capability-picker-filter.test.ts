/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  filterVisibleContainers,
  type PickerTool,
} from "@/modules/knowledge-network/components/capability/capability-picker-filter";

const containers = [
  { id: "box-invoice", name: "发票工具集" },
  { id: "box-orders", name: "订单工具集" },
  { id: "box-empty", name: "空工具集" },
];

const toolsByContainer: Record<string, PickerTool[]> = {
  "box-orders": [{ id: "tool-invoice-sync", name: "同步发票" }],
};

describe("filterVisibleContainers", () => {
  it("returns everything when nothing is searched for", () => {
    expect(filterVisibleContainers(containers, toolsByContainer, "  ")).toEqual(containers);
  });

  it("keeps a container whose own name matches", () => {
    expect(
      filterVisibleContainers(containers, toolsByContainer, "发票").map((box) => box.id),
    ).toEqual(["box-invoice", "box-orders"]);
  });

  it("keeps a container holding a matching tool, and only by loaded tools", () => {
    expect(
      filterVisibleContainers(containers, toolsByContainer, "tool-invoice").map((box) => box.id),
    ).toEqual(["box-orders"]);
  });

  it("drops containers a search excludes, which is what select-all must not mount", () => {
    expect(filterVisibleContainers(containers, toolsByContainer, "订单")).toHaveLength(1);
    expect(filterVisibleContainers(containers, toolsByContainer, "nothing")).toHaveLength(0);
  });
});
