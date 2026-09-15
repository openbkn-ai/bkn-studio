/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  formatKnowledgeNetworkObjectTypeIndexStateLabel,
} from "@/modules/knowledge-network/utils/resource-index-state";

describe("formatKnowledgeNetworkObjectTypeIndexStateLabel", () => {
  it("uses the knowledge-network authorized index summary", () => {
    const t = ((key: string) => key) as never;
    expect(formatKnowledgeNetworkObjectTypeIndexStateLabel(true, t)).toBe(
      "knowledgeNetwork.previewIndexed",
    );
    expect(formatKnowledgeNetworkObjectTypeIndexStateLabel(false, t)).toBe(
      "knowledgeNetwork.previewNotIndexed",
    );
  });
});
