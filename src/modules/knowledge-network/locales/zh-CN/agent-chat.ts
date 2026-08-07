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
      knTitle: "业务知识网络",
      knEmptyTitle: "基于知识网络回答",
    },
    judgePrompt:
      "你是对比评审员。同样的问题由两个 Agent 分别回答（可能有多轮）：A「仅基础数据」只能用 SQL/表工具直接查库；B「业务知识网络」可用全部知识网络检索工具（语义 Schema、实例、子图、逻辑属性等）。\n" +
      "请基于给出的各轮回答与指标，从这些维度对比：①结论正确性与完整度 ②依据是否充分可信 ③效率（工具调用次数、token、耗时）④哪一侧对业务用户更有用、为什么。\n" +
      "特别注意每轮的『结果状态』：若某侧某轮为『无有效回答 / 被用户停止 / 执行出错』，一律视为该侧该轮的负面结果（未完成任务），应判其明显劣于给出有效答案的一侧；某侧负面轮次越多，总评越应反映其不可靠。\n" +
      "输出中文 Markdown：先给一行总评（哪侧更好），再逐轮简要对比（每轮 2-3 句，并点明负面结果），最后分点归纳，简洁克制，不要复述全文。",
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
    report: {
      title: "Agent 对话对比报告 · {{knLabel}}",
      generatedAt: "生成时间：{{generatedAt}}",
      modelLine: "左「基础数据」模型：{{baseModel}}；右「业务知识网络」模型：{{knModel}}",
      overview: "会话总览",
      metricHeader: "指标",
      baseHeader: "基础数据",
      knHeader: "业务知识网络",
      totalTokens: "总 token",
      totalDuration: "总耗时",
      rounds: "轮数",
      totalToolCalls: "工具调用合计",
      invalidRounds: "无效轮次(无答/停止/出错)",
      roundTitle: "第 {{round}} 轮",
      questionBoth: "左：{{baseQuestion}} ／ 右：{{knQuestion}}",
      duration: "耗时",
      toolCalls: "工具调用",
      result: "结果",
      baseAnswerTitle: "基础数据 · 回答",
      knAnswerTitle: "业务知识网络 · 回答",
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
      emptyDialog: "两侧还没有对话。先用「两侧同问」发一个问题，再来看对比报告。",
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
      summaryHint: "用右侧模型对全部轮次做正确性 / 依据 / 效率评审。",
    },
    managedTurns: {
      loadSummary: "载入知识网络摘要",
    },
    placeholders: {
      noLlm: "请先在「模型工厂」接入大模型后再对话",
      askAgent: "向 Agent 提问，例如：{{suggestion}}",
      both: "同一个问题，同时问两侧，对比两种回答",
      base: "发送给「基础数据」",
      kn: "发送给「业务知识网络」",
    },
    composer: {
      sendTo: "发送到",
      both: "两侧同问",
      base: "基础数据",
      kn: "业务知识网络",
      reportTitle: "对比两侧最近一轮的回答与指标，可生成 AI 总结",
      report: "对比报告",
      stop: "停止",
      send: "发送",
      compareMode: "对比模式",
      settings: "问答配置",
      clear: "清空",
    },
  },
} as const;
