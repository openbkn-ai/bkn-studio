/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  containerBlockReason,
  filterVisibleContainers,
  type PickerTool,
  toolBlockReason,
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

describe("toolBlockReason", () => {
  const published = { status: "published" };

  it("lets an enabled tool of a published toolset through", () => {
    expect(toolBlockReason(published, { id: "t1", name: "t1", status: "enabled" })).toBeNull();
  });

  it("refuses a disabled tool, which the backend rejects when named directly", () => {
    expect(toolBlockReason(published, { id: "t1", name: "t1", status: "disabled" })).toBe(
      "toolDisabled",
    );
  });

  it("refuses every tool of an unpublished toolset, enabled or not", () => {
    expect(
      toolBlockReason({ status: "unpublish" }, { id: "t1", name: "t1", status: "enabled" }),
    ).toBe("boxUnpublished");
    expect(
      toolBlockReason({ status: "offline" }, { id: "t1", name: "t1", status: "enabled" }),
    ).toBe("boxUnpublished");
  });

  it("lets an MCP tool through: it has no status, and its Server is listed only once published", () => {
    expect(toolBlockReason({}, { id: "search", name: "search" })).toBeNull();
  });
});

describe("containerBlockReason", () => {
  const box = { id: "b1", name: "dataset_function", status: "published", toolCount: 1 };

  it("refuses an unpublished toolset before its tools are read", () => {
    expect(containerBlockReason({ ...box, status: "unpublish" }, undefined)).toBe("boxUnpublished");
  });

  it("leaves an unread toolset to its read, even one the catalogue listed as empty", () => {
    // The listing's count is derived from a field it may omit; it is shown, never trusted to lock.
    expect(containerBlockReason(box, undefined)).toBeNull();
    expect(containerBlockReason({ ...box, toolCount: 0 }, undefined)).toBeNull();
  });

  it("refuses a toolset whose read found no tools", () => {
    expect(containerBlockReason(box, [])).toBe("noTools");
  });

  it("refuses a toolset whose only tools are disabled — the whole-box mount the backend 400s", () => {
    expect(
      containerBlockReason(box, [{ id: "get_birthday", name: "get_birthday", status: "disabled" }]),
    ).toBe("noEnabledTools");
  });

  it("accepts a toolset with at least one enabled tool", () => {
    expect(
      containerBlockReason(box, [
        { id: "t1", name: "t1", status: "disabled" },
        { id: "t2", name: "t2", status: "enabled" },
      ]),
    ).toBeNull();
  });

  it("refuses a container that turned out to hold no tools at all", () => {
    expect(containerBlockReason({ id: "mcp-1", name: "Server" }, [])).toBe("noTools");
  });
});
