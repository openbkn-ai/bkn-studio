/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildLogicPropertyTrialBody } from "@/modules/knowledge-network/lib/build-logic-property-trial-request";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

const gmvMetric: ObjectTypeLogicProperty = {
  dataSource: { id: "metric-1", name: "GMV", type: "metric" },
  displayName: "GMV",
  name: "lp_gmv_metric",
  type: "metric",
};

describe("buildLogicPropertyTrialBody", () => {
  it("builds the direct ontology-query payload with deterministic metric parameters", () => {
    expect(
      buildLogicPropertyTrialBody({
        instanceIdentities: [{ order_id: "1001" }],
        logicProperties: [gmvMetric],
        nowMs: 1786022400000,
      }),
    ).toEqual({
      _instance_identities: [{ order_id: "1001" }],
      dynamic_params: {
        lp_gmv_metric: {
          end: 1786022400000,
          instant: true,
          start: 946684800000,
        },
      },
      properties: ["lp_gmv_metric"],
    });
  });

  it("does not add dynamic parameters for non-metric properties", () => {
    expect(
      buildLogicPropertyTrialBody({
        instanceIdentities: [{ order_id: "1001" }],
        logicProperties: [{ displayName: "Tool", name: "tool_value", type: "tool" }],
        nowMs: 1786022400000,
      }),
    ).toEqual({
      _instance_identities: [{ order_id: "1001" }],
      properties: ["tool_value"],
    });
  });
});
