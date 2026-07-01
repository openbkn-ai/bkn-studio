/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  computePreviewGraphLayout,
  PREVIEW_NODE_RADIUS,
} from "@/modules/knowledge-network/utils/compute-preview-graph-layout";

describe("computePreviewGraphLayout", () => {
  it("keeps nodes separated for a small graph", () => {
    const layout = computePreviewGraphLayout({
      nodes: [
        { color: "#1677ff", id: "a", name: "product" },
        { color: "#1677ff", id: "b", name: "单独" },
        { color: "#1677ff", id: "c", name: "测试" },
      ],
      edges: [
        { id: "e1", name: "试试水", sourceId: "b", targetId: "c" },
        { id: "e2", name: "试试水", sourceId: "b", targetId: "c" },
        { id: "e3", name: "III", sourceId: "b", targetId: "c" },
      ],
    });

    expect(layout).toHaveLength(3);

    const positions = new Map(layout.map((node) => [node.id, node]));
    const isolated = positions.get("a")!;
    const source = positions.get("b")!;
    const target = positions.get("c")!;

    expect(Math.hypot(isolated.x - source.x, isolated.y - source.y)).toBeGreaterThan(
      PREVIEW_NODE_RADIUS * 3,
    );
    expect(Math.hypot(source.x - target.x, source.y - target.y)).toBeGreaterThan(
      PREVIEW_NODE_RADIUS * 3,
    );
    expect(Math.hypot(isolated.x - target.x, isolated.y - target.y)).toBeGreaterThan(
      PREVIEW_NODE_RADIUS * 3,
    );
  });
});
