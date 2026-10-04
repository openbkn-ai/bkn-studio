/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { ObjectMetricGraphCanvas } from "./ObjectMetricGraphCanvas";

afterEach(cleanup);

describe("ObjectMetricGraphCanvas", () => {
  it("uses the same stretched coordinate system for nodes and edges", () => {
    const { container } = render(
      <ObjectMetricGraphCanvas
        metrics={[]}
        objectTypes={[{ id: "order", name: "销售订单" } as KnowledgeNetworkObjectTypeRecord]}
        onOpenMetric={vi.fn()}
        onSelectObject={vi.fn()}
        relationTypes={[]}
        selectedObjectTypeId="order"
      />,
    );

    const edgeLayer = container.querySelector('svg[viewBox="0 0 1100 620"]');
    expect(edgeLayer?.getAttribute("preserveAspectRatio")).toBe("none");
  });
});

describe("metric dependency edges", () => {
  it("draws a directed edge from a fixed-version dependency to its dependent metric", () => {
    const atomic = {
      definition: {
        id: "total",
        version: 1,
        metric_type: "atomic",
        owner_object_type_id: "order",
        name: "订单总数",
        code: "total",
        specification: { kind: "atomic", measure: { aggregation: "count_rows" } },
      },
    } as ObjectMetricRecordV1;
    const derived = {
      definition: {
        id: "cancelled",
        version: 1,
        metric_type: "derived",
        owner_object_type_id: "order",
        name: "已取消订单数",
        code: "cancelled",
        specification: {
          base_metric: { metric_id: "total", version: 1 },
          business_qualifiers: {},
          kind: "derived",
        },
      },
    } as ObjectMetricRecordV1;
    const { container } = render(
      <ObjectMetricGraphCanvas
        metrics={[atomic, derived]}
        objectTypes={[{ id: "order", name: "销售订单" } as KnowledgeNetworkObjectTypeRecord]}
        onOpenMetric={vi.fn()}
        onSelectObject={vi.fn()}
        relationTypes={[]}
        selectedObjectTypeId="order"
      />,
    );

    expect(container.querySelector('line[marker-end="url(#metric-lineage-arrow)"]')).not.toBeNull();
  });
});
