/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

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

import { listKnowledgeNetworkActionTypes } from "./action-type.service";
import { listKnowledgeNetworkConceptGroups } from "./concept-group.service";
import { listKnowledgeNetworkMetrics } from "./metric.service";
import { listKnowledgeNetworkObjectTypes } from "./object-type.service";

describe("knowledge-network mock child operations", () => {
  it("projects operations on every list response used by operation-gated menus", async () => {
    const networkId = "kn-domain-risk";
    const [conceptGroups, objectTypes, actionTypes, metrics] = await Promise.all([
      listKnowledgeNetworkConceptGroups(networkId),
      listKnowledgeNetworkObjectTypes(networkId),
      listKnowledgeNetworkActionTypes(networkId),
      listKnowledgeNetworkMetrics(networkId),
    ]);

    for (const record of [
      conceptGroups[0],
      objectTypes[0],
      actionTypes[0],
      metrics.entries[0],
    ]) {
      expect(record?.operations).toEqual(
        expect.arrayContaining(["modify", "delete", "authorize"]),
      );
    }
  });
});
