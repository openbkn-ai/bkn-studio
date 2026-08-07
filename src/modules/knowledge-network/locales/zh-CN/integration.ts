/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const integrationPart = {
  integration: {
    title: "对接 OpenBKN 能力",
    description:
      "面向智能体平台和业务系统提供统一调用入口。MCP 用于智能体工具调用，CLI 用于终端与 Agent，SDK 用于 Node.js 服务端集成。",
    modeLabel: "接入方式",
    tabsAriaLabel: "知识网络对接方式",
    tabs: {
      mcp: "MCP 对接",
      cli: "CLI 对接",
      sdk: "SDK 对接",
    },
    issueApiKey: "签发 API Key",
    packageLabel: "查看 npm 包",
    copy: "复制",
    copyFailed: "复制失败，请手动复制代码",
    cli: {
      guideTitle: "通过 CLI 调用 OpenBKN",
      guideDescription:
        "适用于本地终端、CI/CD 和具备 Shell 能力的 Agent。CLI 使用同一套平台能力，无需自行实现接口协议。",
      steps: {
        install: "全局安装 @openbkn/bkn-sdk，获得 openbkn 命令。",
        token: "在个人中心签发 API Key，并通过 BKN_TOKEN 环境变量登录目标 OpenBKN 环境。",
        context: "通过 context 命令检索知识模型、查询实例或发现 MCP 工具。",
        skill: "为 Agent 安装 OpenBKN Skill 后，可按自然语言选择对应命令。",
      },
      note: "API Key 当前用于 Context Loader 命令；在个人中心签发后通过 BKN_TOKEN 注入终端环境。",
      title: "CLI 调用示例",
      ariaLabel: "CLI 示例",
      successMessage: "CLI 示例已复制",
      examples: {
        setup: {
          label: "安装与认证",
          title: "安装 OpenBKN CLI 并配置访问凭证",
          code: `npm install -g @openbkn/bkn-sdk

export BKN_BASE_URL="{{platformOrigin}}"
export BKN_TOKEN="bak_<在个人中心 API Key 签发>"

openbkn auth login "$BKN_BASE_URL" --token "$BKN_TOKEN"
openbkn --version`,
        },
        context: {
          label: "知识网络查询",
          title: "从终端检索知识模型、查询实例和发现工具",
          code: `openbkn context search-schema <kn-id> "查询订单相关对象和关系"

openbkn context query-object-instance <kn-id> --args '{
  "ot_id": "order",
  "limit": 20
}'

openbkn context tools <kn-id>`,
        },
        "agent-skill": {
          label: "Agent Skill",
          title: "为具备终端能力的 Agent 安装 OpenBKN Skill",
          code: `npm install -g @openbkn/bkn-sdk
npx skills add openbkn-ai/bkn-sdk@openbkn -g -y

export BKN_BASE_URL="{{platformOrigin}}"
export BKN_TOKEN="bak_<在个人中心 API Key 签发>"

openbkn auth login "$BKN_BASE_URL" --token "$BKN_TOKEN"
openbkn help all`,
        },
      },
    },
    sdk: {
      guideTitle: "通过 SDK 集成 OpenBKN",
      guideDescription:
        "适用于 Node.js 服务端项目。SDK 已封装认证、MCP 会话、JSON-RPC 调用与响应解析，无需自行维护 HTTP 请求协议。",
      steps: {
        install: "安装 @openbkn/bkn-sdk。",
        token: "在个人中心签发 API Key，并通过 BKN_BASE_URL 和 BKN_TOKEN 配置服务端。",
        client: "创建客户端后，通过 bkn.context 调用知识网络能力。",
        tools: "按需查询对象实例，或发现并调用动态 MCP 工具。",
      },
      installSuccessMessage: "SDK 安装命令已复制",
      installTitle: "安装 SDK",
      note: "API Key 当前用于 bkn.context；仅在个人中心管理，服务端通过 BKN_TOKEN 环境变量读取。",
      title: "SDK 调用示例",
      ariaLabel: "SDK 示例",
      successMessage: "SDK 示例已复制",
      examples: {
        "quick-start": {
          label: "快速开始",
          title: "创建 SDK 客户端并检索知识模型",
          code: `import { createClient } from "@openbkn/bkn-sdk";

const bkn = createClient({
  baseUrl: process.env.BKN_BASE_URL!,
  token: process.env.BKN_TOKEN!,
});

const result = await bkn.context.searchSchema(
  "your_kn_id",
  "查询订单相关对象和关系",
  { searchScope: ["object", "relation"], maxConcepts: 10 },
);`,
        },
        "instance-query": {
          label: "查询实例",
          title: "按对象类与条件查询对象实例",
          code: `const result = await bkn.context.queryObjectInstance("your_kn_id", {
  ot_id: "order",
  condition: {
    operation: "and",
    sub_conditions: [
      { field: "status", operation: "==", value_from: "const", value: "paid" },
    ],
  },
  limit: 20,
});`,
        },
        "dynamic-tool": {
          label: "动态工具",
          title: "发现并调用当前知识网络开放的 MCP 工具",
          code: `const tools = await bkn.context.tools("your_kn_id");

const result = await bkn.context.toolCall("your_kn_id", "search_schema", {
  query: "查询订单相关对象和关系",
  response_format: "json",
});`,
        },
      },
    },
  },
} as const;
