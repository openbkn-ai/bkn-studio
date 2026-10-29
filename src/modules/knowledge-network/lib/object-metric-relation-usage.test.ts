/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { rootRelationTypeIds } from "./object-metric-relation-usage";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

function metric(specification: ObjectMetricRecordV1["definition"]["specification"]) {
  return { definition: { specification } } as ObjectMetricRecordV1;
}

describe("rootRelationTypeIds", () => {
  it("uses only the first step of a derived metric's qualifying path", () => {
    expect(
      rootRelationTypeIds(
        metric({
          kind: "derived",
          base_metric: { metric_id: "base", version: 1 },
          business_qualifiers: {
            relation_path: {
              alias: "path",
              cardinality_policy: "preserve_root",
              purpose: "qualify_root",
              steps: [
                {
                  direction: "outgoing",
                  relation_type_id: "order",
                  target_object_type_id: "order",
                },
                { direction: "outgoing", relation_type_id: "item", target_object_type_id: "item" },
              ],
            },
          },
        }),
      ),
    ).toEqual(["order"]);
  });

  it("leaves metrics without a derived qualifying path unassigned", () => {
    expect(
      rootRelationTypeIds(metric({ kind: "atomic", measure: { aggregation: "count_rows" } })),
    ).toEqual([]);
  });
});
