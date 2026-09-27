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
    knContext: {
      name: "名称：{{name}}（{{id}}）",
      description: "简介：{{description}}",
      scale: "规模：{{objectTypes}} 个对象类、{{relations}} 个关系类",
      objectTypes: "对象类：{{names}}",
      objectTypesMore: "对象类：{{names}} 等 {{count}} 个",
      objectTypesMore_one: "对象类：{{names}} 等 {{count}} 个",
      objectTypesMore_other: "对象类：{{names}} 等 {{count}} 个",
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
      knTitle: "业务知识网络",
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
    managedTurns: {
      loadSummary: "载入知识网络摘要",
    },
    placeholders: {
      noLlm: "请先在「模型工厂」接入大模型后再对话",
      askAgent: "向 Agent 提问，例如：{{suggestion}}",
    },
    composer: {
      stop: "停止",
      send: "发送",
      settings: "问答配置",
      clear: "清空",
    },
    chatPane: {
      defaultPrompt:
        "你是 BKN 业务知识网络的检索助手。基于当前知识网络上的对象类、关系类与逻辑属性回答用户问题。\n" +
        "需要数据时用工具查，不要编造。先弄清结构再取数：不清楚有哪些对象类、字段叫什么，先用 search_schema 探一眼，" +
        "再按返回里的真实字段名过滤——按语义猜字段名往往得到空结果，而空结果不报错。\n" +
        "kn_id 已锁定为当前网络，无需也不要修改。\n" +
        "检索工具是主路。它们答不了的那部分，用三个补充手段：run_sql 做聚合/排序/计数，让数据库算完只回结果；" +
        "run_code 写一段 Python，脚本里可直接调用上面这些工具，适合串联多个工具、按中间结果分支、或中间数据量大而你只需要结论；" +
        "run_shell 执行 shell 命令，用来看一眼沙箱里的文件。三者共用一个按会话隔离的工作区，落盘的文件在同一对话的多次执行之间保留，下一段脚本可以直接接着用。\n" +
        "查询要高效：用 LIMIT 和精确过滤、只取需要的字段，避免拉全表或返回超大结果；已获得的信息不要重复查询，少而准地调用工具。",
      evidenceHint: {
        kn: "调了哪个工具、什么过滤条件或 SQL 要点",
      },
      fallbackSuggestions: {
        relations: "这个知识网络里有哪些对象类和关系？",
        customers: "帮我查最近活跃的高价值客户",
        links: "对象类之间是怎么关联的？",
      },
      configFields: {
        maxSteps: { label: "工具步数上限", hint: "一轮最多调多少步工具（防跑飞兜底）" },
        keepToolResults: {
          label: "步间保留结果数",
          hint: "每步只保留最近 N 个工具结果全文（0=不驱逐）",
        },
        dataToolCap: {
          label: "数据类结果上限(字)",
          hint: "run_sql / query_* 结果字符上限（0=不截断）",
        },
        schemaToolCap: {
          label: "Schema类结果上限(字)",
          hint: "get_kn_detail / search_schema 等（0=不截断）",
        },
        maxHistoryMessages: { label: "多轮保留条数", hint: "跨轮历史只保留最近 N 条消息" },
        maxTurnChars: { label: "单轮文本上限(字)", hint: "每条历史消息文本封顶" },
        maxOutputTokens: {
          label: "最大输出token",
          hint: "单步最大输出(含思考)；推理模型(deepseek)调大，0=模型默认",
        },
      },
      reasoning: {
        live: "思考中",
        done: "思考过程",
      },
      toolCall: {
        running: "调用中…",
        failed: "失败",
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
      },
      error: {
        retry: "重试本轮",
        detail: "详情",
      },
      messages: {
        settingsSaved: "设置已保存",
        promptReset: "系统提示词已恢复默认",
        configReset: "参数已恢复默认",
        noModel: "当前没有可用的大模型，请先在「模型工厂」配置默认模型",
      },
      system: {
        contextSection:
          "## 当前知识网络摘要（已自动载入；完整结构与实例请按需调用工具获取）\n{{context}}",
        historyTruncated: "{{content}}\n…[历史过长已截断]",
      },
      model: {
        defaultSuffix: "{{modelName}} · 默认",
      },
      settings: {
        promptPlaceholder: "系统提示词，保存后会随对话一起发送",
        resetDefault: "恢复默认",
        configTitle: "问答配置",
        cancel: "取消",
        confirm: "确定",
        modelConfigTitle: "模型配置",
        modelConfigDescription: "选择本次问答使用的模型。",
        modelLabel: "模型",
        selectModel: "选择模型",
        promptTitle: "系统提示词",
        promptDescription: "控制 Agent 的身份、工具使用策略和回答风格。",
        paramsTitle: "参数",
        paramsDescription: "限制工具步数、历史保留和输出长度，避免问答跑偏或结果过大。",
      },
      empty: {
        noLlmTitle: "还没有可用的大模型",
        noLlmDescription:
          "Agent 对话需要大模型来驱动。请先到「模型工厂」接入一个大模型并设为默认，再回来对话。",
        goModelFactory: "去模型工厂接入大模型",
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
