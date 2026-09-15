/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  canAccessExecutionUnitManagement,
  filterAccessibleExecutionUnitTabs,
} from "@/modules/execution-factory/permissions";

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
  ])("keeps only tabs accessible by %s", (_name, permissions, expected) => {
    expect(filterAccessibleExecutionUnitTabs([...tabs], permissions)).toEqual(expected);
  });

  it.each([
    ["operator:create", "execution-factory:operator:create", "operator"],
    ["tool_box:create", "execution-factory:toolbox:create", "toolbox"],
    ["mcp:create", "execution-factory:mcp:create", "mcp"],
    ["skill:create", "execution-factory:skill:create", "skill"],
  ])("keeps the target tab available with only %s", (_name, permission, expected) => {
    expect(filterAccessibleExecutionUnitTabs([...tabs], [permission])).toEqual([expected]);
  });

  it("does not mount the management list when the user has no execution-unit view grant", () => {
    expect(canAccessExecutionUnitManagement([])).toBe(false);
    expect(canAccessExecutionUnitManagement(["knowledge-network:view"])).toBe(false);
  });

  it("allows the management list when the user can view at least one execution-unit type", () => {
    expect(canAccessExecutionUnitManagement(["execution-factory:mcp:view"])).toBe(true);
  });

  it("allows the management list when the user can only create an execution-unit type", () => {
    expect(canAccessExecutionUnitManagement(["execution-factory:mcp:create"])).toBe(true);
  });
});
