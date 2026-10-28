/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const packageImportPart = {
  packageImport: {
    file: "BKN 包：{{name}}",
    conflictTip:
      "BKN 包里的名称和 ID 不能在这里修改。你可以覆盖现有知识网络，或忽略已有内容只导入不存在的部分。",
    successBound: "导入成功，绑定了 {{count}} 项能力。",
    successBound_one: "导入成功，绑定了 {{count}} 项能力。",
    successBound_other: "导入成功，绑定了 {{count}} 项能力。",
    skippedTitle: "已导入，有 {{count}} 项能力没有绑定",
    skippedTitle_one: "已导入，有 {{count}} 项能力没有绑定",
    skippedTitle_other: "已导入，有 {{count}} 项能力没有绑定",
    skippedDescription:
      "知识网络已经导入，并绑定了 {{count}} 项能力。下面这些能力没能在当前环境里绑定，可以之后在知识网络的能力页里手动挂载。",
    skippedDescription_one:
      "知识网络已经导入，并绑定了 {{count}} 项能力。下面这些能力没能在当前环境里绑定，可以之后在知识网络的能力页里手动挂载。",
    skippedDescription_other:
      "知识网络已经导入，并绑定了 {{count}} 项能力。下面这些能力没能在当前环境里绑定，可以之后在知识网络的能力页里手动挂载。",
    skipItem: "{{type}} · {{name}}",
    skipItemInBox: "{{type}} · {{name}}（{{box}}）",
    unnamed: "未命名",
    done: "知道了",
    reason: {
      ambiguous_name: "有多个同名的，没有自动选择",
      execution_factory_unreachable: "执行工厂暂时连不上",
      knowledge_base_service_unreachable: "知识库服务暂时连不上",
      not_found: "当前环境里没有找到",
      not_supported: "当前部署不支持这类能力",
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
