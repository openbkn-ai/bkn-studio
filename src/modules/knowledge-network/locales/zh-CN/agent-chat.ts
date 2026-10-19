/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const agentChatPart = {
  agentChat: {
    fallbackSuggestions: {
      overview: "有哪些数据？先给我一个整体概览",
      changes: "最近有什么值得关注的变化？",
      priorityRecords: "帮我找出最需要重点关注的几条记录",
    },
    templateSuggestions: {
      firstObject: "{{name}}有哪些数据？先看几条",
      group: "{{name}}相关的情况怎么样？",
      relation: "{{name}}的情况怎么样？",
      secondObject: "{{name}}里有什么值得关注的？",
      firstObjectRecent: "{{name}}最近有什么变化？",
    },
    suggestPrompt:
      "你在为一个「智能问数」产品的空白对话页写推荐问题。提问的人是不懂技术的业务人员。\n" +
      "下面是某个业务领域的结构定义 JSON（name/comment 是业务含义，object_types 是业务实体，relation_types 是实体间的业务关联）。\n" +
      "请据此写 3 个该领域业务人员真正会问的问题。硬性要求：\n" +
      "1. 只能引用 JSON 里出现过的业务名词，绝对不要编造里面没有的实体或概念（编造的问题一点就会查不到数据）。\n" +
      "2. 不要出现「对象类」「关系类」「知识网络」「图谱」「schema」「表」「字段」这类技术术语，也不要出现 JSON 里的英文字段名，要像业务人员日常说话。\n" +
      "3. 每个问题一句话、不超过 25 字，且能用数据回答（可查询、可统计、可对比），不要开放式主观题。\n" +
      "4. 3 个问题角度各不相同，不要同义重复。\n" +
      '只输出 JSON 数组，形如 ["问题1","问题2","问题3"]，不要任何其他文字，不要代码块标记。',
    profiles: {
      soloEmptyTitle: "开始验证",
    },
    errors: {
      modelBusy: "模型服务繁忙，请稍后重试",
      modelUnavailableSwitch: "模型服务繁忙，上游建议暂时改用其他模型",
      modelRateLimited: "模型服务被限流，请稍后重试",
      modelServerError: "模型服务内部错误，请稍后重试",
      modelReturnedError: "模型服务返回错误",
      authExpired: "登录状态已失效，请刷新页面重新登录",
      modelNotFound: "模型不存在或未上线，请在「模型工厂」确认模型配置",
      modelTemporaryUnavailable: "模型服务暂时不可用，请稍后重试",
      requestFailedWithStatus: "模型服务请求失败（HTTP {{status}}）",
      requestFailed: "模型服务请求失败",
      unparseableResponse: "模型服务返回了无法解析的响应，请稍后重试或联系管理员",
      connectionInterrupted: "与模型服务的连接中断，请重试",
      chatFailed: "对话执行失败",
    },
    execution: {
      errors: {
        modelUnavailable: "模型服务暂时不可用，请稍后重试",
        modelRejected: "模型服务拒绝了这次请求，请检查模型配置或上下文长度",
        withCause: "{{message}}：{{cause}}",
        failed: "智能问答执行失败，请重试",
        timeout: "智能问答执行超时，请缩小问题范围后重试",
        unavailable: "智能问答依赖的服务暂时不可用，请稍后重试",
        forbidden: "当前账号没有使用智能问答或该知识网络的权限",
        agentNotReady: "智能问答 Agent 尚未发布，请联系管理员完成配置并发布",
        threadBusy: "上一轮问答仍在执行，请稍后重试",
        network: "与智能问答服务的连接中断，请重试",
      },
    },
    config: {
      title: "问答配置",
      sharedTitle: "共享配置",
      sharedDescription:
        "由平台管理员维护，所有网络共用。下面的网络配置和个人偏好只能在此基础上追加或收窄。",
      model: "模型",
      defaultModel: "平台默认模型",
      status: "状态",
      published: "已发布",
      draft: "未发布",
      caps: "执行上限",
      networkTitle: "本网络配置",
      networkDescription:
        "只对当前知识网络生效，所有用户共用。适合写这个网络特有的术语、口径和注意事项。",
      networkReadOnly: "只对当前知识网络生效。你没有修改这个网络的权限，只能查看。",
      userTitle: "我的偏好",
      userDescription: "只对你自己生效，在共享配置和本网络配置之后追加。",
      instruction: "附加提示词",
      instructionPlaceholder: "例如：回答先给结论，再用表格列出明细",
      tools: "可用工具",
      followUpper: "跟随上一层",
      limits: "执行限制",
      followCap: "跟随上限 {{value}}",
      noCap: "不限",
      save: "保存",
      reset: "恢复默认",
      saved: "已保存",
      resetDone: "已恢复默认",
      serviceDefault: "服务默认",
      capValue: "上限 {{value}}",
      customTools: "自定义",
      sharedPrompt: "共享提示词",
      promptCurrent: "当前使用 v{{version}}",
      inUse: "使用中",
      useThisVersion: "切换到此版本",
      rolledBack: "已切换版本",
      publishPrompt: "发布为新版本",
      promptPublished: "已发布新版本",
      sharedReadOnly: "由平台管理员在系统管理中维护。",
      openSystemConfig: "去系统管理修改",
      mcpProfile: "MCP 服务",
      mcpDefault: "服务默认",
      mcpFull: "完整版",
      mcpCompact: "精简版",
      limitFields: {
        max_turns: { label: "步数上限", hint: "一轮最多执行多少步" },
        max_tool_calls: { label: "工具调用上限", hint: "一轮最多调用多少次工具" },
        timeout_s: { label: "超时（秒）", hint: "一轮最长执行时间" },
        max_output_tokens: { label: "单次输出上限", hint: "单次模型调用最多输出的 token 数" },
        keep_tool_results: {
          label: "保留完整结果数",
          hint: "本轮只给模型最近几次工具结果的全文，更早的用占位代替；之前问题的工具结果只保留占位",
        },
        data_result_chars: {
          label: "数据类结果上限（字）",
          hint: "run_sql、query_*、run_cypher 等单条结果超出部分截断，并提示缩小查询",
        },
        schema_result_chars: {
          label: "Schema 类结果上限（字）",
          hint: "get_kn_detail、search_schema 等单条结果的截断长度",
        },
        summarize_after_tokens: {
          label: "触发摘要的上下文长度",
          hint: "上下文超过这个 token 数时，把较早的历史压缩成摘要",
        },
      },
    },
    managedTurns: {
      loadSummary: "载入知识网络摘要",
    },
    placeholders: {
      askAgent: "向 Agent 提问，例如：{{suggestion}}",
    },
    composer: {
      stop: "停止",
      send: "发送",
      settings: "问答配置",
      clear: "清空",
      validationOnly: "智能问答仅供能力验证使用，不能用于生产。",
    },
    chatPane: {
      fallbackSuggestions: {
        relations: "这个知识网络里有哪些对象类和关系？",
        customers: "帮我查最近活跃的高价值客户",
        links: "对象类之间是怎么关联的？",
      },
      reasoning: {
        live: "思考中",
        done: "思考过程",
      },
      toolCall: {
        returnedError: "返回错误",
        running: "调用中…",
        failed: "失败",
        interrupted: "执行中断，未收到结果",
        clientBlocked: "客户端拦截",
        clientBlockedRequest: "模型入参；客户端拦截未发出 → {{name}}",
        clientBlockedReason: "拦截原因",
        request: "请求 · tools/call → {{name}}",
        error: "错误",
        response: "响应",
      },
      toolGroup: {
        summary: "已调用工具 {{count}} 次",
        summary_one: "已调用工具 {{count}} 次",
        summary_other: "已调用工具 {{count}} 次",
        failed: "{{count}} 个失败",
        failed_one: "{{count}} 个失败",
        failed_other: "{{count}} 个失败",
        someFailed: "其中 {{count}} 次失败",
        someFailed_one: "其中 {{count}} 次失败",
        someFailed_other: "其中 {{count}} 次失败",
      },
      error: {
        retry: "重试本轮",
        detail: "详情",
      },
      empty: {
        start: "开始验证",
        knIntro:
          "用自然语言向 Agent 提问，它会基于知识网络 {{knId}}{{networkName}} 调用检索工具并作答。{{summary}}",
        networkName: "（{{networkName}}）",
        summary:
          "已自动载入网络摘要（{{objectTypes}} 对象类 / {{relations}} 关系类），无需先浏览。",
      },
      message: {
        user: "我",
        agent: "Agent",
      },
    },
  },
} as const;
