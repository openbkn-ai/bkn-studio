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
  /** Present only for function toolboxes after loading individual details; omit entry checks when unavailable rather than treating it as missing. */
  code?: string;
  description?: string;
  metadataType?: ToolMetadataType;
  name?: string;
  status?: "enabled" | "disabled";
};

/**
 * Two valid entry points: legacy `def handler(event)` and sandbox_sdk's `@tool` decorator, where
 * users write ordinary typed functions and the SDK unwraps event. Recognizing only handler would reject the latter.
 */
const ENTRYPOINT_PATTERNS = [/def\s+handler\s*\(/, /^\s*@tool\b/m];

/**
 * Published tools are immediately available to the Agent; tools without descriptions are effectively never chosen.
 * Check only conditions that can be determined locally. When code is unavailable, avoid guessing or reporting a false issue.
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
