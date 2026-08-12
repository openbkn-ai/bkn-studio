/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Try-now Agent chat container for single-conversation and split comparison modes. ChatPane owns
 * messages, model, prompt, tuning, and tool selection; this container owns shared resources such
 * as the model list, knowledge-network summary, tools/list cache, comparison state, and shared input.
 * Comparison asks the same question of base data on the left and the business knowledge network on
 * the right to demonstrate the value of the semantic layer.
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
 * Both sides share recommendations phrased as business questions without ontology terms. The base
 * side has only SQL/table tools, so questions about object-type relationships ask concepts it does
 * not define and make an unconvincing comparison. Business questions let SQL struggle on the left
 * while the semantic layer answers directly on the right. These are the fallback when network structure is unavailable.
 */
const FALLBACK_SUGGESTIONS = [
  "knowledgeNetwork.agentChat.fallbackSuggestions.overview",
  "knowledgeNetwork.agentChat.fallbackSuggestions.changes",
  "knowledgeNetwork.agentChat.fallbackSuggestions.priorityRecords",
];

/** Comparison-mode toggle and send target, cached globally rather than per knowledge network. */
const COMPARE_LS_KEY = "bkn-studio:agentchat:compare";
const PTC_LS_KEY = "bkn-studio:agentchat:ptc";

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
    /* Use defaults. */
  }
  try {
    // Deep-link override through ?compare=on / ?compare=off for shareable demos and automated smoke tests.
    const qp = new URLSearchParams(window.location.search).get("compare");
    if (qp === "on" || qp === "1") state = { ...state, on: true };
    else if (qp === "off" || qp === "0") state = { ...state, on: false };
  } catch {
    /* Ignore SSR and other errors. */
  }
  return state;
}

/**
 * Summary of the knowledge network injected into the system prompt, not its full structure: name,
 * description, scale, and truncated object-type names. The Agent retrieves full ontology and instances
 * on demand through get_kn_detail, search_schema, and related tools.
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
 * Fallback when no default model is available or generation fails: apply templates to business names
 * without ontology terminology. Most networks have empty concept groups, so prefer relation names
 * for the second question because relations are business verbs.
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
 * Generation prompt for recommended questions. Input is raw get_kn_detail JSON containing network
 * and object-type comments, relation names, and other business descriptions. Recommendation quality
 * depends directly on those descriptions, giving business teams control over it.
 */
function suggestPrompt(t: TFunction, locale: string): string {
  const languageInstruction =
    locale === "zh-CN"
      ? "Current UI locale: zh-CN. Output all recommended questions in Simplified Chinese."
      : "Current UI locale: en-US. Output all recommended questions in English. Keep untranslated business names only when no English business label is available.";
  return `${t("knowledgeNetwork.agentChat.suggestPrompt")}\n${languageInstruction}`;
}

/** Extracts a JSON array from model output; unexpected input returns an empty array and callers fall back to templates. */
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

/** Recommendation cache by knId. Regenerate when its fingerprint changes because structure or descriptions changed. */
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
    /* Private mode or exhausted quota: skip caching without affecting functionality. */
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
  // PTC 模式：只暴露 run_code，BKN 能力下沉为沙箱内的函数。提示词随之改写——
  // 模型要知道自己在写脚本，而不是在挑工具。
  const ptcProfile: PaneProfile = {
    ...soloProfile,
    toolMode: "ptc",
    defaultPrompt: t("knowledgeNetwork.agentChat.chatPane.ptcPrompt"),
  };
  // 对比模式下的 PTC 侧：沿用 knProfile 的身份与 KN 上下文注入，只换工具面形态。
  // 左右接同一个知识网络，差别仅在「逐个工具」与「写代码」，才是有意义的对照。
  const ptcComparePane: PaneProfile = {
    ...knProfile,
    title: t("knowledgeNetwork.agentChat.profiles.ptcTitle"),
    emptyTitle: t("knowledgeNetwork.agentChat.profiles.ptcEmptyTitle"),
    toolMode: "ptc",
    defaultPrompt: t("knowledgeNetwork.agentChat.chatPane.ptcPrompt"),
  };
  return { soloProfile, baseProfile, knProfile, ptcProfile, ptcComparePane };
}

/** Evaluation prompt for the AI summary in a comparison report. */
function judgePrompt(t: TFunction): string {
  return t("knowledgeNetwork.agentChat.judgePrompt");
}

/** Outcome label; empty, stopped, and error are explicitly negative. */
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

/** Answer block for one round: return the answer for success, otherwise a negative status with any partial content. */
function answerBlock(r: PaneRound | undefined, t: TFunction): string {
  if (!r) return t("knowledgeNetwork.agentChat.answer.notParticipated");
  if (r.outcome === "answered") return r.answer ?? t("knowledgeNetwork.agentChat.answer.empty");
  const note = `**${outcomeLabel(r.outcome, t)}**`;
  return r.answer && r.answer.trim() ? `${note}\n\n${r.answer}` : note;
}

/** Number of rounds on one side that did not complete successfully, used as the negative count in reports. */
function negativeRounds(s: PaneSnapshot): number {
  return s.rounds.filter((r) => r.outcome !== "answered").length;
}

/** Markdown export summary of one round's tool calls. */
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

/** Exports a comparison report as Markdown with overview, per-round metrics, both answers, and AI summary. */
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

