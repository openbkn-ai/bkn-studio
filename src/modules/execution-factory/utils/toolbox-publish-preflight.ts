/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ToolMetadataType } from "@/modules/execution-factory/types/tool";

export type ToolboxPublishIssue = {
  key: string;
  params?: Record<string, string | number>;
};

export type PreflightTool = {
  /** 只有函数工具箱、且逐个取过详情时才有值；未取到时跳过入口检查而不是当作缺失。 */
  code?: string;
  description?: string;
  metadataType?: ToolMetadataType;
  name?: string;
  status?: "enabled" | "disabled";
};

/**
 * 两种合法入口：老路的 `def handler(event)`，以及 sandbox_sdk 的 `@tool` 装饰器
 * （用户写普通带类型注解的函数，SDK 负责解包 event）。只认 handler 会误伤后者。
 */
const ENTRYPOINT_PATTERNS = [/def\s+handler\s*\(/, /^\s*@tool\b/m];

/**
 * 发布后这些工具会直接暴露给 Agent 选用，描述缺失的工具等于永远不会被调用。
 * 这里只做能本地判定的检查，判不了的（比如没取到代码）宁可不报，不猜。
 */
export function collectToolboxPublishIssues(tools: PreflightTool[]): ToolboxPublishIssue[] {
  const issues: ToolboxPublishIssue[] = [];

  if (tools.length === 0) {
    return [{ key: "emptyToolbox" }];
  }

  tools.forEach((tool, index) => {
    const displayName = tool.name?.trim();

    if (!displayName) {
      issues.push({ key: "toolMissingName", params: { index: index + 1 } });
      return;
    }

    if (!tool.description?.trim()) {
      issues.push({ key: "toolMissingDescription", params: { name: displayName } });
    }

    if (
      tool.metadataType === "function" &&
      tool.code !== undefined &&
      !ENTRYPOINT_PATTERNS.some((pattern) => pattern.test(tool.code ?? ""))
    ) {
      issues.push({ key: "toolMissingHandler", params: { name: displayName } });
    }
  });

  if (tools.every((tool) => tool.status === "disabled")) {
    issues.push({ key: "allToolsDisabled" });
  }

  return issues;
}
