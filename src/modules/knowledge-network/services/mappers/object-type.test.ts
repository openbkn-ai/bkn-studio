/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapObjectType } from "@/modules/knowledge-network/services/mappers";
import { formatKnowledgeNetworkObjectTypeIndexStateLabel } from "@/modules/knowledge-network/utils/resource-index-state";

describe("mapObjectType index status", () => {
  it("treats a missing response-time status as unknown instead of not indexed", () => {
    const record = mapObjectType({
      data_source: { id: "resource-payment", type: "resource" },
      id: "payment",
      name: "Payment",
    });
    const t = ((key: string) => key) as never;

    expect(record.indexStatus).toEqual({ state: "unknown" });
    expect(record.hasIndex).toBe(false);
    expect(
      formatKnowledgeNetworkObjectTypeIndexStateLabel(record.indexStatus ?? record.hasIndex, t),
    ).toBe("knowledgeNetwork.objectTypeIndexStateUnknown");
  });

  it("keeps an available response-time status as the boolean graph projection", () => {
    const record = mapObjectType({
      id: "payment",
      index_status: { state: "available", source_status: "available" },
      name: "Payment",
    });

    expect(record.indexStatus).toEqual({ state: "available", sourceStatus: "available" });
    expect(record.hasIndex).toBe(true);
  });
});
