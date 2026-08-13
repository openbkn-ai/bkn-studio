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
import { App, Checkbox, Modal, Segmented, Switch } from "antd";
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
import {
  COMPARE_PANE_IDS,
  MIN_SIDES,
  normalizeCompareState,
  toggleSide,
  visibleSides,
  type ComparePaneId,
  type CompareState,
  type CompareTarget,
} from "./compare-state";
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

function loadCompareState(): CompareState {
  let state: CompareState = normalizeCompareState(undefined);
  try {
    const raw = localStorage.getItem(COMPARE_LS_KEY);
    // 旧结构的 PTC 侧由独立开关表达，迁移时一并读入。
    const legacyPtcOn = localStorage.getItem(PTC_LS_KEY) === "on";
    state = normalizeCompareState(raw ? JSON.parse(raw) : undefined, { ptcOn: legacyPtcOn });
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
  const mcpPrompt = t("knowledgeNetwork.agentChat.chatPane.defaultPrompt");
  const ptcPrompt = t("knowledgeNetwork.agentChat.chatPane.ptcPrompt");
  const soloProfile: PaneProfile = {
    paneKey: "solo",
    emptyTitle: t("knowledgeNetwork.agentChat.profiles.soloEmptyTitle"),
    defaultPrompt: mcpPrompt,
    // 隔离前 PTC 单栏也写在这个键上，读到它的默认提示词就是那批脏数据。
    foreignPrompts: [ptcPrompt],
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
    defaultPrompt: mcpPrompt,
    // 隔离前 PTC 对比侧就跑在 kn 栏上，提示词与参数写进了 cmp-kn。
    foreignPrompts: [ptcPrompt],
    injectKnContext: true,
    defaultToolNames: null,
    evidenceHint: t("knowledgeNetwork.agentChat.chatPane.evidenceHint.kn"),
  };
  // PTC 模式：只暴露 run_code，BKN 能力下沉为沙箱内的函数。提示词随之改写——
  // 模型要知道自己在写脚本，而不是在挑工具。
  const ptcProfile: PaneProfile = {
    ...soloProfile,
    toolMode: "ptc",
    defaultPrompt: ptcPrompt,
    foreignPrompts: [mcpPrompt],
  };
  // 对比模式下的 PTC 侧：沿用 knProfile 的身份与 KN 上下文注入，只换工具面形态。
  // 接同一个知识网络，差别仅在「逐个工具」与「写代码」，才是有意义的对照。
  const ptcComparePane: PaneProfile = {
    ...knProfile,
    paneKey: "ptc",
    title: t("knowledgeNetwork.agentChat.profiles.ptcTitle"),
    emptyTitle: t("knowledgeNetwork.agentChat.profiles.ptcEmptyTitle"),
    toolMode: "ptc",
    defaultPrompt: ptcPrompt,
    foreignPrompts: [mcpPrompt],
  };
  const compareProfiles: Record<ComparePaneId, PaneProfile> = {
    base: baseProfile,
    kn: knProfile,
    ptc: ptcComparePane,
  };
  return { soloProfile, baseProfile, knProfile, ptcProfile, ptcComparePane, compareProfiles };
}

/** 报告里的一侧：身份、显示标签与快照。列顺序即参与方的规范顺序。 */
type ReportSide = { id: ComparePaneId; label: string; profile: PaneProfile; snapshot: PaneSnapshot };

/** 评审提示词里给各侧的代号，与报告表列顺序一致。 */
const SIDE_LETTERS = ["A", "B", "C"] as const;

/**
 * 评审侧的能力口径。判分提示词里各侧「能用什么」必须与实际对照组一致——写死成
 * 基础数据 vs 知识网络，换了对照组评审模型就会按不存在的工具面去判。
 */
function judgeSideKey(profile: PaneProfile): ComparePaneId {
  if (profile.toolMode === "ptc") return "ptc";
  return profile.paneKey === "base" ? "base" : "kn";
}

/** Evaluation prompt for the AI summary in a comparison report; sides are listed A, B, C… in pane order. */
function judgePrompt(sides: readonly ReportSide[], t: TFunction): string {
  const roster = sides
    .map((side, i) =>
      t("knowledgeNetwork.agentChat.judgeRosterLine", {
        letter: SIDE_LETTERS[i] ?? String(i + 1),
        side: t(`knowledgeNetwork.agentChat.judgeSides.${judgeSideKey(side.profile)}`),
      }),
    )
    .join("\n");
  return t("knowledgeNetwork.agentChat.judgePrompt", { count: sides.length, roster });
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

/**
 * Exports a comparison report as Markdown with overview, per-round metrics, every answer, and AI summary.
 *
 * 参与方数量与身份都是可变的（两两或三方），所以表格列、回答标题、模型行一律由
 * sides 展开，不能写死列数或「基础数据 / 业务知识网络」这类标签。
 */
function reportToMarkdown(
  sides: readonly ReportSide[],
  summary: string,
  knLabel: string,
  generatedAt: string,
  t: TFunction,
): string {
  const L: string[] = [];
  const row = (metric: string, cells: readonly string[]) => `| ${metric} | ${cells.join(" | ")} |`;
  const headerRow = row(
    t("knowledgeNetwork.agentChat.report.metricHeader"),
    sides.map((s) => s.label),
  );
  const dividerRow = `| --- |${sides.map(() => " --- |").join("")}`;

  L.push(`# ${t("knowledgeNetwork.agentChat.report.title", { knLabel })}`, "");
  L.push(`- ${t("knowledgeNetwork.agentChat.report.generatedAt", { generatedAt })}`);
  L.push(
    `- ${sides
      .map((s) =>
        t("knowledgeNetwork.agentChat.report.modelLine", { label: s.label, model: s.snapshot.model || "—" }),
      )
      .join("；")}`,
    "",
  );
  L.push(`## ${t("knowledgeNetwork.agentChat.report.overview")}`, "");
  L.push(headerRow, dividerRow);
  L.push(
    row(
      t("knowledgeNetwork.agentChat.report.totalTokens"),
      sides.map((s) => fmtTokens(s.snapshot.stats.tokens)),
    ),
  );
  L.push(
    row(
      t("knowledgeNetwork.agentChat.report.totalDuration"),
      sides.map((s) => fmtDuration(s.snapshot.stats.ms)),
    ),
  );
  L.push(
    row(
      t("knowledgeNetwork.agentChat.report.rounds"),
      sides.map((s) => String(s.snapshot.rounds.length)),
    ),
  );
  const totalCalls = (s: PaneSnapshot) => s.rounds.reduce((n, r) => n + r.toolCalls.length, 0);
  L.push(
    row(
      t("knowledgeNetwork.agentChat.report.totalToolCalls"),
      sides.map((s) => String(totalCalls(s.snapshot))),
    ),
  );
  L.push(
    row(
      t("knowledgeNetwork.agentChat.report.invalidRounds"),
      sides.map((s) => String(negativeRounds(s.snapshot))),
    ),
    "",
  );

  const roundCount = Math.max(...sides.map((s) => s.snapshot.rounds.length));
  for (let i = 0; i < roundCount; i++) {
    const rounds = sides.map((s) => s.snapshot.rounds[i]);
    const asked = rounds.filter((r) => r != null).map((r) => r.question);
    const sameQ = asked.every((q) => q === asked[0]);
    L.push(`## ${t("knowledgeNetwork.agentChat.report.roundTitle", { round: i + 1 })}`, "");
    L.push(
      `> ${
        sameQ
          ? (asked[0] ?? "—")
          : sides
              .map((s, j) =>
                t("knowledgeNetwork.agentChat.report.questionPerSide", {
                  label: s.label,
                  question: rounds[j]?.question ?? "—",
                }),
              )
              .join(" ／ ")
      }`,
      "",
    );
    L.push(headerRow, dividerRow);
    L.push(row("token", rounds.map((r) => (r?.tokens != null ? fmtTokens(r.tokens) : "—"))));
    L.push(
      row(
        t("knowledgeNetwork.agentChat.report.duration"),
        rounds.map((r) => (r?.ms != null ? fmtDuration(r.ms) : "—")),
      ),
    );
    L.push(
      row(
        t("knowledgeNetwork.agentChat.report.toolCalls"),
        rounds.map((r) => mdCalls(r, t)),
      ),
    );
    L.push(
      row(
        t("knowledgeNetwork.agentChat.report.result"),
        rounds.map((r) => (r ? outcomeLabel(r.outcome, t) : "—")),
      ),
      "",
    );
    sides.forEach((s, j) => {
      L.push(
        `### ${t("knowledgeNetwork.agentChat.report.answerTitle", { label: s.label })}`,
        "",
        answerBlock(rounds[j], t),
        "",
      );
    });
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
  /** 参与方标签，按规范列序。栏位标题、发送目标、报告表头共用一份。 */
  const labelOf = useCallback(
    (id: ComparePaneId) => profiles.compareProfiles[id].title ?? "",
    [profiles.compareProfiles],
  );
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
  const [busyMap, setBusyMap] = useState<Record<PaneKey, boolean>>({
    solo: false,
    base: false,
    kn: false,
    ptc: false,
  });
  const setPaneBusy = useCallback((key: PaneKey, busy: boolean) => {
    setBusyMap((prev) => (prev[key] === busy ? prev : { ...prev, [key]: busy }));
  }, []);
  const onSoloBusy = useCallback((b: boolean) => setPaneBusy("solo", b), [setPaneBusy]);
  const busyHandlerOf = useMemo<Record<ComparePaneId, (busy: boolean) => void>>(
    () => ({
      base: (b) => setPaneBusy("base", b),
      kn: (b) => setPaneBusy("kn", b),
      ptc: (b) => setPaneBusy("ptc", b),
    }),
    [setPaneBusy],
  );

  /** One-time managed session for platform prefetching, not either conversation. */
  const summaryLifecycle = useMemo(
    () =>
      createBknLifecycle(lifecycleEnv(env.base, knId), tokenProvider, {
        conversationStore: memoryConversationStore(),
      }),
    [env.base, knId, tokenProvider],
  );

  const soloRef = useRef<ChatPaneHandle>(null);
  // 每个参与方一个 ref。hooks 不能按数组动态创建，所以三个显式声明后收进一张表。
  const baseRef = useRef<ChatPaneHandle>(null);
  const knRef = useRef<ChatPaneHandle>(null);
  const ptcRef = useRef<ChatPaneHandle>(null);
  const compareRefs = useMemo(() => ({ base: baseRef, kn: knRef, ptc: ptcRef }), []);
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

  /** 当前渲染中的参与方；单侧补发时只有那一栏。 */
  const shownSides = useMemo(() => (compare.on ? visibleSides(compare) : []), [compare]);

  /**
   * 渲染用的 profile：最强那侧（列序末位）加高亮，与报告表最后一列一致。
   *
   * 必须记忆化——ChatPane 有若干以 profile 字段为依赖的 effect，每次渲染换一个新
   * 对象会让它们反复重跑（历史重载、会话重置）。
   */
  const paneProfiles = useMemo(
    () =>
      shownSides.map((id, i) => ({
        ...profiles.compareProfiles[id],
        highlight: shownSides.length > 1 && i === shownSides.length - 1,
      })),
    [shownSides, profiles.compareProfiles],
  );

  const targets = useMemo<PaneKey[]>(
    () => (compare.on ? shownSides : ["solo"]),
    [compare.on, shownSides],
  );

  const refOf = useCallback(
    (key: PaneKey) => (key === "solo" ? soloRef : compareRefs[key]),
    [compareRefs],
  );

  const anyTargetBusy = targets.some((k) => busyMap[k]);
  const anyBusy = busyMap.solo || busyMap.base || busyMap.kn || busyMap.ptc;
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

  // Comparison report: one snapshot per participant, metric table, and streaming AI summary.
  const [report, setReport] = useState<ReportSide[] | null>(null);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const summaryAbortRef = useRef<AbortController | null>(null);

  const openReport = useCallback(() => {
    const sides = compare.sides.flatMap<ReportSide>((id) => {
      const snapshot = compareRefs[id].current?.getSnapshot();
      const profile = profiles.compareProfiles[id];
      return snapshot ? [{ id, label: profile.title ?? "", profile, snapshot }] : [];
    });
    // 少于两侧拿不到快照就不是对比——某一栏刚被勾上还没挂载时会出现。
    if (sides.length < MIN_SIDES) return;
    setReport(sides);
    setSummary("");
  }, [compare.sides, compareRefs, profiles.compareProfiles]);

  const closeReport = useCallback(() => {
    summaryAbortRef.current?.abort();
    setReport(null);
  }, []);

  const buildMarkdown = useCallback(() => {
    if (!report) return null;
    const stamp = new Date().toLocaleString(i18n.language, { hour12: false });
    return reportToMarkdown(report, summary, networkName ? `${networkName} (${knId})` : knId, stamp, t);
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
    // 评审用能力最强那侧的模型（列序即能力从弱到强），它没配模型再往前退。
    const modelName = [...report].reverse().find((side) => side.snapshot.model)?.snapshot.model;
    if (!modelName) return;
    const content = report
      .map((side, i) => paneBrief(`${SIDE_LETTERS[i] ?? String(i + 1)} · ${side.label}`, side.snapshot, t))
      .join("\n\n");
    setSummarizing(true);
    setSummary("");
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    try {
      await runAgentChat({
        env,
        modelName,
        system: judgePrompt(report, t),
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
    if (compare.target === "all") {
      return t("knowledgeNetwork.agentChat.placeholders.all", { count: compare.sides.length });
    }
    return t("knowledgeNetwork.agentChat.placeholders.side", { label: labelOf(compare.target) });
  }, [noLlm, compare, suggestions, defaultSuggestions, labelOf, t]);

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
                { label: t("knowledgeNetwork.agentChat.composer.all"), value: "all" },
                ...compare.sides.map((id) => ({ label: labelOf(id), value: id })),
              ]}
            />
          </div>
          {compare.target === "all" ? (
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
          {compare.on ? (
            /* 参与方勾选：勾两个是两两对比，勾三个是三方同问。剩两个时禁止再取消。 */
            <div className={styles.sidePicker}>
              <span className={styles.targetLabel}>{t("knowledgeNetwork.agentChat.composer.sides")}</span>
              {COMPARE_PANE_IDS.map((id) => {
                const on = compare.sides.includes(id);
                return (
                  <Checkbox
                    key={id}
                    checked={on}
                    disabled={anyBusy || (on && compare.sides.length <= MIN_SIDES)}
                    onChange={() => setCompareState((prev) => toggleSide(prev, id))}
                  >
                    {labelOf(id)}
                  </Checkbox>
                );
              })}
            </div>
          ) : (
            <>
              <div className={styles.modeToggle}>
                <Switch checked={ptcOn} disabled={anyBusy} onChange={setPtcOn} />
                <span>{t("knowledgeNetwork.agentChat.composer.ptcMode")}</span>
              </div>
              <span className={styles.paneTitle}>
                {ptcOn
                  ? t("knowledgeNetwork.agentChat.profiles.ptcTitle")
                  : t("knowledgeNetwork.agentChat.profiles.knTitle")}
              </span>
            </>
          )}
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
            {/* 参与方各占一栏、等宽；单侧补发时只渲染那一栏。 */}
            <div className={`${styles.panes} ${shownSides.length === 1 ? styles.panesSingle : ""}`}>
              {shownSides.map((id, i) => (
                <div key={id} className={styles.pane}>
                  <ChatPane
                    ref={compareRefs[id]}
                    {...paneShared}
                    profile={paneProfiles[i]}
                    suggestions={suggestions}
                    onPick={sendQuestion}
                    onBusyChange={busyHandlerOf[id]}
                  />
                </div>
              ))}
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
            {report.every((side) => side.snapshot.rounds.length === 0) ? (
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
                  const aggs = report.map((side) => agg(side.snapshot));
                  // 只有各侧都跑过才比最优值；某侧没轮次时整行不标，避免把「没跑」标成最省。
                  const allRan = aggs.every((a) => a.rounds > 0);
                  const bestBy = (pick: (s: PaneSnapshot) => number) => {
                    if (!allRan) return -1;
                    const values = report.map((side) => pick(side.snapshot));
                    const min = Math.min(...values);
                    // 并列时不标，标了会显得某侧更优。
                    return values.filter((v) => v === min).length === 1 ? values.indexOf(min) : -1;
                  };
                  const bestTok = bestBy((s) => s.stats.tokens);
                  const bestMs = bestBy((s) => s.stats.ms);
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
                              rounds: Math.max(...aggs.map((a) => a.rounds)),
                            })}
                          </th>
                          {report.map((side, i) => (
                            <th key={side.id}>
                              <span
                                className={`${styles.paneTitle} ${i === report.length - 1 ? styles.paneTitleHl : ""}`}
                              >
                                {side.label}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.model")}</td>
                          {report.map((side) => (
                            <td key={side.id}>{side.snapshot.model || "—"}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.totalTokens")}</td>
                          {report.map((side, i) => (
                            <td key={side.id} className={i === bestTok ? styles.rptBest : ""}>
                              {fmtTokens(side.snapshot.stats.tokens)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.totalDuration")}</td>
                          {report.map((side, i) => (
                            <td key={side.id} className={i === bestMs ? styles.rptBest : ""}>
                              {fmtDuration(side.snapshot.stats.ms)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.averagePerRound")}</td>
                          {report.map((side, i) => (
                            <td key={side.id}>
                              {aggs[i].rounds > 0
                                ? `${fmtTokens(aggs[i].avgTokens)} tokens · ${fmtDuration(aggs[i].avgMs)}`
                                : "—"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.totalToolCalls")}</td>
                          {report.map((side, i) => (
                            <td key={side.id}>{callsCell(aggs[i])}</td>
                          ))}
                        </tr>
                        <tr>
                          <td>{t("knowledgeNetwork.agentChat.report.invalidRounds")}</td>
                          {report.map((side, i) => (
                            <td key={side.id} className={aggs[i].neg > 0 ? styles.rptErrTxt : ""}>
                              {aggs[i].neg}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}

                {/* 逐轮对比 */}
                {Array.from({ length: Math.max(...report.map((s) => s.snapshot.rounds.length)) }, (_, i) => {
                  const rounds = report.map((side) => side.snapshot.rounds[i]);
                  const asked = rounds.filter((r) => r != null).map((r) => r.question);
                  const sameQ = asked.every((q) => q === asked[0]);
                  // 最优值只在各侧本轮都有数时评，并列不标。
                  const bestOf = (pick: (r: PaneRound) => number | null | undefined) => {
                    const values = rounds.map((r) => (r ? pick(r) : undefined));
                    if (values.some((v) => v == null)) return -1;
                    const nums = values as number[];
                    const min = Math.min(...nums);
                    return nums.filter((v) => v === min).length === 1 ? nums.indexOf(min) : -1;
                  };
                  const bestTokens = bestOf((r) => r.tokens);
                  const bestMs = bestOf((r) => r.ms);
                  const toolCell = (r?: PaneRound) => {
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
                            ? (asked[0] ?? "—")
                            : report
                                .map((side, j) =>
                                  t("knowledgeNetwork.agentChat.report.questionPerSide", {
                                    label: side.label,
                                    question: rounds[j]?.question ?? "—",
                                  }),
                                )
                                .join(" ／ ")}
                        </span>
                      </div>
                      <table className={styles.rptTable}>
                        <tbody>
                          <tr>
                            <td>token</td>
                            {report.map((side, j) => (
                              <td key={side.id} className={j === bestTokens ? styles.rptBest : ""}>
                                {rounds[j]?.tokens != null ? fmtTokens(rounds[j].tokens) : "—"}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("knowledgeNetwork.agentChat.report.duration")}</td>
                            {report.map((side, j) => (
                              <td key={side.id} className={j === bestMs ? styles.rptBest : ""}>
                                {rounds[j]?.ms != null ? fmtDuration(rounds[j].ms) : "—"}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("knowledgeNetwork.agentChat.report.toolCalls")}</td>
                            {report.map((side, j) => (
                              <td key={side.id}>{toolCell(rounds[j])}</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("knowledgeNetwork.agentChat.report.result")}</td>
                            {report.map((side, j) => {
                              const round = rounds[j];
                              return (
                                <td
                                  key={side.id}
                                  className={round && round.outcome !== "answered" ? styles.rptErrTxt : ""}
                                >
                                  {round ? outcomeLabel(round.outcome, t) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                      <div className={styles.rptAnsGrid}>
                        {report
                          .map((side, j) => ({
                            key: side.id,
                            title: side.label,
                            hl: j === report.length - 1,
                            round: rounds[j],
                          }))
                          .map(({ key, title, hl, round }) => {
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
