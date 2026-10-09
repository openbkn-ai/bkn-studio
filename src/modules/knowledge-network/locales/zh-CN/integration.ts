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
    packageLabel: "查看 npm 包",
    copy: "复制",
    copyFailed: "复制失败，请手动复制代码",
    cli: {
      guideTitle: "通过 CLI 调用 OpenBKN",
      guideDescription:
        "适用于本地终端、CI/CD 和具备 Shell 能力的 Agent。默认通过 OAuth 账号会话访问平台能力，无需自行实现接口协议。",
      steps: {
        install: "全局安装 @openbkn/bkn-sdk，获得 openbkn 命令。",
        token: "使用 OpenBKN 账号登录，CLI 会保存并自动刷新 OAuth 会话。",
        context: "先通过 bkn list 获取知识网络 ID，再按需调用平台或 context 命令。",
        skill: "为 Agent 安装 OpenBKN Skill 后，可按自然语言选择对应命令。",
      },
      title: "CLI 调用示例",
      ariaLabel: "CLI 示例",
      successMessage: "CLI 示例已复制",
      examples: {
        setup: {
          label: "安装与认证",
          title: "安装 OpenBKN CLI 并登录账号",
          code: `npm install -g @openbkn/bkn-sdk

export BKN_BASE_URL="{{platformOrigin}}"
# 场景 1：本地终端，在浏览器中完成账号登录
openbkn auth login "$BKN_BASE_URL"

# 场景 2：无图形环境，使用账号密码进行无交互登录（二选一）
# openbkn auth login "$BKN_BASE_URL" -u "<账号>" -p "<密码>"

# 验证登录状态，并查看可访问的知识网络
openbkn auth status
openbkn bkn list --limit 10`,
        },
        context: {
          label: "知识网络查询",
          title: "常见场景：检索模型、查询实例和发现工具",
          code: `# 场景 1：检索知识模型
openbkn context search-schema <kn-id> "查询订单相关对象和关系"

# 场景 2：查询对象实例
openbkn context query-object-instance <kn-id> --args '{
  "ot_id": "order",
  "limit": 20
}'

# 场景 3：发现可用工具
openbkn context tools <kn-id>`,
        },
        "agent-skill": {
          label: "Agent Skill",
          title: "为具备终端能力的 Agent 安装 OpenBKN Skill",
          code: `npm install -g @openbkn/bkn-sdk
npx skills add openbkn-ai/bkn-sdk@openbkn -g -y

export BKN_BASE_URL="{{platformOrigin}}"
# 首次使用时完成账号登录；之后复用保存的 OAuth 会话
openbkn auth login "$BKN_BASE_URL"
openbkn help all`,
        },
      },
    },
    sdk: {
      guideTitle: "通过 SDK 集成 OpenBKN",
      guideDescription:
        "适用于 Node.js 服务端项目。SDK 使用账号密码建立并自动刷新 OAuth 会话，同时封装平台请求、MCP 会话、JSON-RPC 调用与响应解析。",
      steps: {
        install: "安装 @openbkn/bkn-sdk。",
        token: "配置 OpenBKN 账号和密码；SDK 会建立可自动刷新的 OAuth 会话。",
        client: "异步创建已认证客户端，并传入平台地址。",
        tools:
          "先获取知识网络 ID；随后可调用 bkn、resource、vega 或 context 能力，具体范围由账号权限决定。",
      },
      installSuccessMessage: "SDK 安装命令已复制",
      installTitle: "安装 SDK",
      title: "SDK 调用示例",
      ariaLabel: "SDK 示例",
      successMessage: "SDK 示例已复制",
      examples: {
        "quick-start": {
          label: "快速开始",
          title: "使用账号密码创建已认证客户端并检索知识模型",
          code: `import { createAuthenticatedClient } from "@openbkn/bkn-sdk";

const bkn = await createAuthenticatedClient({
  baseUrl: process.env.BKN_BASE_URL!,
  // 仅受信任的自签名测试环境设置 BKN_INSECURE=true。
  insecure: process.env.BKN_INSECURE === "true",
  auth: {
    username: process.env.BKN_USERNAME!,
    password: process.env.BKN_PASSWORD!,
  },
});

// 将知识网络 ID 配置给服务。
const knId = process.env.BKN_KN_ID!;

const result = await bkn.context.searchSchema(
  knId,
  "查询订单相关对象和关系",
  { searchScope: ["object", "relation"], maxConcepts: 10 },
);`,
        },
        "instance-query": {
          label: "查询实例",
          title: "按对象类与条件查询对象实例",
          code: `const result = await bkn.context.queryObjectInstance(knId, {
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
          code: `// 步骤 1：发现当前知识网络开放的工具
const tools = await bkn.context.tools(knId);

// 步骤 2：调用指定工具
const result = await bkn.context.toolCall(knId, "search_schema", {
  query: "查询订单相关对象和关系",
  response_format: "json",
});`,
        },
      },
    },
  },
} as const;
