/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  filterAuthorizedCapabilityCreateMenuItems,
  getCapabilityCreateMenuItems,
  resolveCapabilityAdpImportTab,
} from "@/modules/execution-factory/utils/capability-create-menu";

function visibleActions(permissions: string[]) {
  return filterAuthorizedCapabilityCreateMenuItems(
    getCapabilityCreateMenuItems(),
    permissions,
  ).map((item) => item.action);
}

describe("capability create menu authorization", () => {
  it("offers one create entry per capability tab, without import entries", () => {
    const items = getCapabilityCreateMenuItems();

    expect(items.map((item) => item.action)).toEqual([
      "quick-api",
      "function",
      "mcp",
      "skill",
    ]);
    expect(items.map((item) => item.action)).not.toContain("import-openapi");
    expect(items.map((item) => item.action)).not.toContain("import-adp");
  });

  it("returns a fresh model for every entry point", () => {
    const toolbarMenu = getCapabilityCreateMenuItems();
    const emptyStateMenu = getCapabilityCreateMenuItems();

    expect(emptyStateMenu).toEqual(toolbarMenu);
    expect(emptyStateMenu).not.toBe(toolbarMenu);
  });

  it("routes ADP import to an import-capable tab", () => {
    expect(resolveCapabilityAdpImportTab("toolbox")).toBe("toolbox");
    expect(resolveCapabilityAdpImportTab("mcp")).toBe("mcp");
    expect(resolveCapabilityAdpImportTab("operator")).toBe("operator");
    expect(resolveCapabilityAdpImportTab("skill")).toBe("toolbox");
  });

  it("shows only Skill when the user has only skill:create", () => {
    expect(visibleActions(["execution-factory:skill:create"])).toEqual(["skill"]);
  });

  it("uses toolbox:create for both API and function entries", () => {
    expect(visibleActions(["execution-factory:toolbox:create"])).toEqual([
      "quick-api",
      "function",
    ]);
  });

  it("shows only MCP when the user has only mcp:create", () => {
    expect(visibleActions(["execution-factory:mcp:create"])).toEqual(["mcp"]);
  });

  it("shows the union for mixed grants and nothing without a create grant", () => {
    expect(
      visibleActions([
        "execution-factory:toolbox:create",
        "execution-factory:skill:create",
      ]),
    ).toEqual(["quick-api", "function", "skill"]);
    expect(visibleActions([])).toEqual([]);
  });
});