/** Evaluation corpus for all rounds on one side of a report; truncate long answers to prevent prompt explosion. */
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
  /** Authentication for retrieval tools (agent-retrieval MCP): OAuth session or bak_ AppKey. */
  tokenProvider: AgentTokenProvider;
  /** Authentication for LLMs (mf-model-api): the gateway does not accept bak_, so always use OAuth and fall back to tokenProvider. */
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
  // Automatically loaded knowledge-network ontology used for system-prompt injection and tailored suggestions.
  const [knContext, setKnContext] = useState("");
  const [knSummary, setKnSummary] = useState<{ objectTypes: number; relations: number } | null>(null);
  // resource_id set bound to the current network (object_type.data_source.id), used to limit list_resources to this network's tables by default.
  const [knResourceIds, setKnResourceIds] = useState<string[] | null>(null);
  // Both sides share suggestions. Render templates immediately and replace them with generated results when the model is ready.
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestions);
  // Loaded network structure both derives the system-prompt summary and supplies business descriptions for suggestions.
  const [knDetail, setKnDetail] = useState<KnDetail | null>(null);

  const [compare, setCompare] = useState<CompareState>(loadCompareState);
  const [ptcOn, setPtcOn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(PTC_LS_KEY) === "on";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(PTC_LS_KEY, ptcOn ? "on" : "off");
    } catch {
      // 存储不可用不影响本次会话，忽略。
    }
  }, [ptcOn]);
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

  // Busy state reported per panel for send-disable and stop behavior.
  const [busyMap, setBusyMap] = useState<Record<PaneKey, boolean>>({ solo: false, base: false, kn: false });
  const setPaneBusy = useCallback((key: PaneKey, busy: boolean) => {
    setBusyMap((prev) => (prev[key] === busy ? prev : { ...prev, [key]: busy }));
  }, []);
  const onSoloBusy = useCallback((b: boolean) => setPaneBusy("solo", b), [setPaneBusy]);
  const onBaseBusy = useCallback((b: boolean) => setPaneBusy("base", b), [setPaneBusy]);
  const onKnBusy = useCallback((b: boolean) => setPaneBusy("kn", b), [setPaneBusy]);

  /** One-time managed session for platform prefetching, not either conversation. */
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

  // Load the model-factory list once for both sides; ChatPane selects the default model.
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

  // Load the selected network ontology automatically for system-prompt injection and tailored suggestions, without requiring prior browsing.
  useEffect(() => {
    let cancelled = false;
    setKnContext("");
    setKnSummary(null);
    setKnResourceIds(null);
    setKnDetail(null);
    setSuggestions(defaultSuggestions);
    // Summary prefetch is also a managed business call because get_kn_detail uses /kn/*. It belongs
    // to neither conversation, so use a one-time session rather than a panel conversation.
    withManagedTurn(summaryLifecycle, t("knowledgeNetwork.agentChat.managedTurns.loadSummary"), (turn) =>
      fetchKnDetail(env, tokenProvider, undefined, turn ?? undefined),
    )
      .then((detail) => {
        if (cancelled) return;
        setKnContext(buildKnContext(detail, t));
        setKnSummary({ objectTypes: detail.object_types.length, relations: detail.relation_types.length });
        setKnResourceIds(detail.object_types.map((o) => o.data_source?.id).filter((id): id is string => !!id));
        setKnDetail(detail);
        // Show template results first so the empty state is immediately actionable without waiting for a model.
        setSuggestions(templateSuggestions(detail, t));
      })
      .catch(() => {
        /* Fall back to default suggestions when a placeholder or unauthorized network cannot load structure; the Agent can still explore tools. */
      });
    return () => {
      cancelled = true;
    };
  }, [env, tokenProvider, summaryLifecycle, defaultSuggestions, t]);

  // With a default model, generate suggestions from BKN business descriptions and replace templates; retain templates with no model, failure, or unexpected output.
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
        /* Do not interrupt users on generation failure; keep template suggestions in the empty state. */
      });
    return () => {
      controller.abort();
    };
  }, [knDetail, modelsLoaded, models, env, llmTokenProvider, knId, activeLocale, t]);

  // tools/list cache loads once per knId and is shared across panels; send lazily awaits its promise while picker uses resolved toolDefs.
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
          // Do not cache failures so the next attempt retries.
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
  // Comparison-mode tool picker needs options, so prefetch once when opened.
  useEffect(() => {
    if (compare.on && !toolDefs) {
      getTools().catch(() => {
        /* Keep the picker loading state on failure; send retries and writes the error into the message. */
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
   * Suggested questions clicked in the empty state use the same send targets as shared input. The
   * previous direct ChatPane path bypassed targets, sending to only one side in comparison mode and
   * preventing reports from ever receiving two answers to the same question.
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

  // Comparison report: both snapshots, metric table, and streaming AI summary evaluated by the right-side model.
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
            // Ignore Enter used to confirm a candidate during Chinese IME composition to avoid accidental sends.
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
          <div className={styles.modeToggle}>
            <Switch checked={ptcOn} disabled={anyBusy} onChange={setPtcOn} />
            <span>{t("knowledgeNetwork.agentChat.composer.ptcMode")}</span>
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
                    key={ptcOn ? "kn-ptc" : "kn"}
                    profile={ptcOn ? profiles.ptcComparePane : profiles.knProfile}
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
              key={ptcOn ? "solo-ptc" : "solo"}
              ref={soloRef}
              {...paneShared}
              profile={ptcOn ? profiles.ptcProfile : profiles.soloProfile}
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
