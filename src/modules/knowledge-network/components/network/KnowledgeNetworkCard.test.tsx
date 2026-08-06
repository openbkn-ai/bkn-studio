/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatKnowledgeNetworkUpdateTime } from "./knowledge-network-card";

describe("formatKnowledgeNetworkUpdateTime", () => {
  it("removes seconds only from a complete time value", () => {
    expect(formatKnowledgeNetworkUpdateTime("2026-08-06 14:30:45")).toBe("2026-08-06 14:30");
    expect(formatKnowledgeNetworkUpdateTime("2026-08-06 14:30")).toBe("2026-08-06 14:30");
  });

  it("preserves existing empty-state values", () => {
    expect(formatKnowledgeNetworkUpdateTime("-")).toBe("-");
    expect(formatKnowledgeNetworkUpdateTime("")).toBe("--");
    expect(formatKnowledgeNetworkUpdateTime()).toBe("--");
  });
});
