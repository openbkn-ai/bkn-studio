/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildMetricDataQueryPayload,
  listKnowledgeNetworkMetrics,
  normalizeMetricDataResponse,
} from "@/modules/knowledge-network/services/metric.service";

vi.mock("@/modules/knowledge-network/services/shared/runtime", async () => {
  const actual = await vi.importActual<typeof import("@/modules/knowledge-network/services/shared/runtime")>(
    "@/modules/knowledge-network/services/shared/runtime",
  );

  return {
    ...actual,
    useMock: true,
    wait: <T,>(value: T) => Promise.resolve(value),
  };
});

describe("listKnowledgeNetworkMetrics", () => {
  it("treats limit -1 as fetch-all for mock lists", async () => {
    const result = await listKnowledgeNetworkMetrics("kn-domain-risk", {
      limit: -1,
      scopeRef: "ot-risk-order",
    });

    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.entries).toHaveLength(result.totalCount);
  });
});

describe("normalizeMetricDataResponse", () => {
  it("expands multi-series trend rows with prefixed dimension columns", () => {
    const result = normalizeMetricDataResponse(
      {
        datas: [
          {
            labels: { warehouse_id: "WH001", item_code: "PART-1" },
            time_strs: ["2024-01-01"],
            values: [120],
          },
          {
            labels: { warehouse_id: "WH002", item_code: "PART-2" },
            time_strs: ["2024-01-01"],
            values: [98],
          },
        ],
      },
      "trend",
    );

    expect(result.columns.map((column) => column.key)).toEqual([
      "dim_warehouse_id",
      "dim_item_code",
      "timestamp",
      "value",
    ]);
    expect(result.rows[0]).toMatchObject({
      dim_item_code: "PART-1",
      dim_warehouse_id: "WH001",
      value: 120,
    });
    expect(result.rows[1]).toMatchObject({
      dim_item_code: "PART-2",
      dim_warehouse_id: "WH002",
      value: 98,
    });
    expect(result.visualHint).toBe("trend-bars");
  });

  it("keeps reserved metric fields when a dimension property collides with value", () => {
    const result = normalizeMetricDataResponse(
      {
        datas: [
          {
            labels: { value: "WH001", warehouse_id: "WH001" },
            values: [42],
          },
        ],
      },
      "instant",
    );

    expect(result.rows[0]).toMatchObject({
      dim_value: "WH001",
      dim_warehouse_id: "WH001",
      value: 42,
    });
  });
});

describe("buildMetricDataQueryPayload", () => {
  it("passes drill-down dimensions and filter condition together", () => {
    const payload = buildMetricDataQueryPayload({
      analysisDimensions: ["material_name"],
      condition: {
        field: "status",
        objectTypeId: "material_entity",
        operation: "==",
        value: "Active",
        valueFrom: "const",
      },
      limit: 100,
      mode: "instant",
      timeRange: "last_24h",
    });

    expect(payload).toMatchObject({
      analysis_dimensions: ["material_name"],
      condition: {
        field: "status",
        object_type_id: "material_entity",
        operation: "==",
        value: "Active",
        value_from: "const",
      },
      limit: 100,
      time: {
        instant: true,
      },
    });
  });

  it("omits empty filter condition from the query payload", () => {
    const payload = buildMetricDataQueryPayload({
      condition: {
        objectTypeId: "material_entity",
        valueFrom: "const",
      },
      limit: 100,
      mode: "instant",
      timeRange: "last_24h",
    });

    expect(payload).not.toHaveProperty("condition");
  });

  it("keeps grouped AND/OR filter conditions in the query payload", () => {
    const payload = buildMetricDataQueryPayload({
      condition: {
        objectTypeId: "material_entity",
        operation: "or",
        subConditions: [
          {
            field: "status",
            objectTypeId: "material_entity",
            operation: "==",
            value: "Active",
            valueFrom: "const",
          },
          {
            field: "amount",
            objectTypeId: "material_entity",
            operation: ">",
            value: "100",
            valueFrom: "const",
          },
        ],
        valueFrom: "const",
      },
      limit: 100,
      mode: "instant",
      timeRange: "last_24h",
    });

    expect(payload).toMatchObject({
      condition: {
        object_type_id: "material_entity",
        operation: "or",
        sub_conditions: [
          {
            field: "status",
            operation: "==",
          },
          {
            field: "amount",
            operation: ">",
          },
        ],
      },
    });
  });

  it("keeps nested AND/OR filter condition groups in the query payload", () => {
    const payload = buildMetricDataQueryPayload({
      condition: {
        objectTypeId: "material_entity",
        operation: "and",
        subConditions: [
          {
            field: "status",
            objectTypeId: "material_entity",
            operation: "==",
            value: "Active",
            valueFrom: "const",
          },
          {
            objectTypeId: "material_entity",
            operation: "or",
            subConditions: [
              {
                field: "amount",
                objectTypeId: "material_entity",
                operation: ">",
                value: "100",
                valueFrom: "const",
              },
              {
                field: "amount",
                objectTypeId: "material_entity",
                operation: "<",
                value: "10",
                valueFrom: "const",
              },
            ],
            valueFrom: "const",
          },
        ],
        valueFrom: "const",
      },
      limit: 100,
      mode: "instant",
      timeRange: "last_24h",
    });

    expect(payload).toMatchObject({
      condition: {
        operation: "and",
        sub_conditions: [
          {
            field: "status",
            operation: "==",
          },
          {
            operation: "or",
            sub_conditions: [
              {
                field: "amount",
                operation: ">",
              },
              {
                field: "amount",
                operation: "<",
              },
            ],
          },
        ],
      },
    });
  });
});
