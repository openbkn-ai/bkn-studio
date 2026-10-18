/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  narrow,
  selectableTools,
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";

describe("bkn-agent settings", () => {
  it("narrows like the server: tools intersect and limits take the minimum", () => {
    const upper = {
      limits: { max_turns: 40, timeout_s: 300, max_tool_calls: null },
      allowed_tools: ["a", "b", "c"],
    };
    expect(
      narrow(upper, { allowed_tools: ["b", "x"], limits: { max_turns: 60, timeout_s: 60 } }),
    ).toEqual({
      limits: { max_turns: 40, timeout_s: 60, max_tool_calls: null },
      allowed_tools: ["b"],
    });
    // An unset layer follows the layer above.
    expect(narrow(upper, {})).toEqual(upper);
    expect(narrow(upper, null)).toBe(upper);
  });

  it("offers only tools the public surface can run", () => {
    expect(
      selectableTools(["bkn_start_interaction", "run_code", "search_schema", "run_cypher"]),
    ).toEqual(["search_schema", "run_cypher"]);
  });
});
