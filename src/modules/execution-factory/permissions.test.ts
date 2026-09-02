/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { filterAccessibleExecutionUnitTabs } from "@/modules/execution-factory/permissions";

describe("filterAccessibleExecutionUnitTabs", () => {
  const tabs = ["operator", "toolbox", "mcp", "skill"] as const;

  it.each([
    ["function", ["execution-factory:operator:view"], ["operator"]],
    ["toolbox", ["execution-factory:toolbox:view"], ["toolbox"]],
    ["MCP", ["execution-factory:mcp:view"], ["mcp"]],
    ["Skill", ["execution-factory:skill:view"], ["skill"]],
    [
      "MCP and Skill",
      ["execution-factory:mcp:view", "execution-factory:skill:view"],
      ["mcp", "skill"],
    ],
  ])("keeps only tabs readable by %s", (_name, permissions, expected) => {
    expect(filterAccessibleExecutionUnitTabs([...tabs], permissions)).toEqual(expected);
  });
});
