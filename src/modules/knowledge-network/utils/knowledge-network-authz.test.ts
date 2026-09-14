/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  knowledgeNetworkChildAuthorizationId,
  knowledgeNetworkChildResourceTypes,
} from "./knowledge-network-authz";

describe("knowledge-network authorization references", () => {
  it("uses the canonical parent/child resource ID for each supported child type", () => {
    expect(knowledgeNetworkChildResourceTypes).toEqual([
      "concept_group",
      "object_type",
      "relation_type",
      "action_type",
      "metric",
      "risk_type",
    ]);
    expect(knowledgeNetworkChildAuthorizationId("kn-1", "child-1")).toBe("kn-1/child-1");
  });
});
