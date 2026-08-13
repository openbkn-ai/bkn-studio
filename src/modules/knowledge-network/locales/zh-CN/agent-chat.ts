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
      baseTitle: "基础数据",
      baseEmptyTitle: "直接查询数据",
      ptcTitle: "PTC · 代码模式",
      ptcEmptyTitle: "写一段脚本来回答",
      knTitle: "业务知识网络",
      knEmptyTitle: "基于知识网络回答",
    },
    // 参与方是可变的（两两或三方），各侧身份由 judgeSides 按实际对照组拼入。
    judgeSides: {
      base: "「仅基础数据」只能用 SQL/表工具直接查库",
      kn: "「业务知识网络」可用全部知识网络检索工具（语义 Schema、实例、子图、逻辑属性等）",
      ptc: "「PTC · 代码模式」只有 run_code 一个工具：写一段 Python 在沙箱执行，脚本内经 MCP 调同一批知识网络能力，中间结果留在沙箱，只有 print 的内容回到上下文",
    },
    judgeRosterLine: "{{letter}}：{{side}}",
    judgePrompt:
      "你是对比评审员。同样的问题由 {{count}} 个 Agent 分别回答（可能有多轮），各侧能力如下：\n" +
      "{{roster}}\n" +
      "请基于给出的各轮回答与指标，从这些维度对比：①结论正确性与完整度 ②依据是否充分可信 ③效率（工具调用次数、token、耗时）④哪一侧对业务用户更有用、为什么。\n" +
      "特别注意每轮的『结果状态』：若某侧某轮为『无有效回答 / 被用户停止 / 执行出错』，一律视为该侧该轮的负面结果（未完成任务），应判其明显劣于给出有效答案的一侧；某侧负面轮次越多，总评越应反映其不可靠。\n" +
      "输出中文 Markdown：先给一行总评，把各侧从优到劣排序并说明理由；再逐轮简要对比（每轮 2-3 句，并点明负面结果）；最后分点归纳，简洁克制，不要复述全文。",
    outcome: {
      answered: "已回答",
      stopped: "⏹ 被用户停止（负面）",
      error: "⚠️ 执行出错（负面）",
      empty: "⚠️ 无有效回答（负面）",
    },
    answer: {
      notParticipated: "（未参与本轮）",
      empty: "（无回答）",
    },
    calls: {
      zero: "0 次",
      errorName: "{{name}}(失败)",
      summary: "{{count}} 次（{{ok}} 成功{{errorPart}}）：{{names}}",
      errorPart: " / {{err}} 失败",
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
    report: {
      title: "Agent 对话对比报告 · {{knLabel}}",
      generatedAt: "生成时间：{{generatedAt}}",
      modelLine: "「{{label}}」模型：{{model}}",
      overview: "会话总览",
      metricHeader: "指标",
      totalTokens: "总 token",
      totalDuration: "总耗时",
      rounds: "轮数",
      totalToolCalls: "工具调用合计",
      invalidRounds: "无效轮次(无答/停止/出错)",
      roundTitle: "第 {{round}} 轮",
      questionPerSide: "{{label}}：{{question}}",
      duration: "耗时",
      toolCalls: "工具调用",
      result: "结果",
      answerTitle: "{{label}} · 回答",
      aiSummary: "AI 总结",
      paneBriefTitle: "{{label}}（模型 {{model}}；会话累计 {{tokens}} tokens · {{duration}}）",
      paneBriefRound:
        "【第 {{round}} 轮】问题：{{question}}\n结果状态：{{outcome}}\n指标：token {{tokens}}，耗时 {{duration}}，工具 {{toolCount}} 次（{{tools}}）\n回答：{{answer}}",
      truncated: "{{answer}}…[已截断]",
      none: "无",
      copyMarkdown: "复制 Markdown",
      exportMarkdown: "导出 .md",
      copySuccess: "报告 Markdown 已复制",
      copyFailed: "复制失败",
      downloadName: "对比报告-{{knId}}-{{stamp}}.md",
      emptyDialog: "各侧还没有对话。先用「全部同问」发一个问题，再来看对比报告。",
      overviewRounds: "会话总览（{{rounds}} 轮）",
      model: "模型",
      averagePerRound: "平均每轮",
      success: "成功",
      failed: "失败",
      answerToggle: "回答（点击展开/收起）",
      generateSummary: "生成总结",
      regenerateSummary: "重新生成",
      generating: "生成中…",
      thinking: "评审模型思考中…",
      summaryHint: "用能力最强那侧的模型对全部轮次做正确性 / 依据 / 效率评审。",
    },
    managedTurns: {
      loadSummary: "载入知识网络摘要",
    },
    placeholders: {
      noLlm: "请先在「模型工厂」接入大模型后再对话",
      askAgent: "向 Agent 提问，例如：{{suggestion}}",
      all: "同一个问题，同时问 {{count}} 侧，对比各自的回答",
      side: "发送给「{{label}}」",
    },
    composer: {
      sendTo: "发送到",
      all: "全部同问",
      sides: "参与对比",
      reportTitle: "对比各侧最近一轮的回答与指标，可生成 AI 总结",
      report: "对比报告",
      stop: "停止",
      send: "发送",
      compareMode: "对比模式",
      ptcMode: "PTC 模式",
      settings: "问答配置",
      clear: "清空",
    },
    chatPane: {
      defaultPrompt:
        "你是 BKN 业务知识网络的检索助手。基于当前知识网络上的对象类、关系类与逻辑属性回答用户问题。\n" +
        "需要数据时调用提供的检索工具（search_schema / query_object_instance / query_instance_subgraph / run_sql 等），不要编造；" +
        "kn_id 已锁定为当前网络，无需也不要修改。\n" +
        "查询要高效：聚合/排序/计数尽量交给 SQL（run_sql），用 LIMIT 和精确过滤、只取需要的字段，避免拉全表或返回超大结果；已获得的信息不要重复查询，少而准地调用工具。",
      ptcPrompt:
        "你是 BKN 业务知识网络的检索助手。你只有一个工具 run_code：写一段 Python 交给沙箱执行，" +
        "BKN 的各项能力已作为函数在脚本作用域内，可直接调用。kn_id 已锁定为当前网络。\n" +
        "只有 print 的内容会返回给你，中间结果不进上下文——过滤、聚合、关联都在脚本里做完，只打印结论。\n" +
        "\n" +
        "**一段脚本解决整个问题。** 每发起一次 run_code 就是一次往返；如果你先跑一次看结构、" +
        "再跑一次取数、再跑一次聚合，那和逐个调用工具没有区别，代码模式的意义就没了。" +
        "正确做法是把探查与求解写进同一段代码，用变量串起来：get_kn_detail / get_object_types 拿到的" +
        "字段直接喂给后面的查询，查询结果直接进聚合，最后 print 答案。\n" +
        "沙箱是完整的 Python 3.11，可用 pandas、numpy、scipy、requests、httpx、sqlite3 以及全部标准库。" +
        "分组、连接、统计交给 pandas 或 collections，不要为此多跑一轮。\n" +
        "不确定的地方用代码兜住而不是回到对话：字段名在拿到的 schema 里按名字匹配，取值一律 .get()，" +
        "可能失败的分支用 try/except 包住并 print 出关键中间信息，让一次执行既拿到答案、" +
        "又带回排查所需的线索。\n" +
        "只有脚本报错或信息确实不足以继续时，才发起第二次 run_code；重试前先读服务端报文，" +
        "它会指出真实字段名或调用约定。",
      basePrompt:
        "你是数据查询助手。你只能使用三个工具直接查询底层数据表回答用户问题：\n" +
        "list_resources（列出可访问的数据表）、describe_resource（查看表的列结构）、run_sql（执行 SQL）。\n" +
        "流程：先用 list_resources 找到相关表，再用 describe_resource 确认列，再写 SQL 查询。\n" +
        "SQL 中的表名必须用模板占位 {{.<resource_id>}} 引用（resource_id 取自 list_resources 的 entries[].resource_id），不能写裸表名；跨 catalog 不能 join。\n" +
        "查询要高效：聚合/排序/计数交给 SQL，用 LIMIT 和精确过滤、只取需要的字段，避免拉全表。",
      evidenceHint: {
        kn: "调了哪个工具、什么过滤条件或 SQL 要点",
        base: "用了哪些表、什么 SQL 要点",
      },
      fallbackSuggestions: {
        relations: "这个知识网络里有哪些对象类和关系？",
        customers: "帮我查最近活跃的高价值客户",
        links: "对象类之间是怎么关联的？",
      },
      configFields: {
        maxSteps: { label: "工具步数上限", hint: "一轮最多调多少步工具（防跑飞兜底）" },
        keepToolResults: { label: "步间保留结果数", hint: "每步只保留最近 N 个工具结果全文（0=不驱逐）" },
        dataToolCap: { label: "数据类结果上限(字)", hint: "run_sql / query_* 结果字符上限（0=不截断）" },
        schemaToolCap: { label: "Schema类结果上限(字)", hint: "get_kn_detail / search_schema 等（0=不截断）" },
        maxHistoryMessages: { label: "多轮保留条数", hint: "跨轮历史只保留最近 N 条消息" },
        maxTurnChars: { label: "单轮文本上限(字)", hint: "每条历史消息文本封顶" },
        maxOutputTokens: { label: "最大输出token", hint: "单步最大输出(含思考)；推理模型(deepseek)调大，0=模型默认" },
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
        contextSection: "## 当前知识网络摘要（已自动载入；完整结构与实例请按需调用工具获取）\n{{context}}",
        historyTruncated: "{{content}}\n…[历史过长已截断]",
      },
      model: {
        defaultSuffix: "{{modelName}} · 默认",
      },
      settings: {
        promptPlaceholder: "系统提示词，保存后会随对话一起发送",
        toolScopeTitle: "工具范围",
        toolScopeDescription: "限定本侧 Agent 可调用的工具。未选中的工具不会发送给模型。",
        resetDefault: "恢复默认",
        availableTools: "可用工具",
        selectTool: "选择工具",
        loadingTools: "正在加载工具",
        allTools: "全部 · {{count}}",
        selectedTools: "已选 {{count}}{{total}}",
        loadedSummary: "已载入网络摘要 · {{objectTypes}} 对象类 / {{relations}} 关系类",
        configTitle: "问答配置",
        clearTitle: "清空对话",
        clear: "清空",
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
        noLlmDescription: "Agent 对话需要大模型来驱动。请先到「模型工厂」接入一个大模型并设为默认，再回来对话。",
        goModelFactory: "去模型工厂接入大模型",
        start: "开始验证",
        baseIntro: "用自然语言提问，Agent 只能用基础数据工具（list_resources / describe_resource / run_sql）直接查表作答，不借助知识网络语义。",
        knIntro: "用自然语言向 Agent 提问，它会基于知识网络 {{knId}}{{networkName}} 调用检索工具并作答。{{summary}}",
        networkName: "（{{networkName}}）",
        summary: "已自动载入网络摘要（{{objectTypes}} 对象类 / {{relations}} 关系类），无需先浏览。",
      },
      message: {
        user: "我",
        agent: "Agent",
      },
    },
  },
} as const;
