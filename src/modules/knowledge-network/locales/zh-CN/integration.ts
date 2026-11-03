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
      "面向智能体平台和业务系统提供统一调用入口。MCP 用于智能体工具调用，CLI 用于终端与 Agent，SDK 用于基于知识网络开发应用。",
    descriptionHelpLabel: "查看接入方式说明",
    modeLabel: "接入方式",
    tabsAriaLabel: "知识网络对接方式",
    tabs: {
      mcp: "MCP 对接",
      cli: "CLI 对接",
      sdk: "SDK 对接",
    },
    mcpWorkspace: {
      tabsAriaLabel: "MCP 对接工作台",
      tabs: {
        connect: "客户端接入",
        debug: "工具调试",
      },
      guide: {
        heading: "在线调试 MCP 工具",
        description:
          "直接调用平台开放给智能体的 MCP 工具，查看每个工具的参数定义、请求和返回结果。接入客户端前，可以先在这里确认工具在这个知识网络上能正常工作。",
        steps: {
          pick: "在右侧选择要调试的知识网络，页面会加载这个网络可用的工具。",
          tool: "在左侧列表里选一个工具，查看它的「接口文档」；点「自动填参」，用网络的真实结构和样本数据生成请求。",
          run: "点「运行」查看返回结果；在「请求调试」里可以复制本次调用的 cURL 命令，在终端里复现。",
        },
        eyebrow: "MCP tools/call",
        title: "选择知识网络",
        open: "开始调试",
      },
      networkLabel: "知识网络",
      networkLoading: "正在加载知识网络……",
      networkPlaceholder: "请选择知识网络",
      networkNoMatch: "未找到匹配的知识网络",
      openNetwork: "查看知识网络",
      retry: "重试",
      loadFailedTitle: "知识网络加载失败",
      loadFailedDescription: "暂时无法获取可调试的知识网络，请重试。",
      networkUnavailableDescription: "链接中的知识网络不存在或当前账号无权访问，请重新选择。",
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
    // The knowledge network picker shared by the SDK tab and tool debugging.
    networkPicker: {
      searchPlaceholder: "搜索知识网络名称",
      loading: "正在加载知识网络……",
      loadFailed: "知识网络加载失败。",
      retry: "重试",
      noNetworks: "还没有可用的知识网络。",
      noMatch: "没有匹配的知识网络。",
    },
    // The SDK tab only links on: SDK examples are generated per network, on its 应用开发 page.
    sdk: {
      guideTitle: "基于知识网络开发应用",
      guideDescription:
        "SDK 示例按知识网络的真实结构生成，放在每个网络的「应用开发」页：对象类、关系、行动、函数等能力，每项都有 Python、TypeScript 和 REST 写法。",
      steps: {
        pick: "在右侧选择知识网络，进入它的「应用开发」页。",
        start: "在「应用开发」页按步骤获取令牌、安装 SDK，并生成这个网络的本体 SDK。",
        examples:
          "复制各项能力的示例，或下载完整的问答网页示例。整页也可以导出为 Markdown，交给开发者或编程 Agent。",
      },
      eyebrow: "Python / TypeScript / REST",
      open: "进入应用开发",
      title: "选择知识网络",
    },
  },
} as const;
