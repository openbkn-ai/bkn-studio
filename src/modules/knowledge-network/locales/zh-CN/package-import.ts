/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const packageImportPart = {
  packageImport: {
    reason: {
      ambiguous_name: "有多个同名的，没有自动选择",
      execution_factory_unreachable: "执行工厂暂时连不上",
      knowledge_base_service_unreachable: "知识库服务暂时连不上",
      not_found: "当前环境里没有找到",
      not_supported: "当前部署没有知识库服务",
      not_usable: "已找到，但还没有发布或已停用",
      other: "其他原因",
    },
    type: {
      function: "函数",
      knowledge_base: "知识库",
      mcp_tool: "MCP 工具",
      skill: "SKILL",
      other: "能力",
    },
  },
} as const;
