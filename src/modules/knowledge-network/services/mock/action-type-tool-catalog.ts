/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ActionTypeCatalogTool,
  ActionTypeExecutionFactoryCatalog,
  ActionTypeMcpServer,
  ActionTypeToolBox,
} from "@/modules/knowledge-network/services/action-type-tool.service";

const MOCK_TOOL_BOXES: ActionTypeToolBox[] = [
  {
    boxId: "box-data-analyst",
    boxName: "数据分析员工具",
    description: "包含数据分析工具，支持意图理解、问数、找数等功能",
    tools: [
      {
        parameters: [{ name: "query", required: true, type: "string" }],
        toolId: "intent_understanding",
        toolName: "意图理解",
      },
      {
        parameters: [{ name: "question", required: true, type: "string" }],
        toolId: "ask_data",
        toolName: "问数",
      },
    ],
  },
  {
    boxId: "box-data-understanding",
    boxName: "数据理解工具箱",
    description: "数据理解 openbkn",
    tools: [
      {
        parameters: [{ name: "dataset_id", required: true, type: "string" }],
        toolId: "openbkn_understand",
        toolName: "openbkn 数据理解",
      },
    ],
  },
  {
    boxId: "box-sandbox",
    boxName: "沙箱代码执行工具",
    description: "执行 python 代码并返回执行结果",
    tools: [
      {
        parameters: [{ name: "code", required: true, type: "string" }],
        toolId: "python_sandbox",
        toolName: "Python 沙箱",
      },
    ],
  },
  {
    boxId: "box-agent-observability",
    boxName: "Agent可观测数据查询API",
    description: "查询 Agent/Session/Run 的可观测数据和配置信息",
    tools: [
      {
        parameters: [{ name: "run_id", required: true, type: "string" }],
        toolId: "agent_observability_query",
        toolName: "可观测数据查询",
      },
    ],
  },
  {
    boxId: "box-web-search",
    boxName: "联网搜索添加引用工具",
    description: "包含一个工具，用于联网搜索并添加引用",
    tools: [
      {
        parameters: [{ name: "keyword", required: true, type: "string" }],
        toolId: "web_search_citation",
        toolName: "联网搜索引用",
      },
    ],
  },
  {
    boxId: "box-data-agent-config",
    boxName: "DataAgent配置相关工具",
    description: "获取 agent 配置详情",
    tools: [
      {
        parameters: [{ name: "agent_id", required: true, type: "string" }],
        toolId: "get_agent_config",
        toolName: "获取 Agent 配置",
      },
    ],
  },
  {
    boxId: "box-memory",
    boxName: "记忆管理",
    description: "包含 记忆构建&召回 两个工具",
    tools: [
      {
        parameters: [{ name: "content", required: true, type: "string" }],
        toolId: "memory_build",
        toolName: "记忆构建",
      },
      {
        parameters: [{ name: "query", required: true, type: "string" }],
        toolId: "memory_recall",
        toolName: "记忆召回",
      },
    ],
  },
  {
    boxId: "box-risk",
    boxName: "Risk Tools",
    description: "风险域行动工具箱",
    tools: [
      {
        parameters: [{ name: "order_id", required: true, type: "string" }],
        toolId: "block_order_tool",
        toolName: "Block Order",
      },
    ],
  },
  {
    boxId: "box-supply",
    boxName: "Supply Tools",
    description: "供应链通知工具箱",
    tools: [
      {
        parameters: [
          { name: "supplier_id", required: true, type: "string" },
          { name: "message", required: false, type: "string" },
        ],
        toolId: "notify_supplier",
        toolName: "Notify Supplier",
      },
    ],
  },
];

const MOCK_MCP_SERVERS: ActionTypeMcpServer[] = [
  {
    description: "内置文件与检索 MCP 服务",
    mcpId: "mcp-filesystem",
    mcpName: "文件系统 MCP",
    tools: [
      {
        parameters: [{ name: "path", required: true, type: "string" }],
        toolId: "read_file",
        toolName: "read_file",
      },
      {
        parameters: [{ name: "query", required: true, type: "string" }],
        toolId: "search_docs",
        toolName: "search_docs",
      },
    ],
  },
];

export const MOCK_EXECUTION_FACTORY_CATALOG: ActionTypeExecutionFactoryCatalog = {
  mcpServers: MOCK_MCP_SERVERS,
  toolBoxes: MOCK_TOOL_BOXES,
};

export function flattenCatalogTools(catalog: ActionTypeExecutionFactoryCatalog) {
  const toolEntries = catalog.toolBoxes.flatMap((box) =>
    box.tools.map((tool) => ({
      boxId: box.boxId,
      boxName: box.boxName,
      parameters: tool.parameters.map((item) => ({ ...item })),
      toolId: tool.toolId,
      toolName: tool.toolName,
      type: "tool" as const,
    })),
  );

  const mcpEntries = catalog.mcpServers.flatMap((server) =>
    server.tools.map((tool) => ({
      boxId: server.mcpId,
      boxName: server.mcpName,
      parameters: tool.parameters.map((item) => ({ ...item })),
      toolId: tool.toolId,
      toolName: tool.toolName,
      type: "tool" as const,
    })),
  );

  return [...toolEntries, ...mcpEntries];
}

export function findCatalogTool(
  catalog: ActionTypeExecutionFactoryCatalog,
  actionSource?: {
    boxId?: string;
    mcpId?: string;
    toolId?: string;
    type?: string;
  },
): { parameters: ActionTypeCatalogTool["parameters"]; tool: ActionTypeCatalogTool } | undefined {
  if (!actionSource?.toolId) {
    return undefined;
  }

  if (actionSource.type === "mcp" && actionSource.mcpId) {
    const server = catalog.mcpServers.find((item) => item.mcpId === actionSource.mcpId);
    const tool = server?.tools.find((item) => item.toolId === actionSource.toolId);
    if (server && tool) {
      return { parameters: tool.parameters, tool };
    }
  }

  const box = catalog.toolBoxes.find((item) => item.boxId === actionSource.boxId);
  const tool = box?.tools.find((item) => item.toolId === actionSource.toolId);
  if (box && tool) {
    return { parameters: tool.parameters, tool };
  }

  for (const server of catalog.mcpServers) {
    const mcpTool = server.tools.find((item) => item.toolId === actionSource.toolId);
    if (mcpTool && (!actionSource.mcpId || server.mcpId === actionSource.mcpId)) {
      return { parameters: mcpTool.parameters, tool: mcpTool };
    }
  }

  for (const toolBox of catalog.toolBoxes) {
    const boxTool = toolBox.tools.find((item) => item.toolId === actionSource.toolId);
    if (boxTool && (!actionSource.boxId || toolBox.boxId === actionSource.boxId)) {
      return { parameters: boxTool.parameters, tool: boxTool };
    }
  }

  return undefined;
}
