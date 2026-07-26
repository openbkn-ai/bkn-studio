/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  getCapabilityCreateMenuItems,
  resolveCapabilityAdpImportTab,
} from "./capability-create-menu";

describe("capability-create-menu", () => {
  it("offers one create entry per capability tab, without import entries", () => {
    const items = getCapabilityCreateMenuItems();

    // 与列表 tab 一一对应：API 工具集 / 函数集 / MCP 服务 / SKILL 包。
    expect(items.map((item) => item.action)).toEqual([
      "quick-api",
      "function",
      "mcp",
      "skill",
    ]);

    // 导入走工具栏「导入」按钮，添加能力里不再出现导入项。
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
});
