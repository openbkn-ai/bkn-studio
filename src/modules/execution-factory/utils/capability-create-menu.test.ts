/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  getCapabilityCreateMenuSections,
  resolveCapabilityAdpImportTab,
} from "./capability-create-menu";

describe("capability-create-menu", () => {
  it("groups create choices by business creation intent", () => {
    const sections = getCapabilityCreateMenuSections();

    expect(sections.map((section) => section.titleKey)).toEqual([
      "executionFactory.capabilityCreateMenu.httpApi",
      "executionFactory.capabilityCreateMenu.mcp",
      "executionFactory.capabilityCreateMenu.skillFunction",
      "executionFactory.capabilityCreateMenu.package",
    ]);

    expect(sections.map((section) => section.items.map((item) => item.action))).toEqual([
      ["quick-api", "import-openapi"],
      ["mcp"],
      ["skill", "function"],
      ["import-adp"],
    ]);
  });

  it("returns a fresh shared model for every entry point", () => {
    const toolbarMenu = getCapabilityCreateMenuSections();
    const emptyStateMenu = getCapabilityCreateMenuSections();

    expect(emptyStateMenu).toEqual(toolbarMenu);
    expect(emptyStateMenu).not.toBe(toolbarMenu);
  });

  it("routes ADP import to an import-capable tab", () => {
    expect(resolveCapabilityAdpImportTab("toolbox")).toBe("toolbox");
    expect(resolveCapabilityAdpImportTab("mcp")).toBe("mcp");
    expect(resolveCapabilityAdpImportTab("operator")).toBe("operator");
    expect(resolveCapabilityAdpImportTab("skill")).toBe("toolbox");
  });
});
