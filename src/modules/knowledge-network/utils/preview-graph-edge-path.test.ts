/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildPreviewGraphEdgePath } from "@/modules/knowledge-network/utils/preview-graph-edge-path";

describe("buildPreviewGraphEdgePath", () => {
  it("creates separated parallel curves for multiple edges", () => {
    const horizontal = [0, 1, 2].map((edgeIndex) =>
      buildPreviewGraphEdgePath(100, 200, 500, 200, {
        edgeIndex,
        edgeTotal: 3,
        label: "试试水",
      }),
    );
    const vertical = [0, 1, 2].map((edgeIndex) =>
      buildPreviewGraphEdgePath(300, 120, 300, 420, {
        edgeIndex,
        edgeTotal: 3,
        label: "试试水",
      }),
    );

    expect(new Set(horizontal.map((item) => item.d)).size).toBe(3);
    expect(new Set(vertical.map((item) => item.d)).size).toBe(3);

    const horizontalLabels = horizontal.map((item) => `${item.labelX},${item.labelY}`);
    expect(new Set(horizontalLabels).size).toBe(3);

    const verticalLabels = vertical.map((item) => `${item.labelX},${item.labelY}`);
    expect(new Set(verticalLabels).size).toBe(3);
  });
});
