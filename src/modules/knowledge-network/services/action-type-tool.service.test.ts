/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { resolveActionSourceDisplayNames } from "@/modules/knowledge-network/services/action-type-tool.service";
import { getActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";

describe("resolveActionSourceDisplayNames", () => {
  it("resolves toolbox and tool display names from catalog by id", async () => {
    const resolved = await resolveActionSourceDisplayNames({
      boxId: "box-data-analyst",
      toolId: "intent_understanding",
      type: "tool",
    });

    expect(resolved).toMatchObject({
      boxId: "box-data-analyst",
      boxName: "数据分析员工具",
      toolId: "intent_understanding",
      toolName: "意图理解",
      type: "tool",
    });
    expect(getActionSourceDisplayName(resolved)).toBe("数据分析员工具/意图理解");
  });

  it("refreshes stale display names so renames are reflected", async () => {
    const resolved = await resolveActionSourceDisplayNames({
      boxId: "box-data-analyst",
      boxName: "旧工具箱名",
      toolId: "intent_understanding",
      toolName: "旧工具名",
      type: "tool",
    });

    expect(resolved?.boxName).toBe("数据分析员工具");
    expect(resolved?.toolName).toBe("意图理解");
  });

  it("keeps the original source when catalog lookup misses", async () => {
    const source = {
      boxId: "missing-box",
      toolId: "missing-tool",
      type: "tool" as const,
    };

    await expect(resolveActionSourceDisplayNames(source)).resolves.toEqual(source);
    expect(getActionSourceDisplayName(source)).toBe("missing-box/missing-tool");
  });

  it("leaves manual sources unchanged", async () => {
    const source = {
      toolName: "手动行动",
      type: "manual" as const,
    };

    await expect(resolveActionSourceDisplayNames(source)).resolves.toEqual(source);
  });
});
