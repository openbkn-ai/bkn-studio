/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  canAccessExecutionUnitManagement,
  canViewExecutionUnitManagement,
  filterAccessibleExecutionUnitTabs,
  filterAccessibleToolboxViews,
} from "@/modules/execution-factory/permissions";

describe("filterAccessibleExecutionUnitTabs", () => {
  const tabs = ["toolbox", "mcp", "skill"] as const;

  it.each([
    ["function", ["execution-factory:function:view"], ["toolbox"]],
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

  it("does not allow entry when the user has neither an execution-unit view nor create grant", () => {
    expect(canAccessExecutionUnitManagement([])).toBe(false);
    expect(canAccessExecutionUnitManagement(["knowledge-network:view"])).toBe(false);
  });

  it("allows the management list when the user can view at least one execution-unit type", () => {
    expect(canAccessExecutionUnitManagement(["execution-factory:mcp:view"])).toBe(true);
    expect(canViewExecutionUnitManagement(["execution-factory:mcp:view"])).toBe(true);
  });

  it("allows entry but not list mounting for a create-only user", () => {
    const permissions = ["execution-factory:function:create"];
    expect(canAccessExecutionUnitManagement(permissions)).toBe(true);
    expect(canViewExecutionUnitManagement(permissions)).toBe(false);
  });
});

describe("filterAccessibleToolboxViews", () => {
  it.each([
    [["execution-factory:function:view"], ["function"]],
    [["execution-factory:toolbox:view"], ["openapi"]],
    [
      ["execution-factory:toolbox:view", "execution-factory:function:view"],
      ["openapi", "function"],
    ],
  ])("keeps only resource views the user can read", (permissions, expected) => {
    expect(filterAccessibleToolboxViews(permissions)).toEqual(expected);
  });
});
