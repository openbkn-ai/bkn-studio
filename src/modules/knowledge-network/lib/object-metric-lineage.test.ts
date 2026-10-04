/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

import {
  collectObjectMetricDownstream,
  collectObjectMetricUpstream,
  directObjectMetricReferences,
  objectMetricVersionKey,
  resolveObjectMetricReferences,
} from "./object-metric-lineage";

function metric(
  id: string,
  version: number,
  specification: ObjectMetricRecordV1["definition"]["specification"],
): ObjectMetricRecordV1 {
  return {
    branch: "main",
    create_time: 0,
    creator: { id: "test", type: "user" },
    definition: {
      calculation_scope: "object_set",
      code: id,
      description: "",
      id,
      lifecycle: {
        aggregation_registry_version: "v1",
        expression_language_version: "v1",
        function_registry_version: "v1",
        ontology_version: "v1",
        status: "published",
        unit_registry_version: "v1",
      },
      metric_type: specification.kind,
      name: id,
      owner_object_type_id: "order",
      query_capabilities: { analysis_dimensions: [], time_dimensions: [] },
      result_semantics: {
        no_data_policy: "zero",
        partial_data_policy: "reject",
        statistical_grain: { group_by_dimensions: [] },
        value: { physical_type: "int64", semantic_type: "count" },
      },
      specification,
      version,
    },
    kn_id: "test-network",
    update_time: 0,
    updater: { id: "test", type: "user" },
  };
}

const atomic = metric("order_count", 1, {
  kind: "atomic",
  measure: { aggregation: "count_rows" },
});
const derived = metric("cancelled_order_count", 1, {
  base_metric: { metric_id: "order_count", version: 1 },
  business_qualifiers: {},
  kind: "derived",
});
const composite = metric("cancelled_order_ratio", 1, {
  alignment: {
    grain_policy: "same_grain",
    group_by_dimensions: [],
    result_owner_object_type_id: "order",
    result_set_policy: "intersection",
    time_alignment: "same_time_window",
  },
  dependencies: [
    {
      alias: "cancelled",
      evaluation_context: { filter_context: { mode: "inherit" }, window: "inherited" },
      metric_ref: { metric_id: "cancelled_order_count", version: 1 },
      object_alignment: { deduplication: "none", mode: "same_object" },
    },
    {
      alias: "total",
      evaluation_context: { filter_context: { mode: "inherit" }, window: "inherited" },
      metric_ref: { metric_id: "order_count", version: 1 },
      object_alignment: { deduplication: "none", mode: "same_object" },
    },
  ],
  expression: {
    left: { dependency_alias: "cancelled", node_type: "dependency" },
    node_type: "binary",
    operator: "divide",
    right: { dependency_alias: "total", node_type: "dependency" },
  },
  kind: "composite",
  null_policy: "propagate",
  zero_division_policy: "unavailable",
});

describe("object metric definition lineage", () => {
  it("keeps dependencies tied to a precise metric version", () => {
    expect(objectMetricVersionKey("order_count", 1)).toBe("order_count@1");
    expect(directObjectMetricReferences(derived)).toEqual([
      { metric_id: "order_count", version: 1 },
    ]);
  });

  it("loads the pinned dependency version even when a newer version exists", async () => {
    const version5 = metric("paid_amount", 5, atomic.definition.specification);
    const version6 = metric("paid_amount", 6, atomic.definition.specification);
    const loader = async (metricId: string, version: number) =>
      [version5, version6].find(
        (item) => item.definition.id === metricId && item.definition.version === version,
      );

    const [resolution] = await resolveObjectMetricReferences(
      [{ metric_id: "paid_amount", version: 5 }],
      loader,
    );

    expect(resolution.record?.definition.version).toBe(5);
    expect(resolution.key).toBe("paid_amount@5");
  });

  it("collects transitive upstream dependencies and preserves missing definitions", () => {
    const result = collectObjectMetricUpstream(
      composite,
      new Map([[objectMetricVersionKey("cancelled_order_count", 1), derived]]),
    );

    expect(result.map((item) => [item.key, item.depth, Boolean(item.record)])).toEqual([
      ["cancelled_order_count@1", 1, true],
      ["order_count@1", 2, false],
    ]);
  });

  it("collects direct and transitive downstream impact without duplicating a shared dependency", () => {
    const result = collectObjectMetricDownstream(atomic, [derived, composite]);

    expect(result.map((item) => [item.key, item.depth])).toEqual([
      ["cancelled_order_count@1", 1],
      ["cancelled_order_ratio@1", 2],
    ]);
  });

  it("does not render the current metric as its own upstream or downstream when a draft is malformed", () => {
    const malformed = metric("loop", 1, {
      base_metric: { metric_id: "loop", version: 1 },
      business_qualifiers: {},
      kind: "derived",
    });

    expect(
      collectObjectMetricUpstream(
        malformed,
        new Map([[objectMetricVersionKey("loop", 1), malformed]]),
      ),
    ).toEqual([]);
    expect(collectObjectMetricDownstream(malformed, [malformed])).toEqual([]);
  });
});
