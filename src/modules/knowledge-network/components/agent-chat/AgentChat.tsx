/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 立即体验 · Agent 对话 —— 容器：单会话 / 对比模式（分屏）。
 * 会话本体在 ChatPane（独立的消息/模型/提示词/调参/工具勾选）；本容器负责共享资源
 * （模型列表、知识网络摘要、tools/list 缓存）、对比开关与共享输入框（发送目标可选）。
 * 对比模式：左「仅基础数据」（默认只挂 list_resources/describe_resource/run_sql，不注入网络摘要）
 * vs 右「业务知识网络」（全部工具 + 注入摘要）——同一问题两侧同问，直观对比语义层价值。
 */

import { ClearOutlined, CopyOutlined, DownloadOutlined, FileTextOutlined, RightOutlined, SettingOutlined } from "@ant-design/icons";
import { App, Modal, Segmented, Switch } from "antd";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { normalizeSupportedLocale } from "@/framework/i18n/locale";
import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  BASE_DATA_TOOL_NAMES,
  DEFAULT_AGENT_CONFIG,
  runAgentChat,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  fetchKnDetail,
  listMcpTools,
  type ContextLoaderEnv,
  type KnDetail,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";
import {
  createBknLifecycle,
  lifecycleEnv,
  memoryConversationStore,
  withManagedTurn,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import { recommendationFingerprint } from "@/modules/knowledge-network/utils/agent-chat-cache";

import {
  ChatPane,
  MarkdownView,
  fmtDuration,
  fmtTokens,
  type ChatPaneHandle,
  type PaneKey,
  type PaneProfile,
  type PaneRound,
  type PaneSnapshot,
  type RoundOutcome,
} from "./ChatPane";
import styles from "./AgentChat.module.css";

/**
 * 建议问题在两侧（「仅基础数据」/「业务知识网络」）共用同一组，措辞保持业务向、不带本体术语：
 * 左侧只挂 SQL/表工具，问它「对象类怎么关联」是问一个它定义上就不知道的概念，对比没有说服力；
 * 业务问题才是左侧用 SQL 抓瞎、右侧靠语义层直接答的对比场。
 * 拉不到网络结构时的兜底（不含任何具体业务名词）。
 */
const FALLBACK_SUGGESTIONS = [
  "knowledgeNetwork.agentChat.fallbackSuggestions.overview",
  "knowledgeNetwork.agentChat.fallbackSuggestions.changes",
  "knowledgeNetwork.agentChat.fallbackSuggestions.priorityRecords",
];

/** 对比模式开关 + 发送目标（全局缓存，不分 kn）。 */
const COMPARE_LS_KEY = "bkn-studio:agentchat:compare";

type CompareTarget = "both" | "base" | "kn";

type CompareState = { on: boolean; target: CompareTarget };

function loadCompareState(): CompareState {
  let state: CompareState = { on: false, target: "both" };
  try {
    const raw = localStorage.getItem(COMPARE_LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CompareState>) : {};
    state = {
      on: parsed.on === true,
      target: parsed.target === "base" || parsed.target === "kn" ? parsed.target : "both",
    };
  } catch {
    /* 用默认 */
  }
  try {
    // 深链覆盖：?compare=on / ?compare=off（可分享演示链接，也便于自动化冒烟）。
    const qp = new URLSearchParams(window.location.search).get("compare");
    if (qp === "on" || qp === "1") state = { ...state, on: true };
    else if (qp === "off" || qp === "0") state = { ...state, on: false };
  } catch {
    /* SSR/异常时忽略 */
  }
  return state;
}

/**
 * 注入系统提示词的知识网络**摘要**（非完整结构）：名称 + 简介 + 规模 + 对象类名（截断）。
 * 完整本体/实例由 Agent 按需调 get_kn_detail / search_schema 等工具获取。
 */
function fallbackSuggestions(t: TFunction): string[] {
  return FALLBACK_SUGGESTIONS.map((key) => t(key));
}

function buildKnContext(detail: KnDetail, t: TFunction): string {
  const otNames = detail.object_types.map((o) => o.name || o.id);
  const shown = otNames.slice(0, 12);
  const lines = [t("knowledgeNetwork.agentChat.knContext.name", { name: detail.name ?? detail.id, id: detail.id })];
  if (detail.comment) {
    lines.push(
      t("knowledgeNetwork.agentChat.knContext.description", {
        description: detail.comment.replace(/\s+/g, " ").trim().slice(0, 200),
      }),
    );
  }
  lines.push(
    t("knowledgeNetwork.agentChat.knContext.scale", {
      objectTypes: detail.object_types.length,
      relations: detail.relation_types.length,
    }),
  );
  if (otNames.length) {
    lines.push(
      t(
        otNames.length > shown.length
          ? "knowledgeNetwork.agentChat.knContext.objectTypesMore"
          : "knowledgeNetwork.agentChat.knContext.objectTypes",
        { names: shown.join(", "), count: otNames.length },
      ),
    );
  }
  return lines.join("\n");
}

/**
 * 无默认模型（或生成失败）时的兜底：拿业务名词套模板，同样保持业务向、不出现本体术语。
 * 概念组实测多数网络为空，故第二条优先用关系名——关系名本身就是业务动词（如「用户下单」）。
 */
function templateSuggestions(detail: KnDetail, t: TFunction): string[] {
  const out: string[] = [];
  const [first, second] = detail.object_types;
  if (first) out.push(t("knowledgeNetwork.agentChat.templateSuggestions.firstObject", { name: first.name ?? first.id }));
  const groupName = detail.concept_groups.find((g) => g.name)?.name;
  const relName = detail.relation_types.find((r) => r.name)?.name;
  if (groupName) out.push(t("knowledgeNetwork.agentChat.templateSuggestions.group", { name: groupName }));
  else if (relName) out.push(t("knowledgeNetwork.agentChat.templateSuggestions.relation", { name: relName }));
  if (second) out.push(t("knowledgeNetwork.agentChat.templateSuggestions.secondObject", { name: second.name ?? second.id }));
  else if (first) out.push(t("knowledgeNetwork.agentChat.templateSuggestions.firstObjectRecent", { name: first.name ?? first.id }));
  return out.length >= 2 ? out : fallbackSuggestions(t);
}

/**
 * 建议问题的生成提示词。输入是 get_kn_detail 的原始 JSON（网络/对象类的 comment、关系名等业务描述都在里面）——
 * 推荐问题的质量直接取决于 BKN 里这些描述写得好不好，这就是业务侧控制推荐问题的抓手。
 */
function suggestPrompt(t: TFunction, locale: string): string {
  const languageInstruction =
    locale === "zh-CN"
      ? "Current UI locale: zh-CN. Output all recommended questions in Simplified Chinese."
      : "Current UI locale: en-US. Output all recommended questions in English. Keep untranslated business names only when no English business label is available.";
  return `${t("knowledgeNetwork.agentChat.suggestPrompt")}\n${languageInstruction}`;
}

/** 从模型输出里抠出 JSON 数组；任何不合预期都返回空数组，由调用方回退模板。 */
function parseSuggestions(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 60)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** 建议问题缓存：按 knId 存，指纹变了（网络结构/描述改过）就重生成。 */
const SUGS_LS_PREFIX = "bkn-studio:agentchat:sugs:";

function suggestionCacheKey(knId: string, locale: string): string {
  return `${SUGS_LS_PREFIX}${locale}:${knId}`;
}

function loadCachedSuggestions(knId: string, locale: string, fp: string): string[] | null {
  try {
    const raw = localStorage.getItem(suggestionCacheKey(knId, locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fp?: string; list?: unknown };
    if (parsed.fp !== fp || !Array.isArray(parsed.list)) return null;
    const list = parsed.list.filter((s): s is string => typeof s === "string");
    return list.length >= 2 ? list : null;
  } catch {
    return null;
  }
}

function saveCachedSuggestions(knId: string, locale: string, fp: string, list: string[]): void {
  try {
    localStorage.setItem(suggestionCacheKey(knId, locale), JSON.stringify({ fp, list }));
  } catch {
    /* 隐私模式/配额满：不缓存即可，不影响功能 */
  }
}

function buildProfiles(t: TFunction) {
  const soloProfile: PaneProfile = {
    paneKey: "solo",
    emptyTitle: t("knowledgeNetwork.agentChat.profiles.soloEmptyTitle"),
    defaultPrompt: t("knowledgeNetwork.agentChat.chatPane.defaultPrompt"),
    injectKnContext: true,
    defaultToolNames: null,
    evidenceHint: t("knowledgeNetwork.agentChat.chatPane.evidenceHint.kn"),
  };
  const baseProfile: PaneProfile = {
    paneKey: "base",
    title: t("knowledgeNetwork.agentChat.profiles.baseTitle"),
    emptyTitle: t("knowledgeNetwork.agentChat.profiles.baseEmptyTitle"),
    defaultPrompt: t("knowledgeNetwork.agentChat.chatPane.basePrompt"),
    injectKnContext: false,
    defaultToolNames: BASE_DATA_TOOL_NAMES,
    evidenceHint: t("knowledgeNetwork.agentChat.chatPane.evidenceHint.base"),
  };
  const knProfile: PaneProfile = {
    paneKey: "kn",
    title: t("knowledgeNetwork.agentChat.profiles.knTitle"),
    emptyTitle: t("knowledgeNetwork.agentChat.profiles.knEmptyTitle"),
    defaultPrompt: t("knowledgeNetwork.agentChat.chatPane.defaultPrompt"),
    injectKnContext: true,
    defaultToolNames: null,
    evidenceHint: t("knowledgeNetwork.agentChat.chatPane.evidenceHint.kn"),
  };
  return { soloProfile, baseProfile, knProfile };
}

/** 对比报告 AI 总结的评审提示词。 */
function judgePrompt(t: TFunction): string {
  return t("knowledgeNetwork.agentChat.judgePrompt");
}

/** 结果状态标签；empty/stopped/error 明确标注为负面。 */
function outcomeLabel(o: RoundOutcome, t: TFunction): string {
  switch (o) {
    case "answered":
      return t("knowledgeNetwork.agentChat.outcome.answered");
    case "stopped":
      return t("knowledgeNetwork.agentChat.outcome.stopped");
    case "error":
      return t("knowledgeNetwork.agentChat.outcome.error");
    case "empty":
    default:
      return t("knowledgeNetwork.agentChat.outcome.empty");
  }
}

/** 一轮的答案块：有效回答直接给正文；否则标注负面状态（有部分内容则附上）。 */
function answerBlock(r: PaneRound | undefined, t: TFunction): string {
  if (!r) return t("knowledgeNetwork.agentChat.answer.notParticipated");
  if (r.outcome === "answered") return r.answer ?? t("knowledgeNetwork.agentChat.answer.empty");
  const note = `**${outcomeLabel(r.outcome, t)}**`;
  return r.answer && r.answer.trim() ? `${note}\n\n${r.answer}` : note;
}

/** 某侧未有效完成（无答/停止/出错）的轮数——对比报告里的负面计数。 */
function negativeRounds(s: PaneSnapshot): number {
  return s.rounds.filter((r) => r.outcome !== "answered").length;
}

/** 导出 Markdown：一轮的工具调用摘要。 */
function mdCalls(r: PaneRound | undefined, t: TFunction): string {
  if (!r || r.toolCalls.length === 0) return t("knowledgeNetwork.agentChat.calls.zero");
  const ok = r.toolCalls.filter((t) => t.status === "done").length;
  const err = r.toolCalls.filter((t) => t.status === "error").length;
  const names = r.toolCalls
    .map((toolCall) =>
      toolCall.status === "error"
        ? t("knowledgeNetwork.agentChat.calls.errorName", { name: toolCall.name })
        : toolCall.name,
    )
    .join(", ");
  return t("knowledgeNetwork.agentChat.calls.summary", {
    count: r.toolCalls.length,
    ok,
    errorPart: err > 0 ? t("knowledgeNetwork.agentChat.calls.errorPart", { err }) : "",
    names,
  });
}

/** 把对比报告导出为 Markdown 文本（总览 + 逐轮问答指标 + 双方答案 + AI 总结）。 */
function reportToMarkdown(
  base: PaneSnapshot,
  kn: PaneSnapshot,
  summary: string,
  knLabel: string,
  generatedAt: string,
  t: TFunction,
): string {
  const L: string[] = [];
  L.push(`# ${t("knowledgeNetwork.agentChat.report.title", { knLabel })}`, "");
  L.push(`- ${t("knowledgeNetwork.agentChat.report.generatedAt", { generatedAt })}`);
  L.push(
    `- ${t("knowledgeNetwork.agentChat.report.modelLine", { baseModel: base.model || "—", knModel: kn.model || "—" })}`,
    "",
  );
  L.push(`## ${t("knowledgeNetwork.agentChat.report.overview")}`, "");
  L.push(
    `| ${t("knowledgeNetwork.agentChat.report.metricHeader")} | ${t("knowledgeNetwork.agentChat.report.baseHeader")} | ${t("knowledgeNetwork.agentChat.report.knHeader")} |`,
  );
  L.push("| --- | --- | --- |");
  L.push(`| ${t("knowledgeNetwork.agentChat.report.totalTokens")} | ${fmtTokens(base.stats.tokens)} | ${fmtTokens(kn.stats.tokens)} |`);
  L.push(`| ${t("knowledgeNetwork.agentChat.report.totalDuration")} | ${fmtDuration(base.stats.ms)} | ${fmtDuration(kn.stats.ms)} |`);
  L.push(`| ${t("knowledgeNetwork.agentChat.report.rounds")} | ${base.rounds.length} | ${kn.rounds.length} |`);
  const totalCalls = (s: PaneSnapshot) => s.rounds.reduce((n, r) => n + r.toolCalls.length, 0);
  L.push(
    `| ${t("knowledgeNetwork.agentChat.report.totalToolCalls")} | ${totalCalls(base)} | ${totalCalls(kn)} |`,
  );
  L.push(
    `| ${t("knowledgeNetwork.agentChat.report.invalidRounds")} | ${negativeRounds(base)} | ${negativeRounds(kn)} |`,
    "",
  );
  const roundCount = Math.max(base.rounds.length, kn.rounds.length);
  for (let i = 0; i < roundCount; i++) {
    const b = base.rounds[i];
    const k = kn.rounds[i];
    const sameQ = !b || !k || b.question === k.question;
    L.push(`## ${t("knowledgeNetwork.agentChat.report.roundTitle", { round: i + 1 })}`, "");
    L.push(
      `> ${
        sameQ
          ? (k?.question ?? b?.question ?? "—")
          : t("knowledgeNetwork.agentChat.report.questionBoth", {
              baseQuestion: b?.question ?? "—",
              knQuestion: k?.question ?? "—",
            })
      }`,
      "",
    );
    L.push(
      `| ${t("knowledgeNetwork.agentChat.report.metricHeader")} | ${t("knowledgeNetwork.agentChat.report.baseHeader")} | ${t("knowledgeNetwork.agentChat.report.knHeader")} |`,
    );
    L.push("| --- | --- | --- |");
    L.push(
      `| token | ${b?.tokens != null ? fmtTokens(b.tokens) : "—"} | ${k?.tokens != null ? fmtTokens(k.tokens) : "—"} |`,
    );
    L.push(
      `| ${t("knowledgeNetwork.agentChat.report.duration")} | ${b?.ms != null ? fmtDuration(b.ms) : "—"} | ${k?.ms != null ? fmtDuration(k.ms) : "—"} |`,
    );
    L.push(`| ${t("knowledgeNetwork.agentChat.report.toolCalls")} | ${mdCalls(b, t)} | ${mdCalls(k, t)} |`);
    L.push(
      `| ${t("knowledgeNetwork.agentChat.report.result")} | ${b ? outcomeLabel(b.outcome, t) : "—"} | ${k ? outcomeLabel(k.outcome, t) : "—"} |`,
      "",
    );
    L.push(`### ${t("knowledgeNetwork.agentChat.report.baseAnswerTitle")}`, "", answerBlock(b, t), "");
    L.push(`### ${t("knowledgeNetwork.agentChat.report.knAnswerTitle")}`, "", answerBlock(k, t), "");
  }
  if (summary.trim()) L.push(`## ${t("knowledgeNetwork.agentChat.report.aiSummary")}`, "", summary.trim(), "");
  return L.join("\n");
}

/** 报告里单侧全部轮次的评审语料（长回答截断，防提示词爆炸）。 */
function paneBrief(label: string, s: PaneSnapshot, t: TFunction): string {
  const parts = [
    `### ${t("knowledgeNetwork.agentChat.report.paneBriefTitle", {
      label,
      model: s.model || "—",
      tokens: fmtTokens(s.stats.tokens),
      duration: fmtDuration(s.stats.ms),
    })}`,
  ];
  s.rounds.forEach((r, i) => {
    const tools =
      r.toolCalls
        .map((toolCall) =>
          toolCall.status === "error"
            ? t("knowledgeNetwork.agentChat.calls.errorName", { name: toolCall.name })
            : toolCall.name,
        )
        .join(", ") || t("knowledgeNetwork.agentChat.report.none");
    const answer = r.answer
      ? r.answer.length > 1500
        ? t("knowledgeNetwork.agentChat.report.truncated", { answer: r.answer.slice(0, 1500) })
        : r.answer
      : t("knowledgeNetwork.agentChat.answer.empty");
    parts.push(
      t("knowledgeNetwork.agentChat.report.paneBriefRound", {
        round: i + 1,
        question: r.question,
        outcome: outcomeLabel(r.outcome, t),
        tokens: r.tokens ?? "—",
        duration: r.ms != null ? fmtDuration(r.ms) : "—",
        toolCount: r.toolCalls.length,
        tools,
        answer,
      }),
    );
  });
  return parts.join("\n\n");
}

export function AgentChat({
  env,
  networkName,
  tokenProvider,
  modelTokenProvider,
}: {
  env: ContextLoaderEnv;
  networkName?: string;
  /** 检索工具（agent-retrieval MCP）鉴权：OAuth 会话或 bak_ AppKey。 */
  tokenProvider: AgentTokenProvider;
  /** 大模型（mf-model-api）鉴权：网关不认 bak_，恒用 OAuth 会话；缺省回落 tokenProvider。 */
  modelTokenProvider?: AgentTokenProvider;
}) {
  const knId = env.knId;
  const { message } = App.useApp();
  const { t, i18n } = useTranslation();
  const activeLocale = normalizeSupportedLocale(i18n.resolvedLanguage ?? i18n.language) ?? "en-US";
  const profiles = useMemo(() => buildProfiles(t), [t]);
  const defaultSuggestions = useMemo(() => fallbackSuggestions(t), [t]);
  const llmTokenProvider = useMemo(
    () => modelTokenProvider ?? tokenProvider,
    [modelTokenProvider, tokenProvider],
  );

  const [input, setInput] = useState("");
  const [models, setModels] = useState<LlmModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  // 自动载入的知识网络本体结构（注入系统提示词；也用于定制建议问题）。
  const [knContext, setKnContext] = useState("");
  const [knSummary, setKnSummary] = useState<{ objectTypes: number; relations: number } | null>(null);
  // 当前网络绑定的 resource_id 集（object_type.data_source.id）；用于把 list_resources 默认限定到本网络的数据表。
  const [knResourceIds, setKnResourceIds] = useState<string[] | null>(null);
  // 建议问题：两侧共用一组。先用模板即时渲染，模型就绪后再换成生成结果（见下方 effect）。
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestions);
  // 已拉到的网络结构：既派生系统提示词摘要，也作为生成建议问题的业务描述来源。
  const [knDetail, setKnDetail] = useState<KnDetail | null>(null);

  const [compare, setCompare] = useState<CompareState>(loadCompareState);
  const setCompareState = useCallback((updater: (prev: CompareState) => CompareState) => {
    setCompare((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(COMPARE_LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // 每面板 busy 上报（禁发/停止逻辑用）。
  const [busyMap, setBusyMap] = useState<Record<PaneKey, boolean>>({ solo: false, base: false, kn: false });
  const setPaneBusy = useCallback((key: PaneKey, busy: boolean) => {
    setBusyMap((prev) => (prev[key] === busy ? prev : { ...prev, [key]: busy }));
  }, []);
  const onSoloBusy = useCallback((b: boolean) => setPaneBusy("solo", b), [setPaneBusy]);
  const onBaseBusy = useCallback((b: boolean) => setPaneBusy("base", b), [setPaneBusy]);
  const onKnBusy = useCallback((b: boolean) => setPaneBusy("kn", b), [setPaneBusy]);

  /** 平台侧预取用的一次性受管会话（不是任何一侧对话）。 */
  const summaryLifecycle = useMemo(
    () =>
      createBknLifecycle(lifecycleEnv(env.base, knId), tokenProvider, {
        conversationStore: memoryConversationStore(),
      }),
    [env.base, knId, tokenProvider],
  );

  const soloRef = useRef<ChatPaneHandle>(null);
  const baseRef = useRef<ChatPaneHandle>(null);
  const knRef = useRef<ChatPaneHandle>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestions((prev) => (prev === defaultSuggestions ? prev : defaultSuggestions));
  }, [defaultSuggestions]);

  // 拉模型列表（模型工厂）一次，两侧共享；默认模型在 ChatPane 内选。
  useEffect(() => {
    let cancelled = false;
    listLlmModels({ page: 1, size: 100 })
      .then((res) => {
        if (!cancelled) setModels(res.items);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 自动载入选定知识网络的本体结构 → 注入系统提示词 + 定制建议（免去先浏览业务知识网络）。
  useEffect(() => {
    let cancelled = false;
    setKnContext("");
    setKnSummary(null);
    setKnResourceIds(null);
    setKnDetail(null);
    setSuggestions(defaultSuggestions);
    // 摘要预取也是受管业务调用（get_kn_detail 走 /kn/*）。它不属于任何一侧对话，
    // 因此用一次性会话，不要占用面板的 conversation。
    withManagedTurn(summaryLifecycle, t("knowledgeNetwork.agentChat.managedTurns.loadSummary"), (turn) =>
      fetchKnDetail(env, tokenProvider, undefined, turn ?? undefined),
    )
      .then((detail) => {
        if (cancelled) return;
        setKnContext(buildKnContext(detail, t));
        setKnSummary({ objectTypes: detail.object_types.length, relations: detail.relation_types.length });
        setKnResourceIds(detail.object_types.map((o) => o.data_source?.id).filter((id): id is string => !!id));
        setKnDetail(detail);
        // 先给模板结果，空态立刻有东西可点，不等模型。
        setSuggestions(templateSuggestions(detail, t));
      })
      .catch(() => {
        /* 占位符 / 无权限网络拉不到结构时，回退默认建议，Agent 仍可用工具探索 */
      });
    return () => {
      cancelled = true;
    };
  }, [env, tokenProvider, summaryLifecycle, defaultSuggestions, t]);

  // 有默认模型就用 BKN 的业务描述生成建议问题，替换模板结果；无模型/失败/输出不合预期时留在模板。
  useEffect(() => {
    if (!knDetail || !modelsLoaded) return;
    const modelName = models.find((m) => m.default)?.modelName ?? models[0]?.modelName;
    if (!modelName) return;
    const fp = recommendationFingerprint(knDetail);
    const cached = loadCachedSuggestions(knId, activeLocale, fp);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    const controller = new AbortController();
    let text = "";
    runAgentChat({
      env,
      modelName,
      system: suggestPrompt(t, activeLocale),
      history: [{ role: "user", content: JSON.stringify(knDetail) }],
      tools: {},
      config: DEFAULT_AGENT_CONFIG,
      tokenProvider: llmTokenProvider,
      signal: controller.signal,
      onChunk: (chunk) => {
        if (chunk.type === "text") text += chunk.delta;
      },
    })
      .then(() => {
        if (controller.signal.aborted) return;
        const list = parseSuggestions(text);
        if (list.length < 2) return; // 输出不可用 → 保持模板
        setSuggestions(list);
        saveCachedSuggestions(knId, activeLocale, fp, list);
      })
      .catch(() => {
        /* 生成失败不打扰用户：空态继续用模板建议 */
      });
    return () => {
      controller.abort();
    };
  }, [knDetail, modelsLoaded, models, env, llmTokenProvider, knId, activeLocale, t]);

  // tools/list 缓存：按 knId 拉一次，多面板共享（send 懒取 promise；picker 用已解析的 toolDefs）。
  const [toolDefs, setToolDefs] = useState<McpToolDef[] | null>(null);
  const toolsCacheRef = useRef<{ knId: string; promise: Promise<McpToolDef[]> } | null>(null);
  const toolsRequestRef = useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const envRef = useRef(env);
  envRef.current = env;
  const getTools = useCallback((): Promise<McpToolDef[]> => {
    if (!toolsCacheRef.current || toolsCacheRef.current.knId !== knId) {
      const sequence = ++toolsRequestRef.current.sequence;
      toolsRequestRef.current.controller?.abort();
      const controller = new AbortController();
      toolsRequestRef.current.controller = controller;
      const requestKnId = knId;
      const promise = listMcpTools(envRef.current, tokenProvider, controller.signal)
        .then((list) => {
          if (sequence === toolsRequestRef.current.sequence && requestKnId === envRef.current.knId) {
            setToolDefs(list);
          }
          return list;
        })
        .catch((error: unknown) => {
          // 失败不缓存，下次重试。
          if (sequence === toolsRequestRef.current.sequence) {
            toolsCacheRef.current = null;
          }
          throw error;
        })
        .finally(() => {
          if (sequence === toolsRequestRef.current.sequence) {
            toolsRequestRef.current.controller = null;
          }
        });
      toolsCacheRef.current = { knId, promise };
    }
    return toolsCacheRef.current.promise;
  }, [knId, tokenProvider]);
  useEffect(() => {
    toolsRequestRef.current.sequence += 1;
    toolsRequestRef.current.controller?.abort();
    toolsRequestRef.current.controller = null;
    setToolDefs(null);
    toolsCacheRef.current = null;
  }, [knId]);
  useEffect(
    () => () => {
      toolsRequestRef.current.controller?.abort();
    },
    [],
  );
  // 对比模式下工具选择器需要 options → 打开时预拉一次。
  useEffect(() => {
    if (compare.on && !toolDefs) {
      getTools().catch(() => {
        /* picker 显示加载失败前的 loading 态；send 时会重试并把错误写进消息 */
      });
    }
  }, [compare.on, toolDefs, getTools]);

  const targets = useMemo<PaneKey[]>(() => {
    if (!compare.on) return ["solo"];
    return compare.target === "both" ? ["base", "kn"] : [compare.target];
  }, [compare]);

  const refOf = useCallback(
    (key: PaneKey) => (key === "solo" ? soloRef : key === "base" ? baseRef : knRef),
    [],
  );

  const anyTargetBusy = targets.some((k) => busyMap[k]);
  const anyBusy = busyMap.solo || busyMap.base || busyMap.kn;
  const noLlm = modelsLoaded && models.length === 0;

  const sendShared = useCallback(() => {
    const text = input.trim();
    if (!text || anyTargetBusy) return;
    targets.forEach((key) => refOf(key).current?.send(text));
    setInput("");
  }, [input, targets, anyTargetBusy, refOf]);

  /**
   * 空态点建议问题：和共享输入框走同一套发送目标。
   * （此前是 ChatPane 内直发，绕过 targets：对比模式下点谁只发谁、两侧还各是各的问题，
   * 导致对比报告永远拿不到同题两答。）
   */
  const sendQuestion = useCallback(
    (text: string) => {
      if (!text.trim() || anyTargetBusy) return;
      targets.forEach((key) => refOf(key).current?.send(text));
    },
    [targets, anyTargetBusy, refOf],
  );

  const stopAll = useCallback(() => {
    (Object.keys(busyMap) as PaneKey[]).forEach((key) => {
      if (busyMap[key]) refOf(key).current?.stop();
    });
  }, [busyMap, refOf]);

  // 对比报告：两侧快照 + 指标表 + AI 总结（用右侧模型评审，流式）。
  const [report, setReport] = useState<{ base: PaneSnapshot; kn: PaneSnapshot } | null>(null);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const summaryAbortRef = useRef<AbortController | null>(null);

  const openReport = useCallback(() => {
    const base = baseRef.current?.getSnapshot();
    const kn = knRef.current?.getSnapshot();
    if (base && kn) {
      setReport({ base, kn });
      setSummary("");
    }
  }, []);

  const closeReport = useCallback(() => {
    summaryAbortRef.current?.abort();
    setReport(null);
  }, []);

  const buildMarkdown = useCallback(() => {
    if (!report) return null;
    const stamp = new Date().toLocaleString(i18n.language, { hour12: false });
    return reportToMarkdown(report.base, report.kn, summary, networkName ? `${networkName} (${knId})` : knId, stamp, t);
  }, [report, summary, networkName, knId, t, i18n.language]);

  const copyReportMd = useCallback(() => {
    const md = buildMarkdown();
    if (!md) return;
    void navigator.clipboard
      ?.writeText(md)
      .then(() => message.success(t("knowledgeNetwork.agentChat.report.copySuccess")))
      .catch(() => message.error(t("knowledgeNetwork.agentChat.report.copyFailed")));
  }, [buildMarkdown, message, t]);

  const exportReportMd = useCallback(() => {
    const md = buildMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("knowledgeNetwork.agentChat.report.downloadName", {
      knId,
      stamp: new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-"),
    });
    a.click();
    URL.revokeObjectURL(url);
  }, [buildMarkdown, knId, t]);

  const generateSummary = useCallback(async () => {
    if (!report || summarizing) return;
    const modelName = report.kn.model || report.base.model;
    if (!modelName) return;
    const content = [
      paneBrief(`A · ${t("knowledgeNetwork.agentChat.profiles.baseTitle")}`, report.base, t),
      "",
      paneBrief(`B · ${t("knowledgeNetwork.agentChat.profiles.knTitle")}`, report.kn, t),
    ].join("\n");
    setSummarizing(true);
    setSummary("");
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    try {
      await runAgentChat({
        env,
        modelName,
        system: judgePrompt(t),
        history: [{ role: "user", content }],
        tools: {},
        config: DEFAULT_AGENT_CONFIG,
        tokenProvider: llmTokenProvider,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (chunk.type === "text") setSummary((s) => s + chunk.delta);
          else if (chunk.type === "error") setSummary((s) => s + (s ? "\n\n" : "") + chunk.error);
        },
      });
    } finally {
      summaryAbortRef.current = null;
      setSummarizing(false);
    }
  }, [env, llmTokenProvider, report, summarizing, t]);

  const placeholder = useMemo(() => {
    if (noLlm) return t("knowledgeNetwork.agentChat.placeholders.noLlm");
    if (!compare.on) {
      return t("knowledgeNetwork.agentChat.placeholders.askAgent", {
        suggestion: suggestions[0] ?? defaultSuggestions[0],
      });
    }
    if (compare.target === "both") return t("knowledgeNetwork.agentChat.placeholders.both");
    return compare.target === "base"
      ? t("knowledgeNetwork.agentChat.placeholders.base")
      : t("knowledgeNetwork.agentChat.placeholders.kn");
  }, [noLlm, compare, suggestions, defaultSuggestions, t]);

  const paneShared = {
    env,
    tokenProvider,
    modelTokenProvider: llmTokenProvider,
    networkName,
    models,
    modelsLoaded,
    knContext,
    knSummary,
    getTools,
    toolDefs,
    resourceScope: knResourceIds,
    pageScrollRef,
  };

  const composer = (
    <div className={styles.composer}>
      {compare.on ? (
        <div className={styles.targetBar}>
          <div className={styles.targetLeft}>
            <span className={styles.targetLabel}>{t("knowledgeNetwork.agentChat.composer.sendTo")}</span>
            <Segmented
              className={styles.targetSeg}
              value={compare.target}
              onChange={(value) => setCompareState((prev) => ({ ...prev, target: value as CompareTarget }))}
              options={[
                { label: t("knowledgeNetwork.agentChat.composer.both"), value: "both" },
                { label: t("knowledgeNetwork.agentChat.composer.base"), value: "base" },
                { label: t("knowledgeNetwork.agentChat.composer.kn"), value: "kn" },
              ]}
            />
          </div>
          {compare.target === "both" ? (
            <button
              type="button"
              className={styles.cmpReport}
              onClick={openReport}
              disabled={anyBusy}
              title={t("knowledgeNetwork.agentChat.composer.reportTitle")}
            >
              <FileTextOutlined /> {t("knowledgeNetwork.agentChat.composer.report")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={styles.cwrap}>
        <textarea
          className={styles.cInput}
          value={input}
          rows={1}
          disabled={noLlm}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 跳过中文输入法组字中的回车（确认候选词），避免误发送。
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              sendShared();
            }
          }}
        />
        {anyTargetBusy ? (
          <button type="button" className={styles.stopBtn} onClick={stopAll}>
            {t("knowledgeNetwork.agentChat.composer.stop")}
          </button>
        ) : (
          <button type="button" className={styles.sendBtn} onClick={sendShared} disabled={!input.trim() || noLlm}>
            {t("knowledgeNetwork.agentChat.composer.send")}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={pageScrollRef} className={styles.root}>
      <header className={styles.agentHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.modeToggle}>
            <Switch
              checked={compare.on}
              disabled={anyBusy}
              onChange={(checked) => setCompareState((prev) => ({ ...prev, on: checked }))}
            />
            <span>{t("knowledgeNetwork.agentChat.composer.compareMode")}</span>
          </div>
          {!compare.on ? <span className={styles.paneTitle}>{t("knowledgeNetwork.agentChat.profiles.knTitle")}</span> : null}
        </div>
        {!compare.on ? (
          <div className={styles.headerActions}>
            <button type="button" className={styles.barBtn} onClick={() => soloRef.current?.openSettings()}>
              <SettingOutlined /> {t("knowledgeNetwork.agentChat.composer.settings")} <RightOutlined />
            </button>
            <button type="button" className={styles.barBtn} onClick={() => soloRef.current?.clear()} disabled={anyBusy}>
              <ClearOutlined /> {t("knowledgeNetwork.agentChat.composer.clear")}
            </button>
          </div>
        ) : null}
      </header>

      <div className={compare.on ? styles.compareStage : styles.soloStage}>
        {compare.on ? (
          <div className={styles.comparePanel}>
            <div className={`${styles.panes} ${compare.target !== "both" ? styles.panesSingle : ""}`}>
              {compare.target === "both" || compare.target === "base" ? (
                <div className={styles.pane}>
                  <ChatPane
                    ref={baseRef}
                    {...paneShared}
                    profile={profiles.baseProfile}
                    suggestions={suggestions}
                    onPick={sendQuestion}
                    onBusyChange={onBaseBusy}
                  />
                </div>
              ) : null}
              {compare.target === "both" || compare.target === "kn" ? (
                <div className={styles.pane}>
                  <ChatPane
                    ref={knRef}
                    {...paneShared}
                    profile={profiles.knProfile}
                    suggestions={suggestions}
                    onPick={sendQuestion}
                    onBusyChange={onKnBusy}
                  />
                </div>
              ) : null}
            </div>
            {composer}
          </div>
        ) : (
          <div className={styles.soloPanel}>
            <ChatPane
              ref={soloRef}
              {...paneShared}
              profile={profiles.soloProfile}
              suggestions={suggestions}
              showToolbar={false}
              onPick={sendQuestion}
              onBusyChange={onSoloBusy}
            />
            {composer}
          </div>
        )}
      </div>

      <Modal
        open={report !== null}
        onCancel={closeReport}
        footer={null}
        width="min(1120px, 94vw)"
        title={t("knowledgeNetwork.agentChat.composer.report")}
      >
        {report ? (
          <div className={styles.rptRoot}>
            {report.base.rounds.length === 0 && report.kn.rounds.length === 0 ? (
              <p className={styles.rptHint}>{t("knowledgeNetwork.agentChat.report.emptyDialog")}</p>
            ) : (
              <>
                <div className={styles.rptActions}>
                  <button type="button" className={styles.rptActBtn} onClick={copyReportMd}>
                    <CopyOutlined /> {t("knowledgeNetwork.agentChat.report.copyMarkdown")}
                  </button>
                  <button type="button" className={styles.rptActBtn} onClick={exportReportMd}>
                    <DownloadOutlined /> {t("knowledgeNetwork.agentChat.report.exportMarkdown")}
                  </button>
                </div>
                {/* 会话总览（汇总对比） */}
                {(() => {
                  const agg = (s: PaneSnapshot) => {
                    const calls = s.rounds.flatMap((r) => r.toolCalls);
                    return {
                      rounds: s.rounds.length,
                      calls: calls.length,
                      ok: calls.filter((t) => t.status === "done").length,
                      err: calls.filter((t) => t.status === "error").length,
                      avgTokens: s.rounds.length > 0 ? Math.round(s.stats.tokens / s.rounds.length) : 0,
                      avgMs: s.rounds.length > 0 ? s.stats.ms / s.rounds.length : 0,
                      neg: s.rounds.filter((r) => r.outcome !== "answered").length,
                    };
                  };
                  const b = report.base;
                  const k = report.kn;
                  const ba = agg(b);
                  const ka = agg(k);
                  const both = ba.rounds > 0 && ka.rounds > 0;
                  const bBestTok = both && b.stats.tokens < k.stats.tokens;
                  const kBestTok = both && k.stats.tokens < b.stats.tokens;
                  const bBestMs = both && b.stats.ms < k.stats.ms;
                  const kBestMs = both && k.stats.ms < b.stats.ms;
                  const callsCell = (a: ReturnType<typeof agg>) => (
                    <>
                      {a.calls}
                      {a.calls > 0 ? (
                        <>
                          {" · "}
                          <span className={styles.rptOkTxt}>
                            {a.ok} {t("knowledgeNetwork.agentChat.report.success")}
                          </span>
                          {a.err > 0 ? (
                            <>
                              {" / "}
                              <span className={styles.rptErrTxt}>
                                {a.err} {t("knowledgeNetwork.agentChat.report.failed")}
                              </span>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  );
                  return (
                    <table className={styles.rptTable}>
                      <thead>
                        <tr>
                          <th>
                            {t("knowledgeNetwork.agentChat.report.overviewRounds", {
                              rounds: Math.max(ba.rounds, ka.rounds),
                            })}
                          </th>
                          <th>
                            <span className={styles.paneTitle}>{t("knowledgeNetwork.agentChat.profiles.baseTitle")}</span>
                          </th>
                          <th>
                            <span className={`${styles.paneTitle} ${styles.paneTitleHl}`}>
                              {t("knowledgeNetwork.agentChat.profiles.knTitle")}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.model")}</td>
                          <td>{b.model || "—"}</td>
                          <td>{k.model || "—"}</td>
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.totalTokens")}</td>
                          <td className={bBestTok ? styles.rptBest : ""}>{fmtTokens(b.stats.tokens)}</td>
                          <td className={kBestTok ? styles.rptBest : ""}>{fmtTokens(k.stats.tokens)}</td>
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.totalDuration")}</td>
                          <td className={bBestMs ? styles.rptBest : ""}>{fmtDuration(b.stats.ms)}</td>
                          <td className={kBestMs ? styles.rptBest : ""}>{fmtDuration(k.stats.ms)}</td>
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.averagePerRound")}</td>
                          <td>{ba.rounds > 0 ? `${fmtTokens(ba.avgTokens)} tokens · ${fmtDuration(ba.avgMs)}` : "—"}</td>
                          <td>{ka.rounds > 0 ? `${fmtTokens(ka.avgTokens)} tokens · ${fmtDuration(ka.avgMs)}` : "—"}</td>
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.totalToolCalls")}</td>
                          <td>{callsCell(ba)}</td>
                          <td>{callsCell(ka)}</td>
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.invalidRounds")}</td>
                          <td className={ba.neg > 0 ? styles.rptErrTxt : ""}>{ba.neg}</td>
                          <td className={ka.neg > 0 ? styles.rptErrTxt : ""}>{ka.neg}</td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}

                {/* 逐轮对比 */}
                {Array.from({ length: Math.max(report.base.rounds.length, report.kn.rounds.length) }, (_, i) => {
                  const b = report.base.rounds[i];
                  const k = report.kn.rounds[i];
                  const sameQ = !b || !k || b.question === k.question;
                  const bBestTokens = b?.tokens != null && k?.tokens != null && b.tokens < k.tokens;
                  const kBestTokens = b?.tokens != null && k?.tokens != null && k.tokens < b.tokens;
                  const bBestMs = b?.ms != null && k?.ms != null && b.ms < k.ms;
                  const kBestMs = b?.ms != null && k?.ms != null && k.ms < b.ms;
                  const toolCell = (r?: (typeof report.base.rounds)[number]) => {
                    if (!r) return "—";
                    const ok = r.toolCalls.filter((t) => t.status === "done").length;
                    const err = r.toolCalls.filter((t) => t.status === "error").length;
                    return (
                      <>
                        {r.toolCalls.length}
                        {r.toolCalls.length > 0 ? (
                          <>
                            {" · "}
                            <span className={styles.rptOkTxt}>
                              {ok} {t("knowledgeNetwork.agentChat.report.success")}
                            </span>
                            {err > 0 ? (
                              <>
                                {" / "}
                                <span className={styles.rptErrTxt}>
                                  {err} {t("knowledgeNetwork.agentChat.report.failed")}
                                </span>
                              </>
                            ) : null}
                            <div className={styles.rptToolTags}>
                              {r.toolCalls.map((t, j) => (
                                <span
                                  key={`${t.name}-${j}`}
                                  className={`${styles.rptTool} ${t.status === "error" ? styles.rptToolErr : ""}`}
                                >
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </>
                    );
                  };
                  return (
                    <div key={i} className={styles.rptRound}>
                      <div className={styles.rptQ}>
                        <span className={styles.rptRoundNo}>
                          {t("knowledgeNetwork.agentChat.report.roundTitle", { round: i + 1 })}
                        </span>
                        <span className={styles.rptQMark}>“</span>
                        <span>
                          {sameQ
                            ? (k?.question ?? b?.question ?? "—")
                            : t("knowledgeNetwork.agentChat.report.questionBoth", {
                                baseQuestion: b?.question ?? "—",
                                knQuestion: k?.question ?? "—",
                              })}
                        </span>
                      </div>
                      <table className={styles.rptTable}>
                        <tbody>
                          <tr>
                            <td>token</td>
                            <td className={bBestTokens ? styles.rptBest : ""}>
                              {b?.tokens != null ? fmtTokens(b.tokens) : "—"}
                            </td>
                            <td className={kBestTokens ? styles.rptBest : ""}>
                              {k?.tokens != null ? fmtTokens(k.tokens) : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td>{t("knowledgeNetwork.agentChat.report.duration")}</td>
                            <td className={bBestMs ? styles.rptBest : ""}>{b?.ms != null ? fmtDuration(b.ms) : "—"}</td>
                            <td className={kBestMs ? styles.rptBest : ""}>{k?.ms != null ? fmtDuration(k.ms) : "—"}</td>
                          </tr>
                          <tr>
                            <td>{t("knowledgeNetwork.agentChat.report.toolCalls")}</td>
                            <td>{toolCell(b)}</td>
                            <td>{toolCell(k)}</td>
                          </tr>
                          <tr>
                            <td>{t("knowledgeNetwork.agentChat.report.result")}</td>
                            <td className={b && b.outcome !== "answered" ? styles.rptErrTxt : ""}>
                              {b ? outcomeLabel(b.outcome, t) : "—"}
                            </td>
                            <td className={k && k.outcome !== "answered" ? styles.rptErrTxt : ""}>
                              {k ? outcomeLabel(k.outcome, t) : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div className={styles.rptAnsGrid}>
                        {(
                          [
                            { key: "base", title: t("knowledgeNetwork.agentChat.profiles.baseTitle"), hl: false, round: b },
                            { key: "kn", title: t("knowledgeNetwork.agentChat.profiles.knTitle"), hl: true, round: k },
                          ] as const
                        ).map(({ key, title, hl, round }) => {
                          const negative = !!round && round.outcome !== "answered";
                          return (
                            <details key={key} className={styles.rptAnsBox}>
                              <summary className={styles.rptAnsHead}>
                                <span className={`${styles.paneTitle} ${hl ? styles.paneTitleHl : ""}`}>{title}</span>
                                {negative ? (
                                  <span className={styles.rptErrTxt}>{outcomeLabel(round.outcome, t)}</span>
                                ) : (
                                  <span className={styles.rptAnsLbl}>
                                    {t("knowledgeNetwork.agentChat.report.answerToggle")}
                                  </span>
                                )}
                              </summary>
                              <div className={styles.rptAnsBody}>
                                {negative ? (
                                  <div className={styles.rptErrTxt}>{outcomeLabel(round.outcome, t)}</div>
                                ) : null}
                                {round?.answer ? (
                                  <MarkdownView text={round.answer} />
                                ) : negative ? null : (
                                  <span className={styles.rptHint}>{t("knowledgeNetwork.agentChat.answer.empty")}</span>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className={styles.rptSumHead}>
                  <span>{t("knowledgeNetwork.agentChat.report.aiSummary")}</span>
                  <button
                    type="button"
                    className={styles.rptGenBtn}
                    onClick={() => void generateSummary()}
                    disabled={summarizing}
                  >
                    {summarizing
                      ? t("knowledgeNetwork.agentChat.report.generating")
                      : summary
                        ? t("knowledgeNetwork.agentChat.report.regenerateSummary")
                        : t("knowledgeNetwork.agentChat.report.generateSummary")}
                  </button>
                </div>
                {summary ? (
                  <div className={styles.rptSummary}>
                    <MarkdownView text={summary} />
                  </div>
                ) : (
                  <p className={styles.rptHint}>
                    {summarizing
                      ? t("knowledgeNetwork.agentChat.report.thinking")
                      : t("knowledgeNetwork.agentChat.report.summaryHint")}
                  </p>
                )}
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
