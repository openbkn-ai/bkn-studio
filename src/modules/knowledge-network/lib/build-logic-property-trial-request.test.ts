/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildLogicPropertyTrialBody } from "@/modules/knowledge-network/lib/build-logic-property-trial-request";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

const toolProperty: ObjectTypeLogicProperty = {
  dataSource: { id: "tool-1", name: "Discount", type: "tool" },
  displayName: "Discount",
  name: "discount",
  type: "tool",
};

describe("buildLogicPropertyTrialBody", () => {
  it("builds the direct ontology-query payload for instance logic properties", () => {
    expect(
      buildLogicPropertyTrialBody({
        instanceIdentities: [{ order_id: "1001" }],
        logicProperties: [toolProperty],
      }),
    ).toEqual({
      _instance_identities: [{ order_id: "1001" }],
      properties: ["discount"],
    });
  });

  it("does not include unsupported dynamic metric parameters", () => {
    expect(
      buildLogicPropertyTrialBody({
        instanceIdentities: [{ order_id: "1001" }],
        logicProperties: [{ displayName: "Tool", name: "tool_value", type: "tool" }],
      }),
    ).toEqual({
      _instance_identities: [{ order_id: "1001" }],
      properties: ["tool_value"],
    });
  });
});
